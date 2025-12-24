import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import LoginModal from '@/components/LoginModal'

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false })

export default function Home() {
  const [isAuth, setIsAuth] = useState(false)
  const [json, setJson] = useState<unknown>(null)
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [imageScale, setImageScale] = useState(1)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

    setLoading(true)
    setError(null)
    setJson(null)
    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/v1/ocr', {
        method: 'POST',
        body: form
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar')
      setJson(data)
      const first = (data as any)?.documents?.[0]
      const firstKey = first ? `${first?.id || 'doc'}-${first?.docdate || 0}-0` : null
      setActiveDocKey(firstKey)
      const files = (data as any)?.files
      files?.forEach((f: any) => {
        if (!f?.base64 || !f?.filename) return
        const bytes = Uint8Array.from(atob(f.base64), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = f.filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [file])

  useEffect(() => {
    if (file) handleSend()
  }, [file, handleSend])


  const handleFile = (f?: File) => {
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setImageScale(1)
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

  const statusColor = loading ? 'bg-yellow-500' : error ? 'bg-red-500' : json ? 'bg-green-500' : 'bg-gray-600'

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <main className='h-screen flex flex-col bg-[#0a0a0a] text-gray-100'>
      <div className='pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(234,179,8,0.10),transparent_55%),radial-gradient(700px_circle_at_80%_20%,rgba(59,130,246,0.08),transparent_55%)]' />
      <header className='relative bg-[#0a0a0a] border-b border-yellow-500/20 backdrop-blur'>
        <div className='flex items-center justify-between px-6 py-4'>
          <h1 className='text-lg font-bold tracking-tight text-yellow-500'>OCR</h1>
        </div>
      </header>

      <section className='flex flex-1 overflow-hidden'>
        <aside className='relative flex-1 basis-1/2 min-w-0 bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col'>

          <div className='flex-1 p-6 overflow-auto flex flex-col gap-4'>
            <div
              onDrop={e => {
                e.preventDefault()
                handleFile(e.dataTransfer.files?.[0])
              }}
              onDragOver={e => e.preventDefault()}
              className='h-full border border-dashed border-yellow-500/35 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-yellow-500/70 hover:bg-yellow-500/5 transition-all duration-300 group overflow-hidden'
            >
              {file ? (
                preview && file.type === 'application/pdf' ? (
                  <PDFViewer fileUrl={preview} />
                ) : preview ? (
                  <div className='w-full flex-1 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl shadow-2xl flex flex-col overflow-hidden'>
                    <div className='flex items-center gap-2 px-4 py-3 border-b border-[#1f1f1f] bg-[#0c0c0c]'>
                      <div className='text-xs font-semibold text-gray-200'>Zoom</div>
                      <div className='flex items-center gap-1 ml-auto'>
                        <button
                          type='button'
                          onClick={() => setImageScale(s => Math.max(0.5, s - 0.1))}
                          className='px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#0a0a0a] text-gray-200 border border-yellow-500/30 hover:border-yellow-500/70 hover:bg-yellow-500/5 transition'
                        >
                          −
                        </button>
                        <span className='text-xs text-yellow-500/70 w-14 text-center tabular-nums font-medium'>
                          {Math.round(imageScale * 100)}%
                        </span>
                        <button
                          type='button'
                          onClick={() => setImageScale(s => Math.min(3, s + 0.1))}
                          className='px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#0a0a0a] text-gray-200 border border-yellow-500/30 hover:border-yellow-500/70 hover:bg-yellow-500/5 transition'
                        >
                          +
                        </button>
                        <button
                          type='button'
                          onClick={() => setImageScale(1)}
                          className='px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#0a0a0a] text-yellow-500 border border-yellow-500/40 hover:border-yellow-500/70 hover:bg-yellow-500/5 transition'
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className='flex-1 overflow-auto flex items-center justify-center bg-[#0a0a0a] p-4'>
                      <Image
                        src={preview}
                        alt={file.name}
                        width={2000}
                        height={2000}
                        unoptimized
                        style={{ transform: `scale(${imageScale})` }}
                        className='max-w-full max-h-full object-contain rounded-lg shadow-lg'
                      />
                    </div>
                  </div>
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
                    Arrastra un archivo aquí
                  </p>
                </>
              )}
              {file && (
                <div className='text-center px-4'>
                  <p className='text-yellow-500 font-semibold text-sm mb-1 truncate max-w-xs'>
                    {file.name}
                  </p>
                  <p className='text-xs text-gray-500'>
                    {formatSize(file.size)} • {formatDate(file.lastModified)}
                  </p>
                </div>
              )}
            </div>

            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              className='w-full px-4 py-3 rounded-xl font-semibold text-sm border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 text-yellow-500 cursor-pointer hover:border-yellow-500/50 focus:outline-none focus:border-yellow-500/60 focus:ring-4 focus:ring-yellow-500/10 transition-all'
            >
              Seleccionar Archivo
            </button>
          </div>

          <input
            ref={fileInputRef}
            id='fileInput'
            type='file'
            accept='image/*,application/pdf'
            className='hidden'
            onClick={e => {
              e.currentTarget.value = ''
            }}
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </aside>

        <div className='relative flex-1 basis-1/2 min-w-0 flex flex-col bg-[#0a0a0a] overflow-hidden'>
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
          ) : json && typeof json === 'object' ? (
            <div className='flex-1 p-6 overflow-hidden flex flex-col gap-4'>
              <div className='flex-1 bg-[#0c0c0c] border border-yellow-500/25 rounded-xl overflow-hidden shadow-2xl flex flex-col'>
                <div className='px-4 py-3 border-b border-yellow-500/20 bg-[#0c0c0c] flex items-center justify-between gap-3'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`}></span>
                    <div className='min-w-0'>
                      <div className='text-xs text-gray-500'>Output</div>
                      <div className='text-sm font-semibold text-gray-100 truncate'>Result</div>
                    </div>
                  </div>
                  {Array.isArray((json as any)?.documents) && (json as any).documents.length > 0 && (
                    <span className='text-[11px] text-yellow-500 bg-[#0a0a0a] px-2 py-1 rounded-md border border-yellow-500/30 shrink-0 font-semibold'>
                      {(json as any).documents.length} documento{(json as any).documents.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {Array.isArray((json as any)?.documents) && (json as any).documents.length > 0 && (
                  <div className='shrink-0 px-4 pt-4'>
                    <div className='inline-flex flex-wrap gap-2'>
                      {(json as any).documents?.map((d: any, idx: number) => {
                        const id = d?.id
                        if (!id) return null
                        const docdate = d?.docdate
                        const key = `${id}-${docdate || idx}-${idx}`
                        const active = key === activeDocKey
                        return (
                          <button
                            key={key}
                            type='button'
                            onClick={() => setActiveDocKey(key)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${active ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-[#0a0a0a] text-gray-300 border-[#2a2a2a] hover:bg-white/5'}`}
                          >
                            {docdate ? `${id} • ${docdate}` : id}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className='flex-1 p-6 overflow-auto'>
                  <pre className='bg-[#0c0c0c] border border-[#1f1f1f] rounded-xl text-gray-200 text-xs font-mono p-5 whitespace-pre-wrap break-all overflow-auto shadow-2xl'>
                    {JSON.stringify((json as any)?.documents?.find((d: any, idx: number) => `${d?.id || 'doc'}-${d?.docdate || 0}-${idx}` === activeDocKey) || json, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className='flex-1 flex flex-col items-center justify-center text-center px-6'>
              <div className='w-20 h-20 bg-yellow-500/15 rounded-full flex items-center justify-center mb-6 border border-yellow-500/30'>
                <svg className='w-10 h-10 text-yellow-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' />
                </svg>
              </div>
              <h3 className='text-xl font-bold text-gray-200 mb-2'>
                Listo para procesar
              </h3>
              <p className='text-gray-500 max-w-md'>
                Sube un PDF o imagen en el panel izquierdo.
              </p>
            </div>
          )}
        </div>
      </section>

      <LoginModal isOpen={!isAuth} onSuccess={() => setIsAuth(true)} />
    </main>
  )
}
