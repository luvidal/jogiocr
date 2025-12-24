import { GoogleGenAI } from '@google/genai'
import reqdocs from '@/data/reqdocs.json'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

type JsonRecord = Record<string, unknown>

type ReqDoc = {
  id: string
  freq: 'day' | 'month' | 'year'
  fields: JsonRecord
}

type DocType = ReqDoc['id']

type DocSlice = {
  id: string
  docdate: string
  data: JsonRecord | JsonRecord[]
}

type DocResult = {
  documents: DocSlice[]
}

export async function Doc2Fields(
  buffer: Buffer,
  mimetype: string,
  doctype?: DocType
): Promise<DocResult> {
  const isImage = mimetype.startsWith('image/')
  const isPDF = mimetype === 'application/pdf'
  if (!isImage && !isPDF) throw new Error('Images and PDFs only')

  const schemas = (reqdocs as ReqDoc[]).reduce<Record<string, ReqDoc>>(
    (acc, d) => (d?.id ? { ...acc, [d.id]: d } : acc),
    {}
  )
  const schemaInfo = doctype ? schemas[doctype] : null
  const campos = schemaInfo?.fields || {}
  const base64 = buffer.toString('base64')

  const freq = schemaInfo?.freq || 'none'

  const prompt = doctype
    ? `Identify this Chilean document.

Document type: ${doctype}
Document frequency: ${freq}
Expected fields: ${JSON.stringify(campos, null, 2)}

Return ONLY valid JSON array:
[
  {
    "id": "${doctype}",
    "docdate": "YYYY-MM-DD",
    "data": { ...fields }
  }
]

Rules:
- data MUST include the extracted values for the Expected fields (use null if not found)
- Do not return an empty object for data
- docdate is the relevant date found in the document (issued/signed)
- If Document is frequency year, use YYYY-01-01
- If Document frequency is month, use YYYY-MM-01
- Else use the exact date found in the document`
    : `Identify ALL document types in this Chilean PDF.

Allowed id values: ${(reqdocs as ReqDoc[])?.map(d => d?.id).filter(Boolean).join(', ')}

Return ONLY valid JSON array:
[
  {
    "id": "cedula-identidad",
    "docdate": "YYYY-MM-DD",
    "data": { ...fields }
  }
]

Rules:
- One entry per detected document instance (repeat id if needed)
- If none, return []
- data MUST include extracted values for that document (use null if not found)
- Do not return an empty object for data
- docdate rules:
  - relevant date found in the document (issued/signed)
  - If the document frequency is year, use YYYY-01-01
  - If the document frequency is month, use YYYY-MM-01
  - Else use the exact date found in the document`
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
        data: (obj.data as JsonRecord | JsonRecord[]) || {}
      }
    })
    .filter(m => schemas[m.id] && Boolean(m.docdate))

  return { documents: out }
}
