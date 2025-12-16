import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import reqfields from '@/data/reqdocsfields.json'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type DocType = keyof typeof reqfields
type DocResult = {
    doctypeid: string | null
    matched: boolean
    multiple: boolean
    periodo: string | null
    data: Record<string, any> | Record<string, any>[]
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

    const prompt = `Extract data from this Chilean document.

Document type: ${doctype || 'auto-detect from: ' + Object.keys(schemas).join(', ')}
Expected fields: ${JSON.stringify(campos, null, 2)}
Period format: ${periodoFormat}

Instructions:
1. Identify document type (use exact key: ${doctype || Object.keys(schemas).join(', ')})
2. Extract ALL fields from 'campos'
3. If MULTIPLE instances (e.g. multiple months), return array
4. Add 'periodo' field in format ${periodoFormat}

Output format:
{
  "${doctype || 'document-type-key'}": {
    "periodo": "${periodoFormat}",
    ...all other fields
  }
}

OR for multiple:
{
  "${doctype || 'document-type-key'}": [
    { "periodo": "2025-07", ...fields },
    { "periodo": "2025-08", ...fields }
  ]
}

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

    const schemaKey = doctype || Object.keys(parsed).find(k => schemas[k]) || Object.keys(parsed)[0]
    let data = parsed[schemaKey] || parsed

    if (typeof data === 'string') {
        throw new Error(`AI returned invalid data format: ${text}`)
    }

    const multiple = Array.isArray(data)
    const doctypeInfo = schemas[schemaKey] ? { id: schemaKey } : null

    let periodo: string | null = null
    if (Array.isArray(data) && data.length > 0) {
        periodo = data[0].periodo || null
    } else if (data?.periodo) {
        periodo = data.periodo
    }

    return {
        doctypeid: doctypeInfo?.id || null,
        matched: !!doctypeInfo,
        multiple,
        periodo,
        data
    }
}