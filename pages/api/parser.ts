import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fsSync from 'fs'
import fs from 'fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import documentSchemas from '@/lib/document-schemas.json'

export const config = { api: { bodyParser: false } }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const [fields, files] = await formidable({ maxFileSize: 20 * 1024 * 1024 }).parse(req)
  const file = Array.isArray(files.file) ? files.file[0] : files.file

  if (!file?.filepath || !file?.mimetype) return res.status(400).json({ error: 'Invalid file' })

  const isImage = file.mimetype.startsWith('image/')
  const isPDF = file.mimetype === 'application/pdf'

  if (!isImage && !isPDF) return res.status(400).json({ error: 'Images and PDFs only' })

  try {
    const base64 = fsSync.readFileSync(file.filepath).toString('base64')

    const prompt = `You are a JSON API. Identify this Chilean document and return ONLY valid JSON, no explanations.
      Match one of these schemas:
      ${JSON.stringify(documentSchemas, null, 2)}
      Response format:
      {
        "document_type": "exact key from schemas",
        "data": { extracted fields matching that schema }
      }
      Unknown documents:
      {
        "document_type": "Unknown",
        "data": { "message": "Tipo de documento no reconocido" }
      }
      Return ONLY the JSON object, nothing else.`

    const content = isPDF
      ? [
        { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
        { type: 'text' as const, text: prompt }
      ]
      : [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: file.mimetype as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } },
        { type: 'text' as const, text: prompt }
      ]

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: 'user', content }]
    })

    const textContent = message.content.find(block => block.type === 'text')
    let text = textContent && 'text' in textContent ? textContent.text : '{}'

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) text = jsonMatch[0]

    const result = JSON.parse(text)

    fs.unlink(file.filepath).catch(() => { })
    res.json(result)

  } catch (e) {
    console.error('Error:', e)
    res.status(500).json({ error: 'Processing failed', details: e instanceof Error ? e.message : String(e) })
  }
}