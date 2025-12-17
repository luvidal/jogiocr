import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import { Doc2Fields } from '@/lib/ocr'

export const config = { api: { bodyParser: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  try {
    const [fields, files] = await formidable({ maxFileSize: 20 * 1024 * 1024 }).parse(req)
    const model = (Array.isArray(fields.model) ? fields.model[0] : fields.model || 'claude') as 'claude' | 'gpt5'
    const doctypeRaw = Array.isArray(fields.doctype) ? fields.doctype[0] : fields.doctype
    const doctype = typeof doctypeRaw === 'string' ? (doctypeRaw as any) : undefined
    const file = Array.isArray(files.file) ? files.file[0] : files.file

    if (!file?.filepath || !file?.mimetype)
      return res.status(400).json({ error: 'No file provided' })

    const buffer = fs.readFileSync(file.filepath)
    const result = await Doc2Fields(buffer, file.mimetype, model, doctype)

    fs.unlinkSync(file.filepath)
    res.json(result)
  } catch (e) {
    console.error('OCR API Error:', e)
    const errorMsg = e instanceof Error ? e.message : 'Processing failed'
    const errorStack = e instanceof Error ? e.stack : undefined
    res.status(500).json({ error: errorMsg, stack: errorStack })
  }
}