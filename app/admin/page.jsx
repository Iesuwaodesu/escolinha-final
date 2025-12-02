'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function AdminPanel() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('financeiro') // financeiro | eventos | alunos
  
  // Dados
  const [mensalidades, setMensalidades] = useState([])
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data: '', local: '', descricao: '' })
  const [alunos, setAlunos] = useState([])

  // Verifica se é Admin ao entrar
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        alert('Acesso negado. Área restrita.')
        router.push('/dashboard')
      } else {
        carregarTudo()
      }
    }
    checkAdmin()
  }, [])

  async function carregarTudo() {
    setLoading(true)
    // Carrega mensalidades pendentes
    const { data: m } = await supabase.from('mensalidades').select('*, alunos(nome)').order('vencimento')
    setMensalidades(m || [])
    
    // Carrega alunos
    const { data: a } = await supabase.from('alunos').select('*, profiles(nome_completo, email)')
    setAlunos(a || [])
    
    setLoading(false)
  }

  // --- FUNÇÕES DE AÇÃO ---

  async function confirmarPagamento(id) {
    if(!confirm('Confirmar pagamento desta mensalidade?')) return;
    await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', id)
    carregarTudo()
  }

  async function criarEvento(e) {
    e.preventDefault()
    const { error } = await supabase.from('eventos').insert({
      titulo: novoEvento.titulo,
      data_hora: novoEvento.data,
      local: novoEvento.local,
      descricao: novoEvento.descricao
    })
    
    if (error) alert('Erro ao criar evento')
    else {
      alert('Evento criado!')
      setNovoEvento({ titulo: '', data: '', local: '', descricao: '' })
    }
  }

  async function deletarAluno(id) {
    if(!confirm('Tem certeza? Isso apagará o histórico deste aluno.')) return;
    await supabase.from('alunos').delete().eq('id', id)
    carregarTudo()
  }

  if (loading) return <div className="p-10 text-center">Carregando Painel Admin...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Painel do Administrador 👔</h1>
          <button onClick={() => router.push('/dashboard')} className="text-blue-600 underline">Ir para visão dos Pais</button>
        </div>

        {/* MENU DE ABAS */}
        <div className="flex space-x-4 mb-6 border-b pb-2">
          <button onClick={() => setAba('financeiro')} className={`px-4 py-2 rounded ${aba === 'financeiro' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>💰 Financeiro</button>
          <button onClick={() => setAba('eventos')} className={`px-4 py-2 rounded ${aba === 'eventos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>🏆 Eventos</button>
          <button onClick={() => setAba('alunos')} className={`px-4 py-2 rounded ${aba === 'alunos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>⚽ Alunos</button>
        </div>

        {/* ABA FINANCEIRO */}
        {aba === 'financeiro' && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-black">Controle de Mensalidades</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="p-2">Aluno</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {mensalidades.map(m => (
                  <tr key={m.id} className="border-b text-gray-700">
                    <td className="p-2 font-bold">{m.alunos?.nome}</td>
                    <td>{m.vencimento}</td>
                    <td>R$ {m.valor}</td>
                    <td>
                      <span className={`px-2 py-1 rounded text-xs ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {m.status !== 'pago' && (
                        <button onClick={() => confirmarPagamento(m.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                          Confirmar Pagto
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ABA EVENTOS */}
        {aba === 'eventos' && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-black">Criar Novo Evento</h2>
            <form onSubmit={criarEvento} className="grid grid-cols-1 gap-4 max-w-lg mb-8">
              <input required placeholder="Título (ex: Jogo contra Bairro Vizinho)" className="border p-2 rounded text-black" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} />
              <input required type="datetime-local" className="border p-2 rounded text-black" value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} />
              <input required placeholder="Local" className="border p-2 rounded text-black" value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} />
              <textarea placeholder="Observações / Descrição" className="border p-2 rounded text-black" value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} />
              <button type="submit" className="bg-blue-600 text-white p-2 rounded font-bold">Salvar Evento</button>
            </form>
          </div>
        )}

        {/* ABA ALUNOS */}
        {aba === 'alunos' && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-black">Lista Geral de Alunos</h2>
            {alunos.map(a => (
              <div key={a.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50 text-gray-700">
                <div>
                  <p className="font-bold">{a.nome} <span className="text-sm font-normal text-gray-500">({a.posicao})</span></p>
                  <p className="text-xs text-gray-400">Resp: {a.profiles?.nome_completo || a.profiles?.email}</p>
                </div>
                <button onClick={() => deletarAluno(a.id)} className="text-red-500 hover:text-red-700 text-sm border border-red-200 px-2 py-1 rounded">
                  Excluir Aluno
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}