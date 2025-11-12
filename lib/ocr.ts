import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { execute } from '@/lib/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function loadSchemas() {
    const rows = await execute('_hooks.sp_get_doctypes_all')

    const schemas: Record<string, any> = {}
    const map: Record<string, { id: string, label: string }> = {}

    for (const row of rows) {
        if (row.fields) {
            schemas[row.label] = JSON.parse(row.fields)
            map[row.label] = { id: row.doctypeid, label: row.label }
        }
    }

    return { schemas, map }
}

export async function Doc2Fields(buffer: Buffer, mimetype: string, model: 'claude' | 'gpt5' = 'claude', doctype?: string) {
    const isImage = mimetype.startsWith('image/')
    const isPDF = mimetype === 'application/pdf'
    if (!isImage && !isPDF) throw new Error('Images and PDFs only')

    const { schemas, map } = await loadSchemas()

    const targetSchema = doctype && schemas[doctype]
        ? { [doctype]: schemas[doctype] }
        : schemas

    const base64 = buffer.toString('base64')
    const prompt = `Extract data from this Chilean document as JSON.

${doctype ? `Required schema: ${doctype}` : 'Known schemas:'}
${JSON.stringify(targetSchema, null, 2)}

${doctype ? 'Use this exact schema.' : 'Match a schema if possible, otherwise extract all fields.'}
Use exact schema names as keys.

Rules:
- ONLY JSON output
- Numbers as numbers
- Spanish snake_case keys
- No markdown/text`

    let text = ''
    if (model === 'gpt5') {
        if (isPDF) throw new Error('OpenAI does not support PDFs, use claude')
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: `data:${mimetype};base64,${base64}` } }
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
                : { type: 'image', source: { type: 'base64', media_type: mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } }
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
    const schemaKey = doctype || Object.keys(parsed)[0]
    const doctypeInfo = map[schemaKey]
    const data = parsed[schemaKey] || parsed

    return {
        doctypeid: doctypeInfo?.id || null,
        label: doctypeInfo?.label || null,
        matched: !!doctypeInfo,
        data
    }
}