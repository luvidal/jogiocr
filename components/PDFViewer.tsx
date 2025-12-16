import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

// Use a local copy of the PDF.js worker served from /public to avoid bundler resolution issues.
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

type Props = {
  fileUrl: string
}

const PDFViewer = ({ fileUrl }: Props) => {
  const [numPages, setNumPages] = useState<number>(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1.1)
  const [showThumbs, setShowThumbs] = useState(true)

  useEffect(() => {
    setPage(1)
  }, [fileUrl])

  return (
    <div className='w-full h-[70vh] bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl shadow-2xl flex flex-col overflow-hidden'>
      <div className='sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-[#2a2a2a] bg-[#121212]/90 backdrop-blur'>
        <button
          type='button'
          onClick={() => setShowThumbs(v => !v)}
          className='px-2 py-1 text-xs font-semibold rounded-md bg-[#0c0c0c] text-gray-200 border border-[#2a2a2a] hover:border-yellow-500/60 transition'
        >
          {showThumbs ? 'Miniaturas' : 'Miniaturas'}
        </button>
        <div className='flex items-center gap-1 ml-auto'>
          <button
            type='button'
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className='px-2 py-1 text-xs font-semibold rounded-md bg-[#0c0c0c] text-gray-200 border border-[#2a2a2a] hover:border-yellow-500/60 transition'
          >
            −
          </button>
          <span className='text-xs text-gray-400 w-14 text-center tabular-nums'>{Math.round(scale * 100)}%</span>
          <button
            type='button'
            onClick={() => setScale(s => Math.min(3, s + 0.1))}
            className='px-2 py-1 text-xs font-semibold rounded-md bg-[#0c0c0c] text-gray-200 border border-[#2a2a2a] hover:border-yellow-500/60 transition'
          >
            +
          </button>
        </div>
      </div>

      <div className='flex flex-1 min-h-0'>
        {showThumbs && (
          <div className='w-24 border-r border-[#1f1f1f] bg-[#0c0c0c] overflow-auto'>
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: np }) => setNumPages(np)}
              loading={<div className='p-3 text-xs text-gray-400'>Cargando...</div>}
            >
              {Array.from(new Array(numPages), (_, i) => {
                const p = i + 1
                const active = p === page
                return (
                  <button
                    key={p}
                    type='button'
                    onClick={() => setPage(p)}
                    className={`w-full p-2 border-b border-[#141414] block text-left transition ${active ? 'bg-yellow-500/10' : 'hover:bg-[#101010]'}`}
                  >
                    <div className={`rounded-md overflow-hidden border ${active ? 'border-yellow-500/40' : 'border-[#1f1f1f]'}`}>
                      <Page pageNumber={p} width={80} renderTextLayer={false} renderAnnotationLayer={false} />
                    </div>
                    <div className='mt-1 text-[10px] text-gray-500 font-semibold'>#{p}</div>
                  </button>
                )
              })}
            </Document>
          </div>
        )}

        <div className='flex-1 overflow-auto bg-[#0a0a0a] flex items-center justify-center p-6'>
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: np }) => setNumPages(np)}
            loading={<div className='p-3 text-xs text-gray-400'>Cargando...</div>}
          >
            <Page
              pageNumber={page}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className='shadow-2xl bg-white rounded-lg'
            />
          </Document>
        </div>
      </div>
    </div>
  )
}

export default PDFViewer
