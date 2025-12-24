import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import { Doc2Fields } from '@/lib/ocr'

const slicePdf = async (buffer: Buffer, start: number, end: number) => {
  const src = await PDFDocument.load(buffer)
  const out = await PDFDocument.create()
  const pages = Array.from({ length: end - start + 1 }, (_, idx) => start + idx)
  const copied = await out.copyPages(src, pages.map(p => p - 1))
  copied.forEach(p => out.addPage(p))
  return out.save()
}

export const config = { api: { bodyParser: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  try {
    const [, files] = await formidable({ maxFileSize: 20 * 1024 * 1024 }).parse(req)
    const file = Array.isArray(files.file) ? files.file[0] : files.file

    if (!file?.filepath || !file?.mimetype)
      return res.status(400).json({ error: 'No file provided' })

    const buffer = fs.readFileSync(file.filepath)
    const result = await Doc2Fields(buffer, file.mimetype)

    if (file.mimetype === 'application/pdf') {
      const pdf = await PDFDocument.load(buffer)
      const totalPages = pdf.getPageCount()

      const slices = (result.documents || [])
        .filter(d => d && typeof d === 'object')
        .map(d => ({
          id: typeof (d as any).id === 'string' ? (d as any).id : 'document',
          start: typeof (d as any).start === 'number' ? (d as any).start : 0,
          end: typeof (d as any).end === 'number' ? (d as any).end : 0
        }))
        .filter(d => d.start > 0 && d.end >= d.start && d.end <= totalPages)

      const out = await Promise.all(
        slices.map(async (d, i) => {
          const bytes = await slicePdf(buffer, d.start, d.end)
          return {
            id: d.id,
            start: d.start,
            end: d.end,
            filename: `${d.id}-${i + 1}.pdf`,
            base64: Buffer.from(bytes).toString('base64')
          }
        })
      )

      fs.unlinkSync(file.filepath)
      return res.json({ ...result, files: out })
    }

    fs.unlinkSync(file.filepath)
    res.json(result)
  } catch (e) {
    console.error('OCR API Error:', e)
    const errorMsg = e instanceof Error ? e.message : 'Processing failed'
    const errorStack = e instanceof Error ? e.stack : undefined
    res.status(500).json({ error: errorMsg, stack: errorStack })
  }
}