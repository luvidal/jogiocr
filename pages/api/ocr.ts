import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fsSync from 'fs'
import fs from 'fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { execute } from '@/utils/helpers'

export const config = { api: { bodyParser: false } }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

let schemasCache: Record<string, any> = {}
let doctypeMapCache: Record<string, { id: string, label: string }> = {}
let lastFetch = 0
const CACHE_TTL = 3600000

async function loadSchemas() {
  if (Object.keys(schemasCache).length && Date.now() - lastFetch < CACHE_TTL)
    return { schemas: schemasCache, map: doctypeMapCache }

  const rows = await execute('_hooks.sp_get_doctypes_all')

  schemasCache = {}
  doctypeMapCache = {}

  for (const row of rows) {
    if (row.fields) {
      schemasCache[row.label] = JSON.parse(row.fields)
      doctypeMapCache[row.label] = { id: row.doctypeid, label: row.label }
    }
  }

  lastFetch = Date.now()
  return { schemas: schemasCache, map: doctypeMapCache }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const requiredKey = process.env.INTERNAL_API_KEY
  if (requiredKey) {
    const headerKeyRaw = req.headers['x-api-key']
    const headerKey = Array.isArray(headerKeyRaw) ? headerKeyRaw[0] : headerKeyRaw
    const auth = req.headers.authorization
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined
    const provided = headerKey || bearer

    if (provided !== requiredKey)
      return res.status(401).json({ error: 'Unauthorized' })
  }

  const [fields, files] = await formidable({ maxFileSize: 20 * 1024 * 1024 }).parse(req)
  const model = Array.isArray(fields.model) ? fields.model[0] : fields.model || 'claude'
  const file = Array.isArray(files.file) ? files.file[0] : files.file

  if (!file?.filepath || !file?.mimetype)
    return res.status(400).json({ error: 'Invalid file' })

  const isImage = file.mimetype.startsWith('image/')
  const isPDF = file.mimetype === 'application/pdf'
  if (!isImage && !isPDF)
    return res.status(400).json({ error: 'Images and PDFs only' })

  if (model === 'claude' && !process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' })

  if (model === 'gpt5' && !process.env.OPENAI_API_KEY)
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY' })

  try {
    const { schemas, map } = await loadSchemas()
    const base64 = fsSync.readFileSync(file.filepath).toString('base64')
    const prompt = `Extract data from this Chilean document as JSON.

Known schemas:
${JSON.stringify(schemas, null, 2)}

Match a schema if possible, otherwise extract all fields.
Use exact schema names as keys.

Rules:
- ONLY JSON output
- Numbers as numbers
- Spanish snake_case keys
- No markdown/text`

    let text = ''

    if (model === 'gpt5') {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${file.mimetype};base64,${base64}` } }
          ]
        }],
        max_tokens: 2048,
        temperature: 0
      })
      text = response.choices[0]?.message?.content || '{}'
    } else {
      const content: Anthropic.MessageCreateParamsNonStreaming['messages'][number]['content'] = [
        { type: 'text', text: prompt },
        isPDF
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
          : { type: 'image', source: { type: 'base64', media_type: file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } }
      ]

      const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        temperature: 0,
        messages: [{ role: 'user', content }]
      })

      const textBlock = message.content.find(b => b.type === 'text')
      text = textBlock && 'text' in textBlock ? textBlock.text : '{}'
    }

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (match) text = match[0]

    const parsed = JSON.parse(text)
    const schemaKey = Object.keys(parsed)[0]
    const doctype = map[schemaKey]
    const data = parsed[schemaKey] || parsed

    fs.unlink(file.filepath).catch(() => { })

    res.json({
      doctypeid: doctype?.id || null,
      label: doctype?.label || null,
      matched: !!doctype,
      data
    })
  } catch (e) {
    console.error('Error:', e)
    res.status(500).json({
      error: 'Processing failed',
      details: e instanceof Error ? e.message : String(e)
    })
  }
}