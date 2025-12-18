import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import DataViewer from '@/components/DataViewer'
import Modal from '@/components/Modal'
import LoginModal from '@/components/LoginModal'

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), { ssr: false })

export default function Home() {
  const [isAuth, setIsAuth] = useState(false)
  const [model, setModel] = useState<'claude' | 'gpt5'>('claude')
  const [json, setJson] = useState<any>(null)
  const [megaJson, setMegaJson] = useState<any>(null)
  const [showMegaModal, setShowMegaModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [imageScale, setImageScale] = useState(1)

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
      form.append('model', model)

      const res = await fetch('/api/v1/ocr', {
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
  }, [model, file])

  useEffect(() => {
    if (file) handleSend()
  }, [file])

  useEffect(() => {
    if (file) handleSend()
  }, [model])

  const handleMegaJson = async () => {
    if (!json) return
    try {
      const res = await fetch('/api/v1/megajson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setMegaJson(data)
      setShowMegaModal(true)
    } catch (e) {
      console.error(e)
      alert('Error generating Mega JSON')
    }
  }

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
          <div className='p-6 border-b border-[#1f1f1f]'>
            <div className='flex items-center justify-between gap-3'>
              <div className='min-w-0'>
                <div className='text-xs font-medium text-gray-500 uppercase tracking-wider'>Input</div>
                <div className='mt-1 text-sm font-semibold text-gray-100 truncate'>
                  {file ? file.name : 'No file selected'}
                </div>
              </div>
              <div className='flex items-center gap-2 text-xs font-medium text-gray-400 shrink-0'>
                <span className={`inline-block w-2 h-2 rounded-full ${file ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'bg-gray-600'}`}></span>
                <span>{file ? 'Ready' : 'Waiting'}</span>
              </div>
            </div>
          </div>

          <div className='flex-1 p-6 pt-4 overflow-auto flex flex-col gap-4'>
            <div
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
              onDragOver={e => e.preventDefault()}
              className='h-full border border-dashed border-yellow-500/35 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-yellow-500/70 hover:bg-yellow-500/5 transition-all duration-300 group overflow-hidden'
            >
              {file ? (
                preview && file.type === 'application/pdf' ? (
                  <PDFViewer fileUrl={preview} />
                ) : preview ? (
                  <div className='w-full h-[70vh] bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl shadow-2xl flex flex-col overflow-hidden'>
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
                      <img
                        src={preview}
                        alt={file.name}
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

            <select
              className='w-full px-4 py-3 rounded-xl font-semibold text-sm border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 text-yellow-500 cursor-pointer hover:border-yellow-500/50 focus:outline-none focus:border-yellow-500/60 focus:ring-4 focus:ring-yellow-500/10 transition-all'
              value={model}
              onChange={e => setModel(e.target.value as 'claude' | 'gpt5')}
            >
              <option value='claude' className='bg-[#0a0a0a] text-gray-200'>Claude Haiku 4.5</option>
              <option value='gpt5' className='bg-[#0a0a0a] text-gray-200'>GPT-4o</option>
            </select>
          </div>

          <input
            id='fileInput'
            type='file'
            accept='image/*,application/pdf'
            className='hidden'
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
          ) : json ? (
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
                  {json?.documents && json.documents.length > 0 && (
                    <span className='text-[11px] text-yellow-500 bg-[#0a0a0a] px-2 py-1 rounded-md border border-yellow-500/30 shrink-0 font-semibold'>
                      {json.documents.length} documento{json.documents.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className='flex-1 p-6 overflow-auto'>
                  <DataViewer data={json} simpleMode={true} />
                </div>
              </div>
              <button
                onClick={handleMegaJson}
                className='w-full px-4 py-3 rounded-xl font-semibold text-sm border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 text-yellow-500 cursor-pointer hover:border-yellow-500/50 hover:bg-yellow-500/10 transition-all'
              >
                Report
              </button>
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

      <Modal
        isOpen={showMegaModal}
        onClose={() => setShowMegaModal(false)}
        title='Reporte IA'
      >
        <DataViewer data={megaJson} simpleMode={false} />
      </Modal>

      <LoginModal isOpen={!isAuth} onSuccess={() => setIsAuth(true)} />
    </main>
  )
}
