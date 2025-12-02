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
  const [loading, setLoading] = useState(true)
  
  // Dados
  const [user, setUser] = useState(null)
  const [alunos, setAlunos] = useState([])
  const [alunoSelecionado, setAlunoSelecionado] = useState(null)
  const [mensalidades, setMensalidades] = useState([])
  const [eventos, setEventos] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)

  // Modais
  const [modalEvento, setModalEvento] = useState(null)
  const [modalCadastro, setModalCadastro] = useState(false)
  
  // Form Novo Aluno
  const [novoAluno, setNovoAluno] = useState({ nome: '', data_nascimento: '', posicao: '', endereco: '' })

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setUser(user)

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    setIsAdmin(profile?.is_admin)

    // Busca Alunos
    const { data: dataAlunos } = await supabase.from('alunos').select('*').eq('responsavel_id', user.id)
    if (dataAlunos?.length > 0) {
      setAlunos(dataAlunos)
      // Se não tiver selecionado, seleciona o primeiro. Se tiver, mantem.
      setAlunoSelecionado(prev => prev ? prev : dataAlunos[0])
    }
    
    // Busca Eventos
    const { data: dataEventos } = await supabase.from('eventos').select('*').gte('data_hora', new Date().toISOString()).order('data_hora')
    setEventos(dataEventos || [])
    
    setLoading(false)
  }

  // Carrega financeiro quando troca de filho
  useEffect(() => {
    if (!alunoSelecionado) return
    supabase.from('mensalidades').select('*').eq('aluno_id', alunoSelecionado.id).order('vencimento', {ascending:false}).then(({data}) => setMensalidades(data || []))
  }, [alunoSelecionado])

  function formatarMes(dataString) {
    const data = new Date(dataString)
    const offset = data.getTimezoneOffset() * 60000;
    return new Date(data.getTime() + offset).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
  }

  async function cadastrarFilho(e) {
    e.preventDefault()
    const { error } = await supabase.from('alunos').insert({
      responsavel_id: user.id,
      ...novoAluno
    })

    if (error) alert('Erro: ' + error.message)
    else {
      alert('Aluno cadastrado com sucesso!')
      setModalCadastro(false)
      setNovoAluno({ nome: '', data_nascimento: '', posicao: '', endereco: '' })
      // Recarrega lista
      const { data } = await supabase.from('alunos').select('*').eq('responsavel_id', user.id)
      setAlunos(data)
      setAlunoSelecionado(data[data.length - 1]) // Seleciona o novo
    }
  }

  async function inscrever() {
    if(!modalEvento) return;
    const { error } = await supabase.from('inscricoes').insert({ evento_id: modalEvento.id, aluno_id: alunoSelecionado.id })
    if (error) alert('Aluno já inscrito neste evento.')
    else { alert('Inscrição realizada!'); setModalEvento(null); }
  }

  if (loading) return <div className="p-10 text-center text-black">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Painel dos Pais</h1>
            <p className="text-sm text-gray-500">Gerencie seus atletas.</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && <button onClick={() => router.push('/admin')} className="bg-black text-white px-4 py-2 rounded text-sm font-bold">Admin 👔</button>}
            <button onClick={() => {supabase.auth.signOut(); router.push('/')}} className="text-red-600 px-3 py-2 text-sm hover:underline">Sair</button>
          </div>
        </div>

        {/* BARRA DE CONTROLE: SELETOR + BOTÃO ADICIONAR */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4">
          <div className="w-full md:w-auto">
            {alunos.length > 0 ? (
              <>
                <label className="text-xs font-bold text-gray-500 uppercase">Visualizando:</label>
                <select 
                  className="block mt-1 w-full md:w-64 p-2 border rounded text-black bg-white shadow-sm"
                  onChange={e => setAlunoSelecionado(alunos.find(a => a.id === e.target.value))}
                  value={alunoSelecionado?.id}
                >
                  {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </>
            ) : <p className="text-gray-500">Nenhum aluno cadastrado ainda.</p>}
          </div>

          <button 
            onClick={() => setModalCadastro(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow font-bold text-sm flex items-center gap-2"
          >
            + Adicionar Novo Aluno
          </button>
        </div>

        {alunos.length > 0 && alunoSelecionado && (
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* CARD MENSALIDADES */}
            <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
              <h2 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">💰 Mensalidades ({alunoSelecionado.nome.split(' ')[0]})</h2>
              {mensalidades.length === 0 ? <p className="text-gray-400 italic">Tudo em dia!</p> : (
                <div className="space-y-3">
                  {mensalidades.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                      <div>
                        <p className="font-bold text-blue-900 text-sm">{formatarMes(m.mes_referencia)}</p>
                        <p className="text-xs text-gray-500">Venc: {m.vencimento} • R$ {m.valor}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CARD EVENTOS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
              <h2 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">🏆 Eventos Disponíveis</h2>
              {eventos.length === 0 ? <p className="text-gray-400 italic">Nenhum evento futuro.</p> : (
                <div className="space-y-4">
                  {eventos.map(ev => (
                    <div 
                      key={ev.id} 
                      onClick={() => setModalEvento(ev)}
                      className="cursor-pointer border-l-4 border-blue-500 pl-4 py-2 hover:bg-blue-50 transition rounded-r"
                    >
                      <h3 className="font-bold text-gray-800">{ev.titulo}</h3>
                      <p className="text-xs text-gray-500">📅 {new Date(ev.data_hora).toLocaleString()}</p>
                      <p className="text-xs text-blue-600 font-bold mt-1">Ver detalhes &rarr;</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* --- MODAL DE EVENTO --- */}
      {modalEvento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button onClick={() => setModalEvento(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black font-bold">X</button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{modalEvento.titulo}</h2>
            <div className="space-y-2 text-gray-600 mb-6">
              <p>📍 {modalEvento.local}</p>
              <p>💰 Valor: {modalEvento.valor > 0 ? `R$ ${modalEvento.valor}` : 'Grátis'}</p>
              <p className="italic bg-gray-50 p-2 rounded text-sm">{modalEvento.descricao}</p>
            </div>
            <button onClick={inscrever} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg">Confirmar Inscrição</button>
          </div>
        </div>
      )}

      {/* --- MODAL CADASTRO DE ALUNO --- */}
      {modalCadastro && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button onClick={() => setModalCadastro(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black font-bold">X</button>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Cadastrar Novo Atleta</h2>
            <form onSubmit={cadastrarFilho} className="space-y-3">
              <input required placeholder="Nome Completo" className="w-full border p-2 rounded text-black" value={novoAluno.nome} onChange={e => setNovoAluno({...novoAluno, nome: e.target.value})} />
              <div className="flex gap-2">
                 <input required type="date" className="w-full border p-2 rounded text-black" value={novoAluno.data_nascimento} onChange={e => setNovoAluno({...novoAluno, data_nascimento: e.target.value})} />
                 <input required placeholder="Posição" className="w-full border p-2 rounded text-black" value={novoAluno.posicao} onChange={e => setNovoAluno({...novoAluno, posicao: e.target.value})} />
              </div>
              <textarea placeholder="Endereço Completo" className="w-full border p-2 rounded text-black" value={novoAluno.endereco} onChange={e => setNovoAluno({...novoAluno, endereco: e.target.value})} />
              <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg">Salvar Cadastro</button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}