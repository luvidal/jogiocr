import { useState, useEffect, useCallback } from 'react'

export default function ParserUI() {
  const [model, setModel] = useState<'claude' | 'gpt5'>('claude')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [json, setJson] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setUrl(`${window.location.origin}/api/parser`)
    const stored = localStorage.getItem('api-key')
    if (stored) setApiKey(stored)
  }, [])

  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const i = setInterval(() => setElapsed(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [loading])

  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    localStorage.setItem('api-key', key)
  }

  const handleSend = useCallback(async () => {
    if (!file) {
      alert('Falta: Archivo')
      return
    }
    if (!url) {
      alert('Falta: URL')
      return
    }
    if (!apiKey) {
      alert('Falta: API Key')
      return
    }

    setLoading(true)
    setError(null)
    setJson(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('model', model)

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: form
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar')
      setJson(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [url, model, file, apiKey])

  useEffect(() => {
    if (file && apiKey && url) handleSend()
  }, [file])

  useEffect(() => {
    if (file && apiKey && url) handleSend()
  }, [model])

  const handleFile = (f?: File) => {
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else if (f.type === 'application/pdf') {
      const blobUrl = URL.createObjectURL(f)
      setPreview(blobUrl)
    } else {
      setPreview(null)
    }
  }

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <main className='h-screen flex flex-col bg-[#1b1b1b] text-gray-200 font-mono'>
      <header className='border-b border-gray-700 bg-[#242424] p-3'>
        <div className='flex items-center gap-3 mb-2'>
          <select
            className='w-24 px-2 py-1 rounded font-bold text-sm border border-gray-700 bg-[#1b1b1b] focus:outline-none text-amber-400'
            value={model}
            onChange={e => setModel(e.target.value as 'claude' | 'gpt5')}
          >
            <option value='claude'>Claude</option>
            <option value='gpt5'>GPT-5</option>
          </select>

          <input
            className='flex-1 bg-[#1b1b1b] border border-gray-700 rounded px-3 py-1 text-sm focus:outline-none'
            value={url}
            onChange={e => setUrl(e.target.value)}
          />

          <button
            className='bg-amber-500 hover:bg-amber-400 px-4 py-1 rounded text-sm font-bold text-black flex items-center justify-center'
            onClick={handleSend}
            disabled={loading}
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' />
            </svg>
          </button>

          <input
            id='fileInput'
            type='file'
            accept='image/*,application/pdf'
            className='hidden'
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>

        <div className='flex items-center gap-3'>
          <span className='w-24 px-2 py-1 text-xs text-gray-400'>Secret</span>

          <input
            type='password'
            className='flex-1 bg-[#1b1b1b] border border-gray-700 rounded px-3 py-1 text-sm focus:outline-none'
            placeholder='API Key'
            value={apiKey}
            onChange={e => handleApiKeyChange(e.target.value)}
          />
        </div>
      </header>

      <section className='flex flex-1 overflow-hidden'>
        <div
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('fileInput')?.click()}
          className='flex border-r border-gray-700 bg-[#202020] hover:bg-[#272727] flex-col cursor-pointer transition pt-6'
          style={{ width: '420px', minWidth: '380px' }}
        >
          <div className='border-2 border-dashed border-gray-600 rounded-lg w-80 h-64 mx-auto flex flex-col items-center justify-center text-center text-gray-400 hover:border-amber-400 transition p-4 overflow-hidden'>
            {file ? (
              preview && file.type === 'application/pdf' ? (
                <iframe
                  src={preview}
                  className='w-40 h-52 border rounded mb-2 pointer-events-none bg-white'
                />
              ) : preview ? (
                <img
                  src={preview}
                  alt={file.name}
                  className='max-w-full max-h-40 object-contain mb-2 rounded'
                />
              ) : (
                <svg className='w-16 h-16 text-red-400 mb-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' />
                </svg>
              )
            ) : (
              <span>Arrastra o haz clic para subir un archivo</span>
            )}
            {file && (
              <>
                <span className='text-amber-400 text-sm truncate'>{file.name}</span>
                <span className='text-xs text-gray-500 mt-1'>
                  {formatSize(file.size)} • {formatDate(file.lastModified)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className='flex-1 flex flex-col bg-[#151515] p-6 overflow-hidden'>
          {error && <p className='text-red-400 text-sm mb-4'>{error}</p>}
          {loading ? (
            <div className='flex flex-col items-center justify-center flex-1 text-amber-400'>
              <p className='font-semibold mb-1'>Esperando respuesta…</p>
              <p className='text-sm'>{elapsed}s</p>
            </div>
          ) : json ? (
            <pre className='text-amber-300 text-xs whitespace-pre-wrap break-all overflow-auto flex-1 p-4 bg-[#0d0d0d] rounded border border-gray-800'>
              {JSON.stringify(json, null, 2)}
            </pre>
          ) : (
            <div className='flex flex-col items-center justify-center flex-1 text-gray-500 text-sm'>
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