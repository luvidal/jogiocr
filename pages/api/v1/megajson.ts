import type { NextApiRequest, NextApiResponse } from 'next'
import reqDocs from '@/data/reqdocs.json'
import fieldAliases from '@/data/field-aliases.json'

type ReqDoc = {
    id: string
    freq: 'day' | 'month' | 'year' | 'none'
    fields: Record<string, unknown>
}

type IncomingDoc = {
    id: string
    docdate: string
    data: Record<string, unknown> | Record<string, unknown>[]
}

function resolveField(obj: unknown, docType: string, fieldName: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined

    const rec = obj as Record<string, unknown>
    if (rec[fieldName] !== undefined) return rec[fieldName]

    const docAliases = (fieldAliases as Record<string, Record<string, string[]>>)?.[docType]
    const aliases = docAliases?.[fieldName] || []
    for (const alias of aliases) {
        if (rec[alias] !== undefined) return rec[alias]
    }

    return undefined
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST' || !Array.isArray(req.body?.documents)) {
        return res.status(400).json({ error: 'POST with documents array required' })
    }

    const incomingDocs: IncomingDoc[] = req.body.documents
    const documents: Record<string, unknown> = {}

    const schemas = (reqDocs as ReqDoc[]).reduce<Record<string, ReqDoc>>(
        (acc, d) => (d?.id ? { ...acc, [d.id]: d } : acc),
        {}
    )

    for (const doc of incomingDocs) {
        const docSchema = schemas[doc.id]
        if (!docSchema) continue

        const dataArr = Array.isArray(doc.data) ? doc.data : [doc.data]
        const cleanArr = dataArr.filter(item => item && typeof item === 'object')
        documents[doc.id] = cleanArr.length <= 1 ? cleanArr[0] : cleanArr

        if (doc.docdate) {
            const entries = Array.isArray(documents[doc.id]) ? (documents[doc.id] as unknown[]) : [documents[doc.id]]
            entries?.forEach(item => {
                if (!item || typeof item !== 'object') return
                const rec = item as Record<string, unknown>
                if (!rec.docdate) rec.docdate = doc.docdate
            })
        }
    }

    const cedula = documents['cedula-identidad']
    const cedulaData = Array.isArray(cedula) ? cedula[0] : cedula
    const mainRut = resolveField(cedulaData, 'cedula-identidad', 'rut') || ''
    const mainNombres = resolveField(cedulaData, 'cedula-identidad', 'nombres') || ''
    const mainApellidos = resolveField(cedulaData, 'cedula-identidad', 'apellidos') || ''
    const fullName = [mainNombres, mainApellidos].filter(Boolean).join(' ')

    const allRuts = new Set<string>()
    const allNames = new Set<string>()

    for (const docData of Object.values(documents)) {
        const entries = Array.isArray(docData) ? docData : [docData]
        entries.forEach(entry => {
            if (entry?.rut) allRuts.add(entry.rut)
                ;['nombre', 'nombres', 'trabajador_nombre', 'titular_nombre'].forEach(key => {
                    if (entry?.[key]) allNames.add(entry[key])
                })
        })
    }

    const aggregations: Record<string, unknown> = {}

    const liquidaciones = documents['liquidacion-sueldo']
    if (Array.isArray(liquidaciones) && liquidaciones.length) {
        const items = liquidaciones.filter(l => {
            const val = resolveField(l, 'liquidacion-sueldo', 'liquido_a_pagar')
            return val !== undefined && val !== null && val !== ''
        })
        if (items.length > 0) {
            const getTotalPagar = (l: unknown) => parseFloat(String(resolveField(l, 'liquidacion-sueldo', 'liquido_a_pagar') || 0)) || 0
            const getImponible = (l: unknown) => parseFloat(String(resolveField(l, 'liquidacion-sueldo', 'base_imponible') || 0)) || 0

            aggregations.liquidacion_sueldo = {
                count: items.length,
                total_liquido: items.reduce((sum, l) => sum + getTotalPagar(l), 0),
                avg_liquido: items.reduce((sum, l) => sum + getTotalPagar(l), 0) / items.length,
                total_base_imponible: items.reduce((sum, l) => sum + getImponible(l), 0),
                avg_base_imponible: items.reduce((sum, l) => sum + getImponible(l), 0) / items.length,
                periodos: items.map(l => resolveField(l, 'liquidacion-sueldo', 'docdate')).filter(Boolean)
            }
        }
    }

    const boletas = documents['boletas-anual']
    if (Array.isArray(boletas) && boletas.length) {
        const items = boletas.filter(b => {
            const val = resolveField(b, 'boletas-anual', 'total_liquido')
            return val !== undefined && val !== null && val !== ''
        })
        if (items.length > 0) {
            aggregations.boletas_anual = {
                count: items.length,
                total_liquido: items.reduce((sum, b) => sum + (parseFloat(String(resolveField(b, 'boletas-anual', 'total_liquido') || 0)) || 0), 0),
                total_honorario_bruto: items.reduce((sum, b) => sum + (parseFloat(String(resolveField(b, 'boletas-anual', 'honorario_bruto') || 0)) || 0), 0),
                años: items.map(b => resolveField(b, 'boletas-anual', 'año')).filter(Boolean)
            }
        }
    }

    const cuentas = documents['cuenta-bancaria']
    if (Array.isArray(cuentas) && cuentas.length) {
        const items = cuentas.filter(c => {
            const val = resolveField(c, 'cuenta-bancaria', 'saldo_final')
            return val !== undefined && val !== null && val !== ''
        })
        if (items.length > 0) {
            aggregations.cuenta_bancaria = {
                count: items.length,
                saldo_final_promedio: items.reduce((sum, c) => sum + (parseFloat(String(resolveField(c, 'cuenta-bancaria', 'saldo_final') || 0)) || 0), 0) / items.length,
                total_abonos: items.reduce((sum, c) => sum + (parseFloat(String(resolveField(c, 'cuenta-bancaria', 'total_abonos') || 0)) || 0), 0),
                total_cargos: items.reduce((sum, c) => sum + (parseFloat(String(resolveField(c, 'cuenta-bancaria', 'total_cargos') || 0)) || 0), 0)
            }
        }
    }

    res.status(200).json({
        meta: {
            mainRut,
            mainName: fullName,
            allRuts: Array.from(allRuts).filter(Boolean),
            allNames: Array.from(allNames).filter(Boolean),
            generatedAt: new Date().toISOString(),
            requiredDocs: Object.keys(documents),
            providedDocs: incomingDocs.map(d => d.id),
            aggregations
        },
        documents
    })
}