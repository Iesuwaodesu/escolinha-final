'use client'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('Erro: ' + error.message)
    else router.push('/dashboard') 
    setLoading(false)
  }

  const handleCadastro = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: 'Responsável' } }
    })
    if (error) alert(error.message)
    else alert('Verifique seu email!')
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">⚽ Escolinha App</h1>
        <input className="w-full p-2 mb-4 border rounded text-black" placeholder="Email" onChange={e => setEmail(e.target.value)} />
        <input type="password" className="w-full p-2 mb-6 border rounded text-black" placeholder="Senha" onChange={e => setPassword(e.target.value)} />
        <button onClick={handleLogin} disabled={loading} className="w-full bg-green-600 text-white font-bold p-2 rounded mb-3">{loading ? '...' : 'Entrar'}</button>
        <button onClick={handleCadastro} disabled={loading} className="w-full border p-2 rounded text-black">Criar Conta</button>
      </div>
    </div>
  )
}