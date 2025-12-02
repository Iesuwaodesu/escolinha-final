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
  const [user, setUser] = useState(null)
  
  const [alunos, setAlunos] = useState([])
  const [alunoSelecionado, setAlunoSelecionado] = useState(null)
  const [mensalidades, setMensalidades] = useState([])
  const [eventosDisponiveis, setEventosDisponiveis] = useState([])
  const [eventosInscritos, setEventosInscritos] = useState([])
  
  const [modalEvento, setModalEvento] = useState(null)
  const [modalCadastro, setModalCadastro] = useState(false)
  const [novoAluno, setNovoAluno] = useState({ nome: '', data_nascimento: '', posicao: '', endereco: '' })
  const [arquivoFoto, setArquivoFoto] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (profile?.is_admin === true) { router.replace('/admin'); return }
      carregarDadosPai(user.id)
    }
    init()
  }, [])

  async function carregarDadosPai(userId) {
    const { data: dataAlunos } = await supabase.from('alunos').select('*').eq('responsavel_id', userId)
    if (dataAlunos?.length > 0) {
      setAlunos(dataAlunos)
      if(!alunoSelecionado) setAlunoSelecionado(dataAlunos[0])
    }
    const { data: evs } = await supabase.from('eventos').select('*').gte('data_hora', new Date().toISOString()).order('data_hora')
    setEventosDisponiveis(evs || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!alunoSelecionado) return
    supabase.from('mensalidades').select('*').eq('aluno_id', alunoSelecionado.id).order('vencimento', {ascending: false}).then(({data}) => setMensalidades(data || []))
    
    // Puxa inscrições e status de pagamento
    supabase.from('inscricoes').select('id, pago, eventos(*)').eq('aluno_id', alunoSelecionado.id)
      .then(({data}) => {
         // Mapeia para incluir o status de pagamento junto com o evento
         const lista = data?.map(insc => ({ ...insc.eventos, inscricao_id: insc.id, pago: insc.pago })) || []
         setEventosInscritos(lista)
      })
  }, [alunoSelecionado])

  function formatarMes(d) {
    const data = new Date(d)
    const offset = data.getTimezoneOffset() * 60000;
    return new Date(data.getTime() + offset).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
  }

  async function cadastrarFilho(e) {
    e.preventDefault()
    let fotoUrl = null
    if (arquivoFoto) {
      const nomeArquivo = `foto-${Date.now()}-${arquivoFoto.name}`
      const { error } = await supabase.storage.from('fotos-alunos').upload(nomeArquivo, arquivoFoto)
      if (!error) {
        const { data } = supabase.storage.from('fotos-alunos').getPublicUrl(nomeArquivo)
        fotoUrl = data.publicUrl
      }
    }

    const { error } = await supabase.from('alunos').insert({
      responsavel_id: user.id,
      nome: novoAluno.nome,
      data_nascimento: novoAluno.data_nascimento,
      posicao: novoAluno.posicao,
      endereco: novoAluno.endereco,
      foto_url: fotoUrl
    })

    if (error) alert('Erro: ' + error.message)
    else {
      alert('Aluno cadastrado!')
      setModalCadastro(false)
      window.location.reload()
    }
  }

  async function inscrever() {
    if(!modalEvento) return;
    const { error } = await supabase.from('inscricoes').insert({ evento_id: modalEvento.id, aluno_id: alunoSelecionado.id })
    if (error) alert('Aluno já inscrito.')
    else { alert('Inscrição realizada!'); window.location.reload() }
  }

  async function cancelarInscricao(inscricaoId) {
    if (!confirm('Cancelar inscrição?')) return
    const { error } = await supabase.from('inscricoes').delete().eq('id', inscricaoId)
    if (!error) window.location.reload()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-start mb-6 bg-white p-4 rounded-xl shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Painel do Responsável</h1>
            <p className="text-xs text-gray-500 mt-1">Logado: {user?.email}</p>
          </div>
          <button onClick={() => {supabase.auth.signOut(); router.push('/')}} className="text-red-600 px-3 py-1 text-sm font-bold border border-red-100 rounded hover:bg-red-50">SAIR</button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
          <div className="w-full md:w-auto">
            {alunos.length > 0 ? (
              <div className="flex items-center gap-3">
                {alunoSelecionado?.foto_url && <img src={alunoSelecionado.foto_url} className="w-12 h-12 rounded-full object-cover border-2 border-green-500" />}
                <select className="block w-full md:w-64 p-2 border rounded text-black bg-white shadow-sm" onChange={e => setAlunoSelecionado(alunos.find(a => a.id === e.target.value))} value={alunoSelecionado?.id}>
                  {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
            ) : <p className="text-gray-500">Nenhum aluno.</p>}
          </div>
          <button onClick={() => setModalCadastro(true)} className="bg-green-600 text-white px-4 py-2 rounded shadow font-bold text-sm">+ Adicionar Aluno</button>
        </div>

        {alunos.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
              <h2 className="font-bold text-lg mb-4 text-gray-800">💰 Mensalidades</h2>
              {mensalidades.length === 0 && <p className="text-gray-400 text-sm">Tudo em dia.</p>}
              {mensalidades.map(m => (
                <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border mb-2">
                  <div><p className="font-bold text-blue-900 text-sm">{formatarMes(m.mes_referencia)}</p><p className="text-xs text-gray-500">R$ {m.valor}</p></div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status.toUpperCase()}</span>
                </div>
              ))}
              <div className="mt-6 border-t pt-4 text-center bg-gray-50 p-2 rounded"><p className="text-xs text-gray-500 font-bold">PIX CNPJ</p><p className="text-sm font-mono text-gray-800">00.000.000/0001-00</p></div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <h2 className="font-bold text-lg mb-4 text-gray-800">🏆 Eventos Disponíveis</h2>
                {eventosDisponiveis.map(ev => (
                  <div key={ev.id} onClick={() => setModalEvento(ev)} className="cursor-pointer border-l-4 border-blue-500 pl-4 py-2 hover:bg-blue-50 transition rounded-r bg-gray-50 mb-2">
                    <h3 className="font-bold text-gray-800 text-sm">{ev.titulo}</h3>
                    <p className="text-xs text-gray-500">📅 {new Date(ev.data_hora).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-green-100">
                <h2 className="font-bold text-lg mb-4 text-green-800">✅ Inscrições Ativas</h2>
                <ul className="space-y-3">
                  {eventosInscritos.map((ev, i) => (
                    <li key={i} className="flex justify-between items-center border-b border-green-200 pb-2">
                       <div className="text-sm text-green-900">
                         <p className="font-bold">{ev.titulo}</p>
                         <p className="text-xs">
                           {ev.valor > 0 ? (ev.pago ? '🟢 PAGO' : '🔴 PENDENTE') : 'GRÁTIS'}
                         </p>
                       </div>
                       <button onClick={() => cancelarInscricao(ev.inscricao_id)} className="text-red-600 text-xs border border-red-200 bg-white px-2 py-1 rounded hover:bg-red-50">Cancelar</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* MODAL EVENTO */}
      {modalEvento && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setModalEvento(null)} className="absolute top-4 right-4 text-gray-400 font-bold">X</button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{modalEvento.titulo}</h2>
            {modalEvento.arquivo_url && (
              <img src={modalEvento.arquivo_url} className="w-full h-40 object-cover rounded mb-4 border" alt="Cartaz" />
            )}
            <div className="space-y-2 text-gray-600 mb-6 text-sm">
              <p>📍 {modalEvento.local}</p>
              <p>💰 {modalEvento.valor > 0 ? `R$ ${modalEvento.valor}` : 'Grátis'}</p>
              <p className="bg-gray-100 p-2 rounded italic">{modalEvento.descricao}</p>
            </div>
            <button onClick={inscrever} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Confirmar Inscrição</button>
          </div>
        </div>
      )}

      {/* MODAL NOVO FILHO */}
      {modalCadastro && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button onClick={() => setModalCadastro(false)} className="absolute top-4 right-4 text-gray-400 font-bold">X</button>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Adicionar Aluno</h2>
            <form onSubmit={cadastrarFilho} className="space-y-3">
              <input required placeholder="Nome" className="w-full border p-2 rounded text-black" value={novoAluno.nome} onChange={e => setNovoAluno({...novoAluno, nome: e.target.value})} />
              <input required type="date" className="w-full border p-2 rounded text-black" value={novoAluno.data_nascimento} onChange={e => setNovoAluno({...novoAluno, data_nascimento: e.target.value})} />
              <input required placeholder="Posição" className="w-full border p-2 rounded text-black" value={novoAluno.posicao} onChange={e => setNovoAluno({...novoAluno, posicao: e.target.value})} />
              <input required placeholder="Endereço" className="w-full border p-2 rounded text-black" value={novoAluno.endereco} onChange={e => setNovoAluno({...novoAluno, endereco: e.target.value})} />
              <input type="file" required className="w-full text-xs" onChange={e => setArquivoFoto(e.target.files[0])} />
              <button className="w-full bg-green-600 text-white font-bold py-3 rounded">Salvar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}