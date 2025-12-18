import { useState } from 'react'

type Props = {
    isOpen: boolean
    onSuccess: () => void
}

export default function LoginModal({ isOpen, onSuccess }: Props) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (username === 'luvidal' && password === 'qazx') {
            onSuccess()
        } else {
            setError('Invalid credentials')
            setPassword('')
        }
    }

    if (!isOpen) return null

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md'>
            <div className='bg-[#0a0a0a] border border-yellow-500/30 w-full max-w-md rounded-2xl shadow-2xl p-8'>
                <h2 className='text-2xl font-bold text-yellow-500 mb-6 text-center'>Login</h2>
                <form onSubmit={handleSubmit} className='space-y-4'>
                    <div>
                        <label className='block text-sm font-medium text-gray-300 mb-2'>Username</label>
                        <input
                            type='text'
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className='w-full px-4 py-2 bg-[#111] border border-yellow-500/20 rounded-lg text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500'
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className='block text-sm font-medium text-gray-300 mb-2'>Password</label>
                        <input
                            type='password'
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className='w-full px-4 py-2 bg-[#111] border border-yellow-500/20 rounded-lg text-white focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500'
                        />
                    </div>
                    {error && <p className='text-red-500 text-sm'>{error}</p>}
                    <button
                        type='submit'
                        className='w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors'
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    )
}