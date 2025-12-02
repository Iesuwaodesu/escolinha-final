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
  const [aba, setAba] = useState('eventos') 
  
  // Dados
  const [mensalidades, setMensalidades] = useState([])
  const [eventos, setEventos] = useState([]) // Agora virá com contagem
  const [alunos, setAlunos] = useState([])
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data: '', local: '', descricao: '', valor: '0' })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')
      
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) return router.push('/dashboard')
      
      carregarTudo()
    }
    init()
  }, [])

  async function carregarTudo() {
    setLoading(true)
    
    // 1. Eventos com Contagem de Inscritos (Contamos depois no JS para simplificar)
    const { data: e } = await supabase.from('eventos').select('*, inscricoes(id)').order('data_hora')
    // Adiciona propriedade "qtd_inscritos"
    const eventosComContagem = e?.map(ev => ({ ...ev, qtd_inscritos: ev.inscricoes.length }))
    setEventos(eventosComContagem || [])

    // 2. Mensalidades
    const { data: m } = await supabase.from('mensalidades').select('*, alunos(nome)').order('vencimento', { ascending: false })
    setMensalidades(m || [])

    // 3. Alunos
    const { data: a } = await supabase.from('alunos').select('*, profiles(nome_completo, email, telefone)').order('nome')
    setAlunos(a || [])

    setLoading(false)
  }

  // --- AÇÕES DE EVENTOS (Que tinham sumido) ---
  async function criarEvento(e) {
    e.preventDefault()
    const { error } = await supabase.from('eventos').insert({
      titulo: novoEvento.titulo,
      data_hora: novoEvento.data,
      local: novoEvento.local,
      descricao: novoEvento.descricao,
      valor: novoEvento.valor
    })
    
    if (error) alert('Erro: ' + error.message)
    else {
      alert('Evento criado com sucesso!')
      setNovoEvento({ titulo: '', data: '', local: '', descricao: '', valor: '0' })
      carregarTudo()
    }
  }

  async function deletarEvento(id) {
    if(!confirm('Tem certeza? Isso apaga todas as inscrições deste evento.')) return;
    await supabase.from('inscricoes').delete().eq('evento_id', id)
    await supabase.from('eventos').delete().eq('id', id)
    carregarTudo()
  }

  // Ações Auxiliares
  async function alternarMensalidade(id, status) {
    const novoStatus = status === 'pago' ? 'pendente' : 'pago'
    await supabase.from('mensalidades').update({ status: novoStatus }).eq('id', id)
    carregarTudo()
  }

  if (loading) return <div className="p-10 text-center font-bold">Carregando Admin...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Painel Admin SDC 🛡️</h1>
          <button onClick={() => router.push('/dashboard')} className="text-blue-600 underline">Voltar</button>
        </div>

        {/* Menu de Abas */}
        <div className="flex gap-4 mb-6 border-b pb-2">
          <button onClick={() => setAba('eventos')} className={`px-4 py-2 rounded font-bold ${aba === 'eventos' ? 'bg-black text-white' : 'bg-white text-gray-700'}`}>Eventos</button>
          <button onClick={() => setAba('financeiro')} className={`px-4 py-2 rounded font-bold ${aba === 'financeiro' ? 'bg-black text-white' : 'bg-white text-gray-700'}`}>Financeiro</button>
          <button onClick={() => setAba('alunos')} className={`px-4 py-2 rounded font-bold ${aba === 'alunos' ? 'bg-black text-white' : 'bg-white text-gray-700'}`}>Alunos</button>
        </div>

        {/* ABA EVENTOS (RESTAURADA) */}
        {aba === 'eventos' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Form Criar */}
            <div className="bg-white p-6 rounded shadow h-fit">
              <h2 className="text-xl font-bold mb-4 text-black">Novo Evento</h2>
              <form onSubmit={criarEvento} className="space-y-3">
                <input required placeholder="Título" className="w-full border p-2 rounded text-black" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} />
                <div className="flex gap-2">
                   <input required type="datetime-local" className="w-1/2 border p-2 rounded text-black" value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} />
                   <input type="number" placeholder="R$" className="w-1/2 border p-2 rounded text-black" value={novoEvento.valor} onChange={e => setNovoEvento({...novoEvento, valor: e.target.value})} />
                </div>
                <input required placeholder="Local" className="w-full border p-2 rounded text-black" value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} />
                <textarea placeholder="Descrição" className="w-full border p-2 rounded text-black" value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} />
                <button type="submit" className="w-full bg-green-600 text-white p-2 rounded font-bold">Criar Evento</button>
              </form>
            </div>

            {/* Lista Eventos */}
            <div className="bg-white p-6 rounded shadow">
              <h2 className="text-xl font-bold mb-4 text-black">Eventos Ativos</h2>
              {eventos.map(ev => (
                <div key={ev.id} className="border-b py-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-800">{ev.titulo}</p>
                    <p className="text-sm text-gray-500">{new Date(ev.data_hora).toLocaleString()} • R$ {ev.valor}</p>
                    <p className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded w-fit mt-1">
                      {ev.qtd_inscritos} alunos inscritos
                    </p>
                  </div>
                  <button onClick={() => deletarEvento(ev.id)} className="text-red-500 hover:text-red-700 text-sm border border-red-200 px-3 py-1 rounded">
                    Deletar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA FINANCEIRO */}
        {aba === 'financeiro' && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-black">Mensalidades</h2>
            <div className="space-y-2">
              {mensalidades.map(m => (
                <div key={m.id} className="flex justify-between items-center border-b py-2">
                  <span className="text-gray-700">{m.alunos?.nome} - {new Date(m.mes_referencia).toLocaleDateString('pt-BR', {month:'long'})}</span>
                  <button onClick={() => alternarMensalidade(m.id, m.status)} className={`px-2 py-1 rounded text-xs font-bold ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {m.status.toUpperCase()}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* ABA ALUNOS */}
        {aba === 'alunos' && (
           <div className="bg-white p-6 rounded shadow">
             <h2 className="text-xl font-bold mb-4 text-black">Todos os Alunos</h2>
             {alunos.map(a => (
               <div key={a.id} className="border-b py-2 text-gray-700">
                 <p className="font-bold">{a.nome}</p>
                 <p className="text-xs text-gray-500">Resp: {a.profiles?.nome_completo} - {a.profiles?.telefone}</p>
               </div>
             ))}
           </div>
        )}
      </div>
    </div>
  )
}