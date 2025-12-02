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
  
  // Estados para Pais
  const [alunos, setAlunos] = useState([])
  const [alunoSelecionado, setAlunoSelecionado] = useState(null)
  const [mensalidades, setMensalidades] = useState([])
  const [eventosDisponiveis, setEventosDisponiveis] = useState([])
  const [eventosInscritos, setEventosInscritos] = useState([])
  const [modalEvento, setModalEvento] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      // 1. VERIFICAÇÃO DE ADMIN (O PULO DO GATO)
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin === true) {
        // SE FOR ADMIN, MANDA DIRETO PRO PAINEL ADMIN
        router.replace('/admin')
        return
      }

      // SE NÃO FOR ADMIN, CARREGA DADOS DE PAI
      carregarDadosPai(user.id)
    }
    init()
  }, [])

  async function carregarDadosPai(userId) {
    // Busca Alunos
    const { data: dataAlunos } = await supabase.from('alunos').select('*').eq('responsavel_id', userId)
    if (dataAlunos?.length > 0) {
      setAlunos(dataAlunos)
      setAlunoSelecionado(dataAlunos[0])
    }
    
    // Busca Eventos
    const { data: evs } = await supabase.from('eventos').select('*').gte('data_hora', new Date().toISOString()).order('data_hora')
    setEventosDisponiveis(evs || [])
    
    setLoading(false)
  }

  // Monitora mudança de aluno selecionado para carregar financeiro/inscrições
  useEffect(() => {
    if (!alunoSelecionado) return
    
    supabase.from('mensalidades').select('*').eq('aluno_id', alunoSelecionado.id).order('vencimento', {ascending: false})
      .then(({data}) => setMensalidades(data || []))

    supabase.from('inscricoes').select('id, eventos(*)').eq('aluno_id', alunoSelecionado.id)
      .then(({data}) => {
         const lista = data?.map(insc => ({ ...insc.eventos, inscricao_id: insc.id })) || []
         setEventosInscritos(lista)
      })
  }, [alunoSelecionado])

  function formatarMes(d) {
    const data = new Date(d)
    const offset = data.getTimezoneOffset() * 60000;
    return new Date(data.getTime() + offset).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Carregando Sistema...</div>

  // --- RENDERIZAÇÃO DO PAINEL DOS PAIS ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm">
          <div><h1 className="text-xl font-bold text-gray-800">Painel do Responsável</h1><p className="text-xs text-gray-500">Escolinha SDC</p></div>
          <button onClick={() => {supabase.auth.signOut(); router.push('/')}} className="text-red-600 px-2 text-xs hover:underline">Sair</button>
        </div>

        {alunos.length === 0 ? <div className="p-4 text-gray-600">Nenhum aluno encontrado. Se você acabou de se cadastrar, aguarde a confirmação ou entre em contato.</div> : (
          <>
            <div className="mb-6 flex items-center gap-3">
              {alunoSelecionado?.foto_url && <img src={alunoSelecionado.foto_url} className="w-12 h-12 rounded-full object-cover border-2 border-green-500" />}
              <select className="block w-full md:w-64 p-2 border rounded text-black bg-white shadow-sm" onChange={e => setAlunoSelecionado(alunos.find(a => a.id === e.target.value))} value={alunoSelecionado?.id}>
                {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

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
                  {eventosInscritos.length === 0 && <p className="text-sm opacity-60 text-green-900">Nenhuma.</p>}
                  <ul className="space-y-3">
                    {eventosInscritos.map((ev, i) => (
                      <li key={i} className="flex justify-between items-center border-b border-green-200 pb-2">
                         <div className="text-sm text-green-900"><p className="font-bold">{ev.titulo}</p></div>
                         <button onClick={() => cancelarInscricao(ev.inscricao_id)} className="text-red-600 text-xs border border-red-200 bg-white px-2 py-1 rounded hover:bg-red-50">Cancelar</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {/* Modal igual ao anterior, omitido por brevidade mas deve estar aqui */}
      {modalEvento && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button onClick={() => setModalEvento(null)} className="absolute top-4 right-4 text-gray-400 font-bold">X</button>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{modalEvento.titulo}</h2>
            <div className="space-y-2 text-gray-600 mb-6 text-sm">
              <p>📍 {modalEvento.local}</p>
              <p>💰 {modalEvento.valor > 0 ? `R$ ${modalEvento.valor}` : 'Grátis'}</p>
              <p className="bg-gray-100 p-2 rounded italic">{modalEvento.descricao}</p>
            </div>
            <button onClick={inscrever} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Confirmar Inscrição</button>
          </div>
        </div>
      )}
    </div>
  )
}