import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import reqfields from '@/data/reqdocsfields.json'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type DocType = keyof typeof reqfields
type SingleDocResult = {
    doctypeid: string
    matched: boolean
    multiple: boolean
    periodo: string | null
    data: Record<string, any> | Record<string, any>[]
}
type DocResult = {
    documents: SingleDocResult[]
}

export async function Doc2Fields(
    buffer: Buffer,
    mimetype: string,
    model: 'claude' | 'gpt5' = 'claude',
    doctype?: DocType
): Promise<DocResult> {
    const isImage = mimetype.startsWith('image/')
    const isPDF = mimetype === 'application/pdf'
    if (!isImage && !isPDF) throw new Error('Images and PDFs only')

    const schemas = reqfields as any
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

    let text = ''

    if (model === 'gpt5') {
        if (isPDF) throw new Error('OpenAI does not support PDFs, use claude')
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{
                role: 'user', content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: `data:${mimetype};base64,${base64}` } }
                ]
            }],
            max_tokens: 8192,
            temperature: 0
        })
        text = response.choices[0]?.message?.content || '{}'
    } else {
        const content: Anthropic.MessageCreateParamsNonStreaming['messages'][number]['content'] = [
            { type: 'text', text: prompt },
            isPDF
                ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
                : { type: 'image', source: { type: 'base64', media_type: mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } }
        ]

        const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 8192,
            messages: [{ role: 'user', content }]
        })

        const textBlock = message.content.find(b => b.type === 'text')
        text = textBlock && 'text' in textBlock ? textBlock.text : '{}'
    }

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (match) text = match[0]

    let parsed: any
    try {
        parsed = JSON.parse(text)
    } catch (e) {
        throw new Error(`Failed to parse AI response: ${text}`)
    }

    // Extract all document types found in the response
    const documents: SingleDocResult[] = []

    for (const key of Object.keys(parsed)) {
        // Skip non-document keys
        if (!schemas[key]) continue

        let data = parsed[key]

        if (typeof data === 'string') {
            console.warn(`Skipping invalid data for ${key}: ${data}`)
            continue
        }

        const multiple = Array.isArray(data)

        let periodo: string | null = null
        if (Array.isArray(data) && data.length > 0) {
            periodo = data[0].periodo || null
        } else if (data?.periodo) {
            periodo = data.periodo
        }

        documents.push({
            doctypeid: key,
            matched: true,
            multiple,
            periodo,
            data
        })
    }

    // If no valid documents found, return empty array
    if (documents.length === 0) {
        console.warn('No valid document types found in AI response')
    }

    return { documents }
}