import { useState, useEffect, useCallback } from 'react'

export default function ParserUI() {
  const base = process.env.NEXT_PUBLIC_ENVIRONMENT === 'development'
    ? 'http://localhost:3000'
    : 'https://ocr.jogi.cl'

  const [method, setMethod] = useState<'POST' | 'GET'>('POST')
  const [url, setUrl] = useState(`${base}/api/parser`)
  const [json, setJson] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const i = setInterval(() => setElapsed(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [loading])

  const handleSend = useCallback(async () => {
    setLoading(true)
    setError(null)
    setJson(null)
    try {
      const res = method === 'GET'
        ? await fetch(url)
        : await fetch(url, {
          method: 'POST',
          body: (() => {
            if (!file) throw new Error('Selecciona o arrastra un archivo')
            const form = new FormData()
            form.append('file', file)
            return form
          })()
        })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar')
      setJson(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [url, method, file])

  const handleFile = (f?: File) => f && setFile(f)

  return (
    <main className='min-h-screen flex flex-col bg-[#1b1b1b] text-gray-200 font-mono'>
      <header className='flex items-center border-b border-gray-700 bg-[#242424] p-3 gap-3'>
        <select
          className={`px-2 py-1 rounded font-bold text-sm border border-gray-700 bg-[#1b1b1b] focus:outline-none ${method === 'POST' ? 'text-amber-400' : 'text-blue-400'}`}
          value={method}
          onChange={e => setMethod(e.target.value as 'POST' | 'GET')}
        >
          <option value='POST'>POST</option>
          <option value='GET'>GET</option>
        </select>

        <input
          className='flex-1 bg-[#1b1b1b] border border-gray-700 rounded px-3 py-1 text-sm focus:outline-none'
          value={url}
          onChange={e => setUrl(e.target.value)}
        />

        <button
          className='bg-amber-500 hover:bg-amber-400 px-4 py-1 rounded text-sm font-bold text-black'
          onClick={handleSend}
          disabled={loading}
        >
          Enviar
        </button>

        <input
          id='fileInput'
          type='file'
          accept='image/*,application/pdf'
          className='hidden'
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </header>

      <section className='flex flex-1'>
        <div
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('fileInput')?.click()}
          className='flex items-center justify-center border-r border-gray-700 bg-[#202020] hover:bg-[#272727] flex-col cursor-pointer transition'
          style={{ width: '420px', minWidth: '380px' }}
        >
          <div className='border-2 border-dashed border-gray-600 rounded-lg w-80 h-64 my-12 flex flex-col items-center justify-center text-center text-gray-400 hover:border-amber-400 transition'>
            {file
              ? <>
                <span className='text-amber-400 mb-1'>{file.name}</span>
                <span className='text-xs text-gray-500'>Listo para enviar</span>
              </>
              : <span>Arrastra o haz clic para subir un archivo</span>}
          </div>
        </div>

        <div className='flex-1 bg-[#151515] p-6 overflow-auto'>
          {error && <p className='text-red-400 text-sm'>{error}</p>}
          {loading ? (
            <div className='flex flex-col items-center justify-center h-full text-amber-400'>
              <p className='font-semibold mb-1'>Esperando respuesta…</p>
              <p className='text-sm'>{elapsed}s</p>
            </div>
          ) : json ? (
            <pre className='text-amber-300 text-xs whitespace-pre-wrap break-all'>
              {JSON.stringify(json, null, 2)}
            </pre>
          ) : (
            <div className='flex flex-col items-center justify-center h-full text-gray-500 text-sm'>
              <p className='text-amber-400 mb-2 font-semibold'>Listo para procesar</p>
              <p>Sube un PDF o imagen y presiona <strong>Enviar</strong>.</p>
              <p className='mt-1 text-xs text-gray-600'>El resultado JSON aparecerá aquí.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}