import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fsSync from 'fs'
import fs from 'fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import documentSchemas from '@/lib/document-schemas.json'

export const config = { api: { bodyParser: false } }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const requiredKey = process.env.API_KEY
  if (requiredKey) {
    const headerKeyRaw = req.headers['x-api-key']
    const headerKey = Array.isArray(headerKeyRaw) ? headerKeyRaw[0] : headerKeyRaw
    const auth = req.headers.authorization
    const bearer = auth && auth.startsWith('Bearer ') ? auth.slice(7) : undefined
    const provided = headerKey || bearer

    if (provided !== requiredKey) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Server not configured',
      details: 'Missing ANTHROPIC_API_KEY environment variable.'
    })
  }

  const [fields, files] = await formidable({ maxFileSize: 20 * 1024 * 1024 }).parse(req)
  const file = Array.isArray(files.file) ? files.file[0] : files.file
  if (!file?.filepath || !file?.mimetype)
    return res.status(400).json({ error: 'Invalid file' })

  const isImage = file.mimetype.startsWith('image/')
  const isPDF = file.mimetype === 'application/pdf'
  if (!isImage && !isPDF)
    return res.status(400).json({ error: 'Images and PDFs only' })

  try {
    const base64 = fsSync.readFileSync(file.filepath).toString('base64')

    const prompt = `
You are a JSON API specialized in analyzing Chilean documents.
Your goal is to return ONLY a valid JSON object. Never include text, markdown, or explanations.

You know these document schemas:
${JSON.stringify(documentSchemas, null, 2)}

If the document clearly matches a known schema, return it using that exact schema.

If it does NOT match any known schema:
- Extract every relevant field and its real value from the document (names, dates, amounts, RUT, etc.).
- Use Spanish snake_case keys for all field names (e.g., nombre, rut, fecha_emision, monto_total).
- The values must be the actual data found in the document, not examples or placeholders.
- Guess the document type if possible (e.g., "Liquidación de Sueldo", "Certificado AFP"); otherwise use "documento_nuevo".
- Return a single JSON object in this format:
  {
    "document_type": "<in Spanish>",
    "data": { <extracted_fields> }
  }

Rules:
- Output must be strictly valid JSON.
- Never include commentary, markdown, or extra text.
- Use numbers for numeric values when possible.
`

    const content: Anthropic.MessageCreateParamsNonStreaming['messages'][number]['content'] = [
      { type: 'text', text: prompt },
      isPDF
        ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64
          }
        }
        : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: base64
          }
        }
    ]

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: 'user', content }]
    })

    const textBlock = message.content.find(b => b.type === 'text')
    let text = textBlock && 'text' in textBlock ? textBlock.text : '{}'
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (match) text = match[0]

    const result = JSON.parse(text)
    fs.unlink(file.filepath).catch(() => { })
    res.json(result)
  } catch (e) {
    console.error('Error:', e)
    res.status(500).json({
      error: 'Processing failed',
      details: e instanceof Error ? e.message : String(e)
    })
  }
}