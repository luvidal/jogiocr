import React, { useState } from 'react'
import fieldAliases from '@/data/field-aliases.json'

type ViewerMode = 'table' | 'json'

const resolveField = (obj: any, docType: string, fieldName: string): any => {
  if (!obj) return undefined
  if (obj[fieldName] !== undefined && obj[fieldName] !== '') return obj[fieldName]

  const aliases = (fieldAliases as any)[docType]?.[fieldName]
  if (aliases && Array.isArray(aliases)) {
    for (const alias of aliases) {
      if (obj[alias] !== undefined && obj[alias] !== '') return obj[alias]
    }
  }
  return undefined
}

type Props = {
  data: unknown
  simpleMode?: boolean
}

const formatKey = (key: string) => key.replace(/_/g, ' ')

const Badge = ({ children, color }: { children: React.ReactNode, color: 'green' | 'yellow' | 'red' }) => {
  const palette = {
    green: 'bg-green-500/10 text-green-300 border-green-500/30',
    yellow: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    red: 'bg-red-500/10 text-red-300 border-red-500/30'
  }[color]

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${palette}`}>
      {children}
    </span>
  )
}

const ValueCell = ({ value }: { value: unknown }) => {
  if (value == null) return <span className='text-gray-500'>—</span>

  if (typeof value !== 'object') return <span className='text-gray-200'>{String(value)}</span>

  if (Array.isArray(value)) {
    return (
      <div className='rounded-lg border border-[#1f1f1f] overflow-hidden bg-[#0a0a0a]'>
        <table className='w-full text-xs'>
          <tbody>
            {value.map((v, i) => (
              <tr key={i} className='border-b border-[#141414] hover:bg-white/5 transition-colors'>
                <td className='px-3 py-2 w-14 text-gray-500 font-semibold'>[{i}]</td>
                <td className='px-3 py-2'><ValueCell value={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className='rounded-lg border border-[#1f1f1f] overflow-hidden bg-[#0a0a0a]'>
      <table className='w-full text-xs'>
        <tbody>
          {Object.entries(value).map(([k, v]) => (
            <tr key={k} className='border-b border-[#141414] hover:bg-white/5 transition-colors'>
              <td className='px-3 py-2 text-gray-300 font-semibold whitespace-nowrap'>{formatKey(k)}</td>
              <td className='px-3 py-2'><ValueCell value={v} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TableView = ({ data, simpleMode }: { data: unknown, simpleMode?: boolean }) => {
  if (!data || typeof data !== 'object') {
    return <div className='text-xs text-gray-500'>No data</div>
  }

  const entries = Object.entries(data)

  if (simpleMode) {
    return (
      <div className='rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] overflow-auto shadow-2xl'>
        <table className='w-full text-xs'>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className='border-b border-[#1f1f1f] align-top hover:bg-white/5 transition-colors'>
                <td className='px-4 py-3 text-gray-100 font-semibold whitespace-nowrap w-1/3'>
                  <span className='border-b border-yellow-500/40 pb-0.5'>
                    {formatKey(k)}
                  </span>
                </td>
                <td className='px-4 py-3'><ValueCell value={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const halfLength = Math.ceil(entries.length / 2)
  const rows = []

  for (let i = 0; i < halfLength; i++) {
    const left = entries[i]
    const right = entries[i + halfLength]
    rows.push({ left, right })
  }

  return (
    <div className='rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] overflow-auto shadow-2xl'>
      <table className='w-full text-xs table-fixed'>
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className='border-b border-[#1f1f1f] hover:bg-white/5 transition-colors'>
              <td className='px-3 py-2 text-yellow-600 font-semibold align-top overflow-hidden' title={formatKey(row.left[0])}>
                <div className='truncate'>{formatKey(row.left[0])}</div>
              </td>
              <td className='px-3 py-2 align-top overflow-hidden'>
                {typeof row.left[1] === 'string' ? (
                  <div className='truncate text-gray-200' title={String(row.left[1])}>{String(row.left[1])}</div>
                ) : (
                  <ValueCell value={row.left[1]} />
                )}
              </td>
              {row.right ? (
                <>
                  <td className='px-3 py-2 text-yellow-600 font-semibold align-top overflow-hidden' title={formatKey(row.right[0])}>
                    <div className='truncate'>{formatKey(row.right[0])}</div>
                  </td>
                  <td className='px-3 py-2 align-top overflow-hidden'>
                    {typeof row.right[1] === 'string' ? (
                      <div className='truncate text-gray-200' title={String(row.right[1])}>{String(row.right[1])}</div>
                    ) : (
                      <ValueCell value={row.right[1]} />
                    )}
                  </td>
                </>
              ) : (
                <>
                  <td className='px-3 py-2 overflow-hidden'></td>
                  <td className='px-3 py-2 overflow-hidden'></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DataViewer = ({ data, simpleMode }: Props) => {
  const [mode, setMode] = useState<ViewerMode>('table')
  const [activeDoc, setActiveDoc] = useState(0)
  const [activePeriod, setActivePeriod] = useState(0)
  const [activeTab, setActiveTab] = useState<'report' | 'meta' | 'json'>('report')

  if (!data) return <div className='text-sm text-gray-500'>No data</div>

  const dataObj = data as Record<string, any>

  const isMultiDocFormat = 'documents' in dataObj && Array.isArray(dataObj.documents)
  const isMegaJsonFormat = 'meta' in dataObj && 'documents' in dataObj

  if (isMegaJsonFormat) {
    return (
      <div className='flex flex-col' style={{ height: 'calc(85vh - 200px)' }}>
        <div className='shrink-0 mb-4 flex items-center justify-between'>
          <div className='inline-flex rounded-lg border border-[#2a2a2a] overflow-hidden bg-[#0c0c0c]'>
            <button
              type='button'
              onClick={() => setActiveTab('report')}
              className={`px-6 py-2.5 text-sm font-semibold transition-colors ${activeTab === 'report' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
            >
              Report
            </button>
            <button
              type='button'
              onClick={() => setActiveTab('meta')}
              className={`px-6 py-2.5 text-sm font-semibold transition-colors ${activeTab === 'meta' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
            >
              Meta
            </button>
          </div>

          <button
            type='button'
            onClick={() => setActiveTab('json')}
            className='px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#2a2a2a] bg-[#0c0c0c] text-gray-400 hover:text-gray-100 hover:bg-white/5 transition-colors'
          >
            {activeTab === 'json' ? '◧ Table' : '{ } JSON'}
          </button>
        </div>

        <div className='flex-1 overflow-auto'>
          <div className='space-y-4'>
            {activeTab === 'report' ? (
              <div className='space-y-4'>
                {dataObj.documents['liquidacion-sueldo'] && Array.isArray(dataObj.documents['liquidacion-sueldo']) && (
                  <div>
                    <div className='text-sm font-semibold text-gray-100 mb-2'>Liquidaciones de Sueldo</div>
                    <div className='rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] overflow-auto shadow-2xl'>
                      <table className='w-full text-xs'>
                        <thead className='bg-[#0f0f0f] border-b border-yellow-500/20'>
                          <tr>
                            <th className='px-4 py-3 text-left text-gray-400 font-semibold'>Periodo</th>
                            <th className='px-4 py-3 text-right text-gray-400 font-semibold'>Total a Pagar</th>
                            <th className='px-4 py-3 text-right text-gray-400 font-semibold'>Total Imponible</th>
                            <th className='px-4 py-3 text-right text-gray-400 font-semibold'>Total Haberes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataObj.documents['liquidacion-sueldo'].map((item: any, idx: number) => {
                            const periodo = resolveField(item, 'liquidacion-sueldo', 'docdate') || '-'
                            const totalPagar = resolveField(item, 'liquidacion-sueldo', 'liquido_a_pagar')
                            const totalImponible = resolveField(item, 'liquidacion-sueldo', 'base_imponible')
                            const totalHaberes = resolveField(item, 'liquidacion-sueldo', 'base_tributable')
                            return (
                              <tr key={idx} className='border-b border-[#1f1f1f] hover:bg-white/5 transition-colors'>
                                <td className='px-4 py-3 text-gray-200 font-semibold'>{periodo}</td>
                                <td className='px-4 py-3 text-right text-green-400 font-semibold'>
                                  {totalPagar ? `${Number(totalPagar).toLocaleString('es-CL')}` : '-'}
                                </td>
                                <td className='px-4 py-3 text-right text-gray-300'>
                                  {totalImponible ? `${Number(totalImponible).toLocaleString('es-CL')}` : '-'}
                                </td>
                                <td className='px-4 py-3 text-right text-gray-300'>
                                  {totalHaberes ? `${Number(totalHaberes).toLocaleString('es-CL')}` : '-'}
                                </td>
                              </tr>
                            )
                          })}
                          {dataObj.meta.aggregations?.liquidacion_sueldo && (
                            <tr className='bg-yellow-500/10 border-t-2 border-yellow-500/30'>
                              <td className='px-4 py-3 text-yellow-500 font-bold'>TOTAL / AVG</td>
                              <td className='px-4 py-3 text-right text-yellow-500 font-bold'>
                                ${dataObj.meta.aggregations.liquidacion_sueldo.total_liquido?.toLocaleString()} /
                                ${Math.round(dataObj.meta.aggregations.liquidacion_sueldo.avg_liquido)?.toLocaleString()}
                              </td>
                              <td className='px-4 py-3 text-right text-yellow-500 font-bold'>
                                ${dataObj.meta.aggregations.liquidacion_sueldo.total_base_imponible?.toLocaleString()} /
                                ${Math.round(dataObj.meta.aggregations.liquidacion_sueldo.avg_base_imponible)?.toLocaleString()}
                              </td>
                              <td className='px-4 py-3 text-right'></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {dataObj.documents['boletas-anual'] && Array.isArray(dataObj.documents['boletas-anual']) && (
                  <div>
                    <div className='text-sm font-semibold text-gray-100 mb-2'>Boletas Anuales</div>
                    <div className='rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] overflow-auto shadow-2xl'>
                      <table className='w-full text-xs'>
                        <thead className='bg-[#0f0f0f] border-b border-yellow-500/20'>
                          <tr>
                            <th className='px-4 py-3 text-left text-gray-400 font-semibold'>Año</th>
                            <th className='px-4 py-3 text-right text-gray-400 font-semibold'>Honorario Bruto</th>
                            <th className='px-4 py-3 text-right text-gray-400 font-semibold'>Total Líquido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataObj.documents['boletas-anual'].map((item: any, idx: number) => (
                            <tr key={idx} className='border-b border-[#1f1f1f] hover:bg-white/5 transition-colors'>
                              <td className='px-4 py-3 text-gray-200 font-semibold'>{item.año || '-'}</td>
                              <td className='px-4 py-3 text-right text-gray-300'>
                                {item.honorario_bruto ? `${Number(item.honorario_bruto).toLocaleString('es-CL')}` : '-'}
                              </td>
                              <td className='px-4 py-3 text-right text-green-400 font-semibold'>
                                {item.total_liquido ? `${Number(item.total_liquido).toLocaleString('es-CL')}` : '-'}
                              </td>
                            </tr>
                          ))}
                          {dataObj.meta.aggregations?.boletas_anual && (
                            <tr className='bg-yellow-500/10 border-t-2 border-yellow-500/30'>
                              <td className='px-4 py-3 text-yellow-500 font-bold'>TOTAL</td>
                              <td className='px-4 py-3 text-right text-yellow-500 font-bold'>
                                ${dataObj.meta.aggregations.boletas_anual.total_honorario_bruto?.toLocaleString()}
                              </td>
                              <td className='px-4 py-3 text-right text-yellow-500 font-bold'>
                                ${dataObj.meta.aggregations.boletas_anual.total_liquido?.toLocaleString()}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {dataObj.documents['cuenta-bancaria'] && Array.isArray(dataObj.documents['cuenta-bancaria']) && (
                  <div>
                    <div className='text-sm font-semibold text-gray-100 mb-2'>Cuenta Bancaria</div>
                    <div className='rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] overflow-auto shadow-2xl'>
                      <table className='w-full text-xs'>
                        <thead className='bg-[#0f0f0f] border-b border-yellow-500/20'>
                          <tr>
                            <th className='px-4 py-3 text-left text-gray-400 font-semibold'>Fecha</th>
                            <th className='px-4 py-3 text-right text-gray-400 font-semibold'>Saldo Final</th>
                            <th className='px-4 py-3 text-right text-gray-400 font-semibold'>Abonos</th>
                            <th className='px-4 py-3 text-right text-gray-400 font-semibold'>Cargos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataObj.documents['cuenta-bancaria'].map((item: any, idx: number) => {
                            console.log('cuenta-bancaria item:', JSON.stringify(item, null, 2))
                            const saldoFinal = resolveField(item, 'cuenta-bancaria', 'saldo_final')
                            const totalAbonos = resolveField(item, 'cuenta-bancaria', 'total_abonos')
                            const totalCargos = resolveField(item, 'cuenta-bancaria', 'total_cargos')
                            console.log('resolved:', JSON.stringify({ saldoFinal, totalAbonos, totalCargos }, null, 2))

                            return (
                              <tr key={idx} className='border-b border-[#1f1f1f] hover:bg-white/5 transition-colors'>
                                <td className='px-4 py-3 text-gray-200 font-semibold'>{item.fecha || item.docdate || '-'}</td>
                                <td className='px-4 py-3 text-right text-green-400 font-semibold'>
                                  {saldoFinal != null && saldoFinal !== '' ? `${Number(saldoFinal).toLocaleString('es-CL')}` : '-'}
                                </td>
                                <td className='px-4 py-3 text-right text-blue-400'>
                                  {totalAbonos != null && totalAbonos !== '' ? `${Number(totalAbonos).toLocaleString('es-CL')}` : '-'}
                                </td>
                                <td className='px-4 py-3 text-right text-red-400'>
                                  {totalCargos != null && totalCargos !== '' ? `${Number(totalCargos).toLocaleString('es-CL')}` : '-'}
                                </td>
                              </tr>
                            )
                          })}
                          {dataObj.meta.aggregations?.cuenta_bancaria && (
                            <tr className='bg-yellow-500/10 border-t-2 border-yellow-500/30'>
                              <td className='px-4 py-3 text-yellow-500 font-bold'>AVG / TOTAL</td>
                              <td className='px-4 py-3 text-right text-yellow-500 font-bold'>
                                ${Math.round(dataObj.meta.aggregations.cuenta_bancaria.saldo_final_promedio)?.toLocaleString()}
                              </td>
                              <td className='px-4 py-3 text-right text-yellow-500 font-bold'>
                                ${dataObj.meta.aggregations.cuenta_bancaria.total_abonos?.toLocaleString()}
                              </td>
                              <td className='px-4 py-3 text-right text-yellow-500 font-bold'>
                                ${dataObj.meta.aggregations.cuenta_bancaria.total_cargos?.toLocaleString()}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {Object.entries(dataObj.documents)
                  .filter(([docId]) => !['liquidacion-sueldo', 'boletas-anual', 'cuenta-bancaria'].includes(docId))
                  .map(([docId, docData]) => {
                    const entries = Array.isArray(docData) ? docData : [docData]
                    return (
                      <div key={docId}>
                        <div className='text-sm font-semibold text-gray-100 mb-2'>{formatKey(docId)}</div>
                        {entries.map((entry, idx) => (
                          <div key={idx} className='mb-3'>
                            <TableView data={entry} simpleMode={simpleMode} />
                          </div>
                        ))}
                      </div>
                    )
                  })}
              </div>
            ) : activeTab === 'meta' ? (
              <div>
                <TableView data={dataObj.meta} simpleMode={simpleMode} />
              </div>
            ) : (
              <pre className='bg-[#0c0c0c] border border-[#1f1f1f] rounded-xl text-gray-200 text-xs font-mono p-5 whitespace-pre-wrap break-all overflow-auto shadow-2xl'>
                {JSON.stringify(dataObj, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isMultiDocFormat) {
    const documents = (dataObj.documents as any[])?.map(d => ({
      id: d?.id || 'unknown',
      docdate: d?.docdate || null,
      data: d?.data || {}
    })) || []

    if (documents.length === 0) {
      return <div className='text-sm text-gray-500'>No documents found</div>
    }

    const currentDoc = documents[activeDoc]
    const entries = Array.isArray(currentDoc.data) ? currentDoc.data : [currentDoc.data]
    const hasMultiplePeriods = entries.length > 1
    const currentData = hasMultiplePeriods ? entries[activePeriod] : entries[0]
    const titlePeriod = currentDoc.docdate

    return (
      <div className='space-y-3'>
        {/* Document type tabs */}
        {documents.length > 1 && (
          <div className='inline-flex rounded-lg border border-[#2a2a2a] overflow-hidden bg-[#0c0c0c] flex-wrap'>
            {documents.map((doc, idx) => {
              const activeTab = idx === activeDoc
              return (
                <button
                  key={idx}
                  type='button'
                  onClick={() => {
                    setActiveDoc(idx)
                    setActivePeriod(0)
                  }}
                  className={`px-4 py-2 text-xs font-semibold transition-colors ${activeTab ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
                >
                  {doc.id}
                </button>
              )
            })}
          </div>
        )}

        <div className='flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2 min-w-0'>
              <div className='text-sm font-semibold text-gray-100 truncate'>
                {currentDoc.id}
              </div>
              {titlePeriod ? <div className='text-xs text-gray-500 font-medium truncate'>• {titlePeriod}</div> : null}
            </div>
            <div className='mt-1 flex flex-wrap gap-1.5'>
              {entries.length > 0 && <Badge color='green'>{entries.length}</Badge>}
            </div>
          </div>

          <div className='inline-flex rounded-lg border border-[#2a2a2a] overflow-hidden h-9 bg-[#0c0c0c]'>
            <button
              className={`px-4 text-xs font-semibold transition-colors ${mode === 'table' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
              onClick={() => setMode('table')}
              type='button'
            >
              Table
            </button>
            <button
              className={`px-4 text-xs font-semibold transition-colors ${mode === 'json' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
              onClick={() => setMode('json')}
              type='button'
            >
              JSON
            </button>
          </div>
        </div>

        {mode === 'json' ? (
          <pre className='bg-[#0c0c0c] border border-[#1f1f1f] rounded-xl text-gray-200 text-xs font-mono p-5 whitespace-pre-wrap break-all overflow-auto shadow-2xl'>
            {JSON.stringify(currentDoc, null, 2)}
          </pre>
        ) : (
          <div className='space-y-2'>
            {hasMultiplePeriods && (
              <div className='inline-flex rounded-lg border border-[#2a2a2a] overflow-hidden bg-[#0c0c0c] flex-wrap'>
                {entries.map((item, idx) => {
                  const label = item?.docdate || `Registro ${idx + 1}`
                  const activeTab = idx === activePeriod
                  return (
                    <button
                      key={idx}
                      type='button'
                      onClick={() => setActivePeriod(idx)}
                      className={`px-4 py-2 text-xs font-semibold transition-colors ${activeTab ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            <TableView data={currentData} simpleMode={simpleMode} />
          </div>
        )}
      </div>
    )
  }

  // Legacy format support (old single-document format)
  const isDocEnvelope = typeof data === 'object' && ('doctypeid' in dataObj || 'matched' in dataObj || 'data' in dataObj)
  const entries = Array.isArray(dataObj.data) ? dataObj.data : dataObj.data ? [dataObj.data] : []
  const hasMultiple = Boolean(dataObj.multiple && entries.length > 0)
  const current = hasMultiple ? entries[Math.min(activePeriod, entries.length - 1)] : entries[0] || data
  const titlePeriod = dataObj.periodo || current?.periodo

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2 min-w-0'>
            <div className='text-sm font-semibold text-gray-100 truncate'>
              {dataObj.doctypeid || 'Resultado'}
            </div>
            {titlePeriod ? <div className='text-xs text-gray-500 font-medium truncate'>• {titlePeriod}</div> : null}
          </div>
          <div className='mt-1 flex flex-wrap gap-1.5'>
            {'matched' in dataObj && (
              <Badge color={dataObj.matched ? 'green' : 'red'}>
                {dataObj.matched ? 'OK' : 'Revisar'}
              </Badge>
            )}
            {dataObj.multiple && <Badge color='yellow'>Multi</Badge>}
            {entries.length > 0 && <Badge color='green'>{entries.length}</Badge>}
          </div>
        </div>

        <div className='inline-flex rounded-lg border border-[#2a2a2a] overflow-hidden h-9 bg-[#0c0c0c]'>
          <button
            className={`px-4 text-xs font-semibold transition-colors ${mode === 'table' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
            onClick={() => setMode('table')}
            type='button'
          >
            Table
          </button>
          <button
            className={`px-4 text-xs font-semibold transition-colors ${mode === 'json' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
            onClick={() => setMode('json')}
            type='button'
          >
            JSON
          </button>
        </div>
      </div>

      {mode === 'json' ? (
        <pre className='bg-[#0c0c0c] border border-[#1f1f1f] rounded-xl text-gray-200 text-xs font-mono p-5 whitespace-pre-wrap break-all overflow-auto shadow-2xl'>
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <div className='space-y-2'>
          {hasMultiple && (
            <div className='inline-flex rounded-lg border border-[#2a2a2a] overflow-hidden bg-[#0c0c0c] flex-wrap'>
              {entries.map((item, idx) => {
                const label = item?.docdate || `Registro ${idx + 1}`
                const activeTab = idx === activePeriod
                return (
                  <button
                    key={idx}
                    type='button'
                    onClick={() => setActivePeriod(idx)}
                    className={`px-4 py-2 text-xs font-semibold transition-colors ${activeTab ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          <TableView data={current} simpleMode={simpleMode} />
        </div>
      )}
    </div>
  )
}

export default DataViewer