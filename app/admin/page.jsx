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
  const [aba, setAba] = useState('financeiro') 
  
  const [mensalidades, setMensalidades] = useState([])
  const [eventos, setEventos] = useState([])
  const [alunos, setAlunos] = useState([])
  const [inscricoes, setInscricoes] = useState([]) // Para gerenciar quem vai nos eventos
  
  // Novo evento
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data: '', local: '', descricao: '', valor: '0' })

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    
    if (!profile?.is_admin) {
      alert('Acesso restrito.')
      router.push('/dashboard')
    } else {
      carregarTudo()
    }
  }

  async function carregarTudo() {
    setLoading(true)
    // 1. Carregar Mensalidades
    const { data: m } = await supabase.from('mensalidades').select('*, alunos(nome)').order('vencimento', { ascending: false })
    setMensalidades(m || [])

    // 2. Carregar Alunos (com contagem de pendências manual)
    const { data: a } = await supabase.from('alunos').select('*, profiles(nome_completo, email, telefone)')
    
    // Calcula pendências para cada aluno
    const alunosComPendencias = a?.map(aluno => {
      const pendentes = m?.filter(fatura => fatura.aluno_id === aluno.id && fatura.status === 'pendente').length || 0
      return { ...aluno, pendentes }
    })
    setAlunos(alunosComPendencias || [])

    // 3. Carregar Eventos e Inscrições
    const { data: e } = await supabase.from('eventos').select('*').order('data_hora')
    setEventos(e || [])

    const { data: i } = await supabase.from('inscricoes').select('*, alunos(nome), eventos(titulo)')
    setInscricoes(i || [])
    
    setLoading(false)
  }

  // --- AÇÕES FINANCEIRAS ---
  async function alternarStatusMensalidade(id, statusAtual) {
    const novoStatus = statusAtual === 'pago' ? 'pendente' : 'pago'
    await supabase.from('mensalidades').update({ status: novoStatus }).eq('id', id)
    carregarTudo()
  }

  // --- AÇÕES EVENTOS ---
  async function criarEvento(e) {
    e.preventDefault()
    const { error } = await supabase.from('eventos').insert({
      titulo: novoEvento.titulo,
      data_hora: novoEvento.data,
      local: novoEvento.local,
      descricao: novoEvento.descricao,
      valor: novoEvento.valor
    })
    if (!error) {
      alert('Evento criado!')
      setNovoEvento({ titulo: '', data: '', local: '', descricao: '', valor: '0' })
      carregarTudo()
    }
  }

  async function deletarEvento(id) {
    if(!confirm('ATENÇÃO: Deletar este evento cancelará todas as inscrições nele. Continuar?')) return;
    await supabase.from('inscricoes').delete().eq('evento_id', id) // Limpa inscrições antes
    await supabase.from('eventos').delete().eq('id', id)
    carregarTudo()
  }

  async function alternarPagamentoEvento(inscricaoId, statusAtual) {
    await supabase.from('inscricoes').update({ pago: !statusAtual }).eq('id', inscricaoId)
    carregarTudo()
  }

  // --- AÇÕES ALUNOS ---
  async function deletarAluno(id) {
    if(!confirm('Tem certeza? Isso apaga tudo sobre o aluno.')) return;
    await supabase.from('alunos').delete().eq('id', id)
    carregarTudo()
  }

  if (loading) return <div className="p-10 text-center text-black">Carregando Admin...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Painel Admin 🛡️</h1>
          <button onClick={() => router.push('/dashboard')} className="text-blue-600 underline">Voltar ao App</button>
        </div>

        {/* MENU */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          {['financeiro', 'eventos', 'alunos', 'inscricoes'].map(nome => (
            <button key={nome} onClick={() => setAba(nome)} 
              className={`px-4 py-2 rounded capitalize font-bold ${aba === nome ? 'bg-black text-white' : 'bg-white text-gray-700'}`}>
              {nome}
            </button>
          ))}
        </div>

        {/* 1. ABA FINANCEIRO */}
        {aba === 'financeiro' && (
          <div className="bg-white p-6 rounded shadow overflow-x-auto">
            <h2 className="text-xl font-bold mb-4 text-black">Controle Total de Mensalidades</h2>
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="p-3">Aluno</th><th>Vencimento</th><th>Valor</th><th>Status (Clique p/ mudar)</th></tr>
              </thead>
              <tbody>
                {mensalidades.map(m => (
                  <tr key={m.id} className="border-b text-gray-700 hover:bg-gray-50">
                    <td className="p-3 font-medium">{m.alunos?.nome}</td>
                    <td>{m.vencimento}</td>
                    <td>R$ {m.valor}</td>
                    <td>
                      <button 
                        onClick={() => alternarStatusMensalidade(m.id, m.status)}
                        className={`px-3 py-1 rounded text-xs font-bold w-24 ${
                          m.status === 'pago' ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' 
                          : 'bg-yellow-100 text-yellow-700 hover:bg-green-100 hover:text-green-700'
                        }`}
                      >
                        {m.status === 'pago' ? 'PAGO ✅' : 'PENDENTE ⏳'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. ABA EVENTOS */}
        {aba === 'eventos' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded shadow h-fit">
              <h2 className="text-xl font-bold mb-4 text-black">Novo Evento</h2>
              <form onSubmit={criarEvento} className="space-y-3">
                <input required placeholder="Título" className="w-full border p-2 rounded text-black" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} />
                <div className="flex gap-2">
                   <input required type="datetime-local" className="w-1/2 border p-2 rounded text-black" value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} />
                   <input type="number" placeholder="Valor (R$)" className="w-1/2 border p-2 rounded text-black" value={novoEvento.valor} onChange={e => setNovoEvento({...novoEvento, valor: e.target.value})} />
                </div>
                <input required placeholder="Local" className="w-full border p-2 rounded text-black" value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} />
                <textarea placeholder="Descrição / Obs" className="w-full border p-2 rounded text-black" value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} />
                <button type="submit" className="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700">Criar Evento</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded shadow">
              <h2 className="text-xl font-bold mb-4 text-black">Eventos Ativos</h2>
              {eventos.map(ev => (
                <div key={ev.id} className="flex justify-between items-center border-b py-3">
                  <div>
                    <p className="font-bold text-gray-800">{ev.titulo}</p>
                    <p className="text-xs text-gray-500">{new Date(ev.data_hora).toLocaleString()} • R$ {ev.valor}</p>
                  </div>
                  <button onClick={() => deletarEvento(ev.id)} className="text-red-500 text-sm hover:underline">Deletar 🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. ABA ALUNOS */}
        {aba === 'alunos' && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-black">Lista de Alunos</h2>
            {alunos.length === 0 ? <p className="text-gray-500">Nenhum aluno cadastrado.</p> : (
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600">
                  <tr><th className="p-3">Nome</th><th>Responsável</th><th>Pendências</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {alunos.map(a => (
                    <tr key={a.id} className="border-b text-gray-700">
                      <td className="p-3 font-bold">{a.nome} <span className="text-xs font-normal text-gray-500">({a.posicao})</span></td>
                      <td className="text-sm">
                        <div>{a.profiles?.nome_completo}</div>
                        <div className="text-xs text-gray-400">{a.profiles?.email}</div>
                      </td>
                      <td>
                        {a.pendentes > 0 ? (
                           <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">{a.pendentes} meses em atraso</span>
                        ) : <span className="text-green-600 text-xs font-bold">Em dia ✨</span>}
                      </td>
                      <td>
                        <button onClick={() => deletarAluno(a.id)} className="text-red-500 hover:text-red-700 text-sm border border-red-200 px-2 py-1 rounded">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 4. ABA GESTÃO DE INSCRIÇÕES (EVENTOS) */}
        {aba === 'inscricoes' && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-black">Gestão de Pagamentos de Eventos</h2>
            <div className="space-y-4">
              {inscricoes.length === 0 && <p className="text-gray-500">Nenhuma inscrição ainda.</p>}
              {inscricoes.map(insc => (
                <div key={insc.id} className="flex justify-between items-center border p-3 rounded hover:bg-gray-50">
                  <div>
                    <p className="font-bold text-gray-800">{insc.alunos?.nome}</p>
                    <p className="text-sm text-gray-600">Evento: {insc.eventos?.titulo}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {insc.pago ? 'Pago' : 'A pagar'}
                    </span>
                    <button 
                      onClick={() => alternarPagamentoEvento(insc.id, insc.pago)}
                      className={`w-32 py-1 rounded text-xs font-bold border ${
                        insc.pago ? 'bg-green-600 text-white border-green-600' : 'bg-white text-red-500 border-red-500'
                      }`}
                    >
                      {insc.pago ? 'CONFIRMADO' : 'COBRAR'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}