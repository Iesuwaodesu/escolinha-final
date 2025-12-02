'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Dashboard() {
  const router = useRouter()
  const [debug, setDebug] = useState("Carregando...")

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setDebug("Nenhum usuário logado.")
        return
      }

      // Busca direta no perfil
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        setDebug(`Erro ao ler perfil: ${error.message}`)
        return
      }

      setDebug(`Email: ${profile.email} | É Admin no Banco? ${profile.is_admin ? "SIM (TRUE)" : "NÃO (FALSE)"}`)

      if (profile.is_admin === true) {
        // Se for admin, tenta redirecionar
        setTimeout(() => router.replace('/admin'), 1500)
      } else {
        // Se não for, carrega normal (mas vamos mostrar o aviso)
        setDebug(prev => prev + " -> Você está sendo tratado como Pai.")
      }
    }
    verificar()
  }, [])

  return (
    <div className="min-h-screen p-10 bg-white text-black">
      <h1 className="text-2xl font-bold text-red-600 mb-4">MODO DIAGNÓSTICO</h1>
      <div className="p-4 border-2 border-black rounded bg-yellow-100 font-mono text-lg">
        {debug}
      </div>
      <p className="mt-4">
        Se aparecer <strong>SIM (TRUE)</strong> acima, você será redirecionado em 2 segundos.<br/>
        Se aparecer <strong>NÃO (FALSE)</strong>, o comando SQL não funcionou ou você usou o email errado.<br/>
        Se aparecer <strong>Erro</strong>, o banco está bloqueado.
      </p>
      <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="mt-6 bg-black text-white p-3 rounded">
        Sair e Tentar de Novo
      </button>
    </div>
  )
}