import { GoogleGenAI } from '@google/genai'
import reqdocs from '@/data/reqdocs.json'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

type DocType = keyof typeof reqdocs
type JsonRecord = Record<string, unknown>

type SingleDocResult = {
    doctypeid: string
    matched: boolean
    multiple: boolean
    periodo: string | null
    data: JsonRecord | JsonRecord[]
}
type DocResult = {
    documents: SingleDocResult[]
}

export async function Doc2Fields(
    buffer: Buffer,
    mimetype: string,
    doctype?: DocType
): Promise<DocResult> {
    const isImage = mimetype.startsWith('image/')
    const isPDF = mimetype === 'application/pdf'
    if (!isImage && !isPDF) throw new Error('Images and PDFs only')

    const schemas = reqdocs as Record<string, { periodo?: string, campos?: JsonRecord }>
    const schemaInfo = doctype ? schemas[doctype] : null
    const periodoFormat = schemaInfo?.periodo || 'YYYY-MM-DD'
    const campos = schemaInfo?.campos || {}
    const base64 = buffer.toString('base64')

    const prompt = doctype
        ? `Extract data from this Chilean document.

Document type: ${doctype}
Expected fields: ${JSON.stringify(campos, null, 2)}
Period format: ${periodoFormat}

Instructions:
1. Extract ALL fields from 'campos'
2. If MULTIPLE instances (e.g. multiple months), return array
3. Add 'periodo' field in format ${periodoFormat}

Output format:
{
  "${doctype}": {
    "periodo": "${periodoFormat}",
    ...all other fields
  }
}

OR for multiple:
{
  "${doctype}": [
    { "periodo": "2025-07", ...fields },
    { "periodo": "2025-08", ...fields }
  ]
}

Return ONLY valid JSON, no markdown, no explanation.`
        : `Extract data from ALL document types found in this Chilean document PDF.

Available document types: ${Object.keys(schemas).join(', ')}

Instructions:
1. Scan ALL pages and identify EVERY document type present
2. For each document type found, extract all relevant fields
3. If multiple instances of the same document type exist (e.g. multiple months of pay stubs), return them as an array
4. Return ALL document types found, even if there's only one page of each

Output format:
{
  "document-type-key-1": {
    "periodo": "YYYY-MM-DD",
    ...all fields for this document
  },
  "document-type-key-2": [
    { "periodo": "2025-07", ...fields },
    { "periodo": "2025-08", ...fields }
  ],
  "document-type-key-3": {
    "periodo": "YYYY-MM-DD",
    ...all fields for this document
  }
}

IMPORTANT: Return data for ALL document types you find in the PDF, not just the first one.
Return ONLY valid JSON, no markdown, no explanation.`

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
    } catch (e) {
        throw new Error(`Failed to parse AI response: ${text}`)
    }

    const documents: SingleDocResult[] = []

    const parsedObj = typeof parsed === 'object' && parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}

    for (const key of Object.keys(parsedObj)) {
        // Skip non-document keys
        if (!schemas[key]) continue

        let data = parsedObj[key]

        if (typeof data === 'string') {
            console.warn(`Skipping invalid data for ${key}: ${data}`)
            continue
        }

        const multiple = Array.isArray(data)

        let periodo: string | null = null
        if (Array.isArray(data) && data.length > 0) {
            const first = data[0] as Record<string, unknown>
            periodo = (first?.periodo as string) || null
        } else if (data && typeof data === 'object') {
            periodo = ((data as Record<string, unknown>)?.periodo as string) || null
        }

        documents.push({
            doctypeid: key,
            matched: true,
            multiple,
            periodo,
            data: data as JsonRecord | JsonRecord[]
        })
    }

    // If no valid documents found, return empty array
    if (documents.length === 0) {
        console.warn('No valid document types found in AI response')
    }

    return { documents }
}