import { useState, useEffect, useCallback } from 'react'

export default function Home() {
  const [model, setModel] = useState<'claude' | 'gpt5'>('claude')
  const [doctype, setDoctype] = useState<string>('')
  const [doctypes, setDoctypes] = useState<Array<{ doctypeid: string, label: string }>>([])
  const [url, setUrl] = useState('')
  const [json, setJson] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setUrl(`${window.location.origin}/api/ocr`)
    fetch('/api/v1/doctypes/listall')
      .then(r => r.json())
      .then(setDoctypes)
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const i = setInterval(() => setElapsed(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [loading])

  const handleSend = useCallback(async () => {
    if (!file) {
      alert('Falta: Archivo')
      return
    }
    if (!url) {
      alert('Falta: URL')
      return
    }

    setLoading(true)
    setError(null)
    setJson(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('model', model)
      if (doctype) form.append('doctype', doctype)

      const res = await fetch(url, {
        method: 'POST',
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
  }, [url, model, file, doctype])

  useEffect(() => {
    if (file && url) handleSend()
  }, [file])

  useEffect(() => {
    if (file && url) handleSend()
  }, [model, doctype])

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
    <main className='h-screen flex flex-col bg-[#0f0f0f] text-gray-100'>
      <header className='bg-[#1a1a1a] border-b border-[#2a2a2a] shadow-lg'>
        <div className='flex items-center gap-2 px-4 py-2'>
          <div className='flex gap-1.5'>
            <div className='w-3 h-3 rounded-full bg-[#ff5f57]'></div>
            <div className='w-3 h-3 rounded-full bg-[#febc2e]'></div>
            <div className='w-3 h-3 rounded-full bg-[#28c840]'></div>
          </div>

          <div className='flex-1 flex items-center gap-2 ml-4'>
            <svg className='w-4 h-4 text-gray-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
            </svg>
            <input
              className='flex-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition'
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder='https://...'
            />
            <button
              className='bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 px-5 py-2 rounded-lg text-sm font-semibold text-black transition shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </header>

      <section className='flex flex-1 overflow-hidden'>
        <aside className='w-96 bg-[#151515] border-r border-[#2a2a2a] flex flex-col'>
          <div className='p-6 space-y-5'>
            <div className='text-xs font-semibold text-yellow-500 uppercase tracking-wider mb-6'>
              Configuración
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-300 mb-2'>
                Seleccione IA
              </label>
              <select
                className='w-full px-4 py-2.5 rounded-lg font-medium text-sm border-2 border-[#3a3a3a] bg-[#1a1a1a] focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition text-yellow-400 cursor-pointer'
                value={model}
                onChange={e => setModel(e.target.value as 'claude' | 'gpt5')}
              >
                <option value='claude'>🤖 Claude</option>
                <option value='gpt5'>✨ GPT-5</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-300 mb-2'>
                Tipo Documento
              </label>
              <select
                className='w-full px-4 py-2.5 rounded-lg text-sm border-2 border-[#3a3a3a] bg-[#1a1a1a] focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition cursor-pointer text-gray-300'
                value={doctype}
                onChange={e => setDoctype(e.target.value)}
              >
                <option value=''>🔍 Auto-detectar</option>
                {doctypes.map(d => <option key={d.doctypeid} value={d.label}>📄 {d.label}</option>)}
              </select>
            </div>
          </div>

          <div className='flex-1 p-6 pt-0'>
            <div
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
              onDragOver={e => e.preventDefault()}
              onClick={() => document.getElementById('fileInput')?.click()}
              className='h-full border-2 border-dashed border-[#3a3a3a] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-yellow-500 hover:bg-[#1a1a1a] transition-all group overflow-hidden'
            >
              {file ? (
                preview && file.type === 'application/pdf' ? (
                  <iframe
                    src={preview}
                    className='w-48 h-64 border-2 border-yellow-500 rounded-lg mb-3 pointer-events-none bg-white shadow-lg'
                  />
                ) : preview ? (
                  <img
                    src={preview}
                    alt={file.name}
                    className='max-w-full max-h-48 object-contain mb-3 rounded-lg border-2 border-yellow-500 shadow-lg'
                  />
                ) : (
                  <svg className='w-20 h-20 text-red-400 mb-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' />
                  </svg>
                )
              ) : (
                <>
                  <svg className='w-16 h-16 text-yellow-500 mb-4 group-hover:scale-110 transition-transform' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' />
                  </svg>
                  <p className='text-gray-400 text-center px-4 group-hover:text-yellow-500 transition'>
                    Arrastra un archivo aquí o haz clic para seleccionar
                  </p>
                </>
              )}
              {file && (
                <div className='text-center px-4'>
                  <p className='text-yellow-400 font-medium text-sm mb-1 truncate max-w-xs'>
                    {file.name}
                  </p>
                  <p className='text-xs text-gray-500'>
                    {formatSize(file.size)} • {formatDate(file.lastModified)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <input
            id='fileInput'
            type='file'
            accept='image/*,application/pdf'
            className='hidden'
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </aside>

        <div className='flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden'>
          {error && (
            <div className='mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm'>
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className='flex-1 flex flex-col items-center justify-center'>
              <div className='relative'>
                <div className='w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin'></div>
              </div>
              <p className='text-yellow-500 font-semibold mt-6 text-lg'>
                Procesando documento...
              </p>
              <p className='text-gray-500 text-sm mt-2'>
                {elapsed}s transcurridos
              </p>
            </div>
          ) : json ? (
            <div className='flex-1 overflow-auto p-6'>
              <div className='bg-[#151515] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl'>
                <div className='bg-[#1a1a1a] border-b border-[#2a2a2a] px-4 py-3 flex items-center gap-2'>
                  <div className='w-3 h-3 rounded-full bg-yellow-500'></div>
                  <span className='text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                    Resultado JSON
                  </span>
                </div>
                <pre className='text-yellow-400 text-sm font-mono p-6 whitespace-pre-wrap break-all overflow-auto'>
                  {JSON.stringify(json, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className='flex-1 flex flex-col items-center justify-center text-center px-6'>
              <div className='w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6'>
                <svg className='w-10 h-10 text-yellow-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
                </svg>
              </div>
              <h3 className='text-xl font-bold text-gray-200 mb-2'>
                Listo para procesar
              </h3>
              <p className='text-gray-500 max-w-md'>
                Sube un PDF o imagen en el panel izquierdo. El resultado JSON aparecerá aquí automáticamente.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}