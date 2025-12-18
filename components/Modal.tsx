import React, { useEffect } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export default function Modal({ isOpen, onClose, children, title }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='absolute inset-0' onClick={onClose} />
      <div 
        className='relative bg-[#0a0a0a] border border-yellow-500/20 w-full max-w-5xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200'
      >
        <div className='flex items-center justify-between px-6 py-4 border-b border-yellow-500/10 bg-[#0c0c0c]'>
          <h3 className='text-lg font-bold text-gray-100'>{title || 'Modal'}</h3>
          <button 
            onClick={onClose}
            className='p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors'
          >
            <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
        <div className='flex-1 overflow-auto bg-[#0a0a0a]'>
          <div className='p-6'>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}