import { NextApiRequest } from 'next'
import { Pool } from 'pg'

export const isDev = process.env.ENVIRONMENT === 'development'

const createPool = () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 300000,
    connectionTimeoutMillis: 10000,
    application_name: 'jogiapp'
  })

  pool.on('connect', async client => {
    const key = process.env.INTERNAL_API_KEY
    if (key) await client.query(`SET app.encryption_key = '${key}'`)
  })

  return pool
}

const pool = isDev
  ? ((globalThis as any).pgPool ??= createPool())
  : createPool()

export async function execute<T = any>(
  procedure: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const keys = Object.keys(params)
  const values = Object.values(params)
  const assignments = keys.map((k, i) => `p_${k} := $${i + 1}`).join(', ')
  const sql = `SELECT * FROM ${procedure}(${assignments})`

  try {
    const { rows } = await pool.query(sql, values)
    return rows as T[]
  } catch (err: any) {
    console.error('DB Error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[${procedure}] ${msg}`)
  }
}

interface ParamsLogapi {
  companyid: string | null
  req: NextApiRequest
  status: number
  start: number
}

export async function logapi({ companyid, req, status, start }: ParamsLogapi) {
  const duration_ms = Date.now() - start
  const endpoint = req.url?.split('?')[0] || ''
  const method = req.method || ''
  const ipaddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''
  const useragent = req.headers['user-agent'] || ''

  await execute('dbo.sp_log_api', { companyid, endpoint, method, status, ipaddress, useragent, duration_ms })
}

type SqlError = {
  number?: number
  severity?: number
  state?: number
  procedure?: string
  lineNumber?: number
  message: string
}

export async function logerror(spName: string, err: any) {
  const e: SqlError = {
    number: err.number,
    severity: err.severity,
    state: err.state,
    procedure: err.procedure,
    lineNumber: err.lineNumber,
    message: err.message || String(err)
  }

  await execute('dbo.sp_log_error', {
    spName,
    errorNumber: e.number ?? 0,
    errorSeverity: e.severity ?? 0,
    errorState: e.state ?? 0,
    errorProcedure: e.procedure ?? '',
    errorLine: e.lineNumber ?? 0,
    errorMessage: e.message
  })
}
