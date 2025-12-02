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
  const [alunos, setAlunos] = useState([])
  const [alunoSelecionado, setAlunoSelecionado] = useState(null)
  const [mensalidades, setMensalidades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase.from('alunos').select('*').eq('responsavel_id', user.id)
      if (data?.length > 0) {
        setAlunos(data)
        setAlunoSelecionado(data[0])
      }
      setLoading(false)
    }
    carregar()
  }, [])

  useEffect(() => {
    if (!alunoSelecionado) return
    supabase.from('mensalidades').select('*').eq('aluno_id', alunoSelecionado.id).then(({data}) => setMensalidades(data || []))
  }, [alunoSelecionado])

  if (loading) return <div className="p-10 text-center text-black">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between mb-8"><h1 className="text-2xl font-bold text-black">Painel</h1><button onClick={() => {supabase.auth.signOut(); router.push('/')}} className="text-red-600">Sair</button></div>
        {alunos.length > 0 ? (
          <>
            <select className="mb-6 p-2 rounded border text-black" onChange={e => setAlunoSelecionado(alunos.find(a => a.id === e.target.value))}>
              {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <div className="bg-white p-6 rounded shadow border">
              <h2 className="font-bold mb-4 text-black">💰 Mensalidades</h2>
              {mensalidades.map(m => (
                <div key={m.id} className="flex justify-between p-2 border-b text-black">
                  <span>Venc: {m.vencimento}</span>
                  <span className="font-bold text-green-700">R$ {m.valor} ({m.status})</span>
                </div>
              ))}
              {mensalidades.length === 0 && <p className="text-gray-500">Nenhuma cobrança.</p>}
            </div>
          </>
        ) : <p className="text-black">Nenhum aluno encontrado.</p>}
      </div>
    </div>
  )
}