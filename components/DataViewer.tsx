import React, { useState } from 'react'

type ViewerMode = 'table' | 'json'

type Props = {
  data: unknown
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

const TableView = ({ data }: { data: unknown }) => {
  if (!data || typeof data !== 'object') {
    return <div className='text-xs text-gray-500'>No data</div>
  }

  return (
    <div className='rounded-xl border border-[#1f1f1f] bg-[#0c0c0c] overflow-auto shadow-2xl'>
      <table className='w-full text-xs'>
        <tbody>
          {Object.entries(data).map(([k, v]) => (
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

const DataViewer = ({ data }: Props) => {
  const [mode, setMode] = useState<ViewerMode>('table')
  const [activeDoc, setActiveDoc] = useState(0)
  const [activePeriod, setActivePeriod] = useState(0)

  if (!data) return <div className='text-sm text-gray-500'>No data</div>

  const dataObj = data as Record<string, any>

  // Check if this is the new multi-document format
  const isMultiDocFormat = 'documents' in dataObj && Array.isArray(dataObj.documents)

  if (isMultiDocFormat) {
    const documents = dataObj.documents as Array<{
      doctypeid: string
      matched: boolean
      multiple: boolean
      periodo: string | null
      data: Record<string, any> | Record<string, any>[]
    }>

    if (documents.length === 0) {
      return <div className='text-sm text-gray-500'>No documents found</div>
    }

    const currentDoc = documents[activeDoc]
    const entries = Array.isArray(currentDoc.data) ? currentDoc.data : [currentDoc.data]
    const hasMultiplePeriods = currentDoc.multiple && entries.length > 1
    const currentData = hasMultiplePeriods ? entries[activePeriod] : entries[0]
    const titlePeriod = currentDoc.periodo || currentData?.periodo

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
                  {doc.doctypeid}
                </button>
              )
            })}
          </div>
        )}

        <div className='flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2 min-w-0'>
              <div className='text-sm font-semibold text-gray-100 truncate'>
                {currentDoc.doctypeid}
              </div>
              {titlePeriod ? <div className='text-xs text-gray-500 font-medium truncate'>• {titlePeriod}</div> : null}
            </div>
            <div className='mt-1 flex flex-wrap gap-1.5'>
              <Badge color={currentDoc.matched ? 'green' : 'red'}>
                {currentDoc.matched ? 'OK' : 'Revisar'}
              </Badge>
              {currentDoc.multiple && <Badge color='yellow'>Multi</Badge>}
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
                  const label = item?.periodo || `Registro ${idx + 1}`
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

            <TableView data={currentData} />
          </div>
        )}
      </div>
    )
  }

  // Legacy format support (old single-document format)
  const isDocEnvelope = typeof data === 'object' && ('doctypeid' in data || 'matched' in data || 'data' in data)
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
                const label = item?.periodo || `Registro ${idx + 1}`
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

          <TableView data={current} />
        </div>
      )}
    </div>
  )
}

export default DataViewer
