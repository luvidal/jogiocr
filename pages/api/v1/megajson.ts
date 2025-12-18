import type { NextApiRequest, NextApiResponse } from 'next'
import reqDocs from '@/data/reqdocsfields.json'
import fieldAliases from '@/data/field-aliases.json'

type IncomingDoc = {
    doctypeid: string
    periodo?: string
    data: Record<string, any> | Record<string, any>[]
}

function resolveField(obj: any, docType: string, fieldName: string): any {
    if (!obj) return undefined
    if (obj[fieldName] !== undefined) return obj[fieldName]
    
    const docAliases = (fieldAliases as any)[docType]
    if (docAliases) {
        const aliases = docAliases[fieldName]
        if (aliases && Array.isArray(aliases)) {
            for (const alias of aliases) {
                if (obj[alias] !== undefined) return obj[alias]
            }
        }
    }
    return undefined
}

function getRequiredDocIds(docs: IncomingDoc[]): string[] {
    // TODO: extend with missing docs not yet provided by user
    return docs?.map(d => d.doctypeid) || []
}

function createEmptyTemplate(docId: string) {
    const docSchema = reqDocs[docId as keyof typeof reqDocs]
    if (!docSchema) return null
    return Object.fromEntries(Object.keys(docSchema.fields).map(k => [k, '']))
}

function mergeData(template: any, incoming: any) {
    if (!incoming || typeof incoming !== 'object') return template
    for (const [k, v] of Object.entries(incoming)) {
        if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) {
            template[k] = v
        }
    }
    return template
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST' || !Array.isArray(req.body?.documents)) {
        return res.status(400).json({ error: 'POST with documents array required' })
    }

    const incomingDocs: IncomingDoc[] = req.body.documents
    const documents: Record<string, any> = {}

    for (const doc of incomingDocs) {
        const docSchema = reqDocs[doc.doctypeid as keyof typeof reqDocs]
        if (!docSchema) continue

        if (docSchema.multiple) {
            const dataArr = Array.isArray(doc.data) ? doc.data : [doc.data]
            documents[doc.doctypeid] = dataArr.filter(item => item && typeof item === 'object')
        } else {
            const dataObj = Array.isArray(doc.data) ? doc.data[0] : doc.data
            if (dataObj && typeof dataObj === 'object') {
                documents[doc.doctypeid] = dataObj
            }
        }

        if (doc.periodo) {
            if (docSchema.multiple) {
                documents[doc.doctypeid]?.forEach((item: any) => {
                    if (!item.__periodo) item.__periodo = doc.periodo
                })
            } else if (documents[doc.doctypeid]) {
                documents[doc.doctypeid].__periodo = doc.periodo
            }
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

    const aggregations: Record<string, any> = {}

    const liquidaciones = documents['liquidacion-sueldo']
    if (Array.isArray(liquidaciones) && liquidaciones.length) {
        const items = liquidaciones.filter(l => {
            const val = resolveField(l, 'liquidacion-sueldo', 'liquido_a_pagar')
            return val !== undefined && val !== null && val !== ''
        })
        if (items.length > 0) {
            const getTotalPagar = (l: any) => parseFloat(resolveField(l, 'liquidacion-sueldo', 'liquido_a_pagar')) || 0
            const getImponible = (l: any) => parseFloat(resolveField(l, 'liquidacion-sueldo', 'base_imponible')) || 0
            
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
                total_liquido: items.reduce((sum, b) => sum + (parseFloat(resolveField(b, 'boletas-anual', 'total_liquido')) || 0), 0),
                total_honorario_bruto: items.reduce((sum, b) => sum + (parseFloat(resolveField(b, 'boletas-anual', 'honorario_bruto')) || 0), 0),
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
                saldo_final_promedio: items.reduce((sum, c) => sum + (parseFloat(resolveField(c, 'cuenta-bancaria', 'saldo_final')) || 0), 0) / items.length,
                total_abonos: items.reduce((sum, c) => sum + (parseFloat(resolveField(c, 'cuenta-bancaria', 'total_abonos')) || 0), 0),
                total_cargos: items.reduce((sum, c) => sum + (parseFloat(resolveField(c, 'cuenta-bancaria', 'total_cargos')) || 0), 0)
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
            providedDocs: incomingDocs.map(d => d.doctypeid),
            aggregations
        },
        documents
    })
}