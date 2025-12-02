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
  const [aba, setAba] = useState('alunos') 
  const [busca, setBusca] = useState('')

  // Dados
  const [alunos, setAlunos] = useState([])
  const [eventos, setEventos] = useState([])
  const [mensalidades, setMensalidades] = useState([])
  
  // Estado para Detalhes do Aluno (Modal)
  const [alunoDetalhe, setAlunoDetalhe] = useState(null)
  
  // Novo Evento
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data: '', local: '', descricao: '', valor: '' })

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    
    // Verifica Admin
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    
    if (!profile?.is_admin) {
      alert('Acesso restrito a Administradores.')
      router.push('/dashboard')
    } else {
      carregarTudo()
    }
  }

  async function carregarTudo() {
    setLoading(true)
    
    // 1. Carregar Alunos com dados do Pai
    const { data: a } = await supabase
      .from('alunos')
      .select('*, profiles(nome_completo, email, telefone)')
      .order('nome')
    setAlunos(a || [])

    // 2. Eventos com contagem de inscritos
    const { data: e } = await supabase.from('eventos').select('*, inscricoes(id)').order('data_hora')
    const eventosComContagem = e?.map(ev => ({ ...ev, qtd_inscritos: ev.inscricoes.length }))
    setEventos(eventosComContagem || [])

    // 3. Financeiro
    const { data: m } = await supabase.from('mensalidades').select('*, alunos(nome)').order('vencimento', {ascending:false})
    setMensalidades(m || [])

    setLoading(false)
  }

  // --- AÇÕES ---
  async function criarEvento(e) {
    e.preventDefault()
    const { error } = await supabase.from('eventos').insert({
      titulo: novoEvento.titulo,
      data_hora: novoEvento.data,
      local: novoEvento.local,
      descricao: novoEvento.descricao,
      valor: Number(novoEvento.valor)
    })
    
    if (error) alert('Erro: ' + error.message)
    else {
      alert('Evento criado!')
      setNovoEvento({ titulo: '', data: '', local: '', descricao: '', valor: '' })
      carregarTudo()
    }
  }

  async function deletarEvento(id) {
    if(!confirm('Deletar este evento?')) return;
    await supabase.from('inscricoes').delete().eq('evento_id', id)
    await supabase.from('eventos').delete().eq('id', id)
    carregarTudo()
  }

  async function deletarAluno(id) {
    if(!confirm('ATENÇÃO: Isso apagará o aluno e todo histórico financeiro dele.')) return;
    await supabase.from('inscricoes').delete().eq('aluno_id', id)
    await supabase.from('mensalidades').delete().eq('aluno_id', id)
    await supabase.from('alunos').delete().eq('id', id)
    setAlunoDetalhe(null)
    carregarTudo()
  }

  // Filtro de Busca
  const alunosFiltrados = alunos.filter(a => 
    a.nome.toLowerCase().includes(busca.toLowerCase()) || 
    a.profiles?.nome_completo?.toLowerCase().includes(busca.toLowerCase())
  )

  if (loading) return <div className="p-10 text-center font-bold">Carregando Sistema Admin...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Painel Admin</h1>
          <button onClick={() => router.push('/dashboard')} className="text-blue-600 underline">Voltar ao Site</button>
        </div>

        {/* Menu Superior */}
        <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto">
          {['alunos', 'eventos', 'financeiro'].map(nome => (
            <button key={nome} onClick={() => setAba(nome)} 
              className={`px-6 py-2 rounded-t-lg font-bold capitalize ${aba === nome ? 'bg-white border-t border-l border-r border-gray-200 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
              {nome}
            </button>
          ))}
        </div>

        {/* --- ABA ALUNOS (PRINCIPAL) --- */}
        {aba === 'alunos' && (
          <div className="bg-white p-6 rounded shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Gerenciar Alunos</h2>
              <input 
                placeholder="🔍 Buscar aluno ou responsável..." 
                className="p-2 border rounded w-64 text-black"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alunosFiltrados.map(a => (
                <div 
                  key={a.id} 
                  onClick={() => setAlunoDetalhe(a)}
                  className="border p-4 rounded-lg hover:shadow-md cursor-pointer bg-gray-50 flex items-center gap-3 transition"
                >
                  {a.foto_url ? (
                    <img src={a.foto_url} className="w-12 h-12 rounded-full object-cover border" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-xl">👤</div>
                  )}
                  <div>
                    <p className="font-bold text-gray-800">{a.nome}</p>
                    <p className="text-xs text-gray-500">{a.posicao} • {a.profiles?.nome_completo}</p>
                  </div>
                </div>
              ))}
            </div>
            {alunosFiltrados.length === 0 && <p className="text-gray-400 mt-4">Nenhum aluno encontrado.</p>}
          </div>
        )}

        {/* --- ABA EVENTOS --- */}
        {aba === 'eventos' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded shadow h-fit">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Criar Novo Evento</h3>
              <form onSubmit={criarEvento} className="space-y-3">
                <input required placeholder="Título" className="w-full border p-2 rounded text-black" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} />
                <input required type="datetime-local" className="w-full border p-2 rounded text-black" value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} />
                <input required placeholder="Local" className="w-full border p-2 rounded text-black" value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} />
                <input type="number" placeholder="Valor (R$)" className="w-full border p-2 rounded text-black" value={novoEvento.valor} onChange={e => setNovoEvento({...novoEvento, valor: e.target.value})} />
                <textarea placeholder="Descrição" className="w-full border p-2 rounded text-black" value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} />
                <button className="w-full bg-green-600 text-white font-bold p-2 rounded hover:bg-green-700">Criar Evento</button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white p-6 rounded shadow">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Eventos Ativos</h3>
              {eventos.map(ev => (
                <div key={ev.id} className="flex justify-between items-center border-b py-3">
                  <div>
                    <p className="font-bold text-gray-800">{ev.titulo}</p>
                    <p className="text-sm text-gray-500">{new Date(ev.data_hora).toLocaleString()} • R$ {ev.valor}</p>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{ev.qtd_inscritos} inscritos</span>
                  </div>
                  <button onClick={() => deletarEvento(ev.id)} className="text-red-500 border border-red-200 px-3 py-1 rounded text-sm hover:bg-red-50">Excluir</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- ABA FINANCEIRO --- */}
        {aba === 'financeiro' && (
          <div className="bg-white p-6 rounded shadow">
             <h3 className="font-bold text-lg mb-4 text-gray-800">Controle Geral de Mensalidades</h3>
             <table className="w-full text-left">
               <thead className="bg-gray-50 text-gray-600">
                 <tr><th className="p-2">Aluno</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr>
               </thead>
               <tbody>
                 {mensalidades.map(m => (
                   <tr key={m.id} className="border-b text-gray-700">
                     <td className="p-2 font-medium">{m.alunos?.nome}</td>
                     <td>{m.vencimento}</td>
                     <td>R$ {m.valor}</td>
                     <td><span className={`px-2 py-1 rounded text-xs font-bold ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status.toUpperCase()}</span></td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        )}

      </div>

      {/* --- MODAL DETALHES DO ALUNO --- */}
      {alunoDetalhe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setAlunoDetalhe(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black font-bold text-xl">X</button>
            
            <div className="flex items-center gap-4 mb-6 border-b pb-4">
              {alunoDetalhe.foto_url ? (
                <img src={alunoDetalhe.foto_url} className="w-20 h-20 rounded-full object-cover border-2 border-green-500" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl">👤</div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{alunoDetalhe.nome}</h2>
                <p className="text-gray-500">{alunoDetalhe.posicao} • Nascimento: {alunoDetalhe.data_nascimento}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-bold text-green-700 border-b">📍 Endereço</h3>
                <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded">{alunoDetalhe.endereco || 'Não informado'}</p>
                
                <h3 className="font-bold text-green-700 border-b mt-4">👨‍👩‍👦 Responsável</h3>
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded space-y-1">
                  <p><strong>Nome:</strong> {alunoDetalhe.profiles?.nome_completo}</p>
                  <p><strong>Email:</strong> {alunoDetalhe.profiles?.email}</p>
                  <p><strong>Telefone:</strong> {alunoDetalhe.profiles?.telefone || '--'}</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-green-700 border-b">⚙️ Ações</h3>
                <div className="mt-3 space-y-2">
                  <button onClick={() => deletarAluno(alunoDetalhe.id)} className="w-full bg-red-100 text-red-700 py-2 rounded font-bold hover:bg-red-200 transition">
                    🗑️ Excluir Aluno do Sistema
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-2">Isso apaga o aluno permanentemente.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}