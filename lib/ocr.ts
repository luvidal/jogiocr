import { GoogleGenAI } from '@google/genai'
import reqdocs from '@/data/reqdocs.json'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

type JsonRecord = Record<string, unknown>

type ReqDoc = {
  id: string
  freq: 'day' | 'month' | 'year'
  fields: JsonRecord
}

type DocSlice = {
  id: string
  docdate: string
  start?: number
  end?: number
  data: JsonRecord | JsonRecord[]
}

type DocResult = {
  documents: DocSlice[]
}

export async function Doc2Fields(buffer: Buffer, mimetype: string): Promise<DocResult> {
  const isImage = mimetype.startsWith('image/')
  const isPDF = mimetype === 'application/pdf'
  if (!isImage && !isPDF) throw new Error('Images and PDFs only')

  const schemas = (reqdocs as ReqDoc[]).reduce<Record<string, ReqDoc>>(
    (acc, d) => (d?.id ? { ...acc, [d.id]: d } : acc),
    {}
  )
  const base64 = buffer.toString('base64')

  const prompt = `Identify ALL document types in this Chilean document.

Allowed id values: ${(reqdocs as ReqDoc[])?.map(d => d?.id).filter(Boolean).join(', ')}

For each detected document, extract its fields using this schema map:
${JSON.stringify(schemas, null, 2)}

Return ONLY valid JSON array:
[
  {
    "id": "cedula-identidad",
    "docdate": "YYYY-MM-DD",
    "start": 1,
    "end": 2,
    "data": { ...fields }
  }
]

Rules (CRITICAL - follow exactly):
1) Output ONLY valid JSON array (no markdown, no extra text)
2) One entry per detected document instance (repeat id if multiple); if none return []
3) ${isPDF ? 'FOR PDFs: start and end are MANDATORY integer page numbers (1-indexed) where document appears. MUST be included for every document!' : 'For images: omit start/end'}
4) data MUST include every schema field key for that id (use null if missing); never return {}
5) docdate MUST be ISO 'YYYY-MM-DD' for DB
   - use issued/signed date when present
   - freq 'year' => 'YYYY-01-01'
   - freq 'month' => 'YYYY-MM-01'
   - else => exact date found`
  const parts = [
    { text: prompt },
    isPDF
      ? { inlineData: { mimeType: 'application/pdf', data: base64 } }
      : { inlineData: { mimeType: mimetype, data: base64 } }
  ]

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: parts,
    config: { temperature: 0, maxOutputTokens: 8192 }
  })

  let text = response.text || '{}'

  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (match) text = match[0]

  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error(`Failed to parse AI response: ${text}`)
  }

  const items = Array.isArray(parsed) ? parsed : []

  const out: DocSlice[] = items
    .filter(m => m && typeof m === 'object')
    .map(m => {
      const obj = m as Record<string, unknown>
      return {
        id: typeof obj.id === 'string' ? obj.id : '',
        docdate: typeof obj.docdate === 'string' ? obj.docdate : '',
        start: typeof obj.start === 'number' ? obj.start : undefined,
        end: typeof obj.end === 'number' ? obj.end : undefined,
        data: (obj.data as JsonRecord | JsonRecord[]) || {}
      }
    })
    .filter(m => schemas[m.id] && Boolean(m.docdate))

  return { documents: out }
}
