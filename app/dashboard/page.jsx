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
  
  // Estados
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [alunos, setAlunos] = useState([])
  const [alunoSelecionado, setAlunoSelecionado] = useState(null)
  
  const [mensalidades, setMensalidades] = useState([])
  const [eventosDisponiveis, setEventosDisponiveis] = useState([])
  const [eventosInscritos, setEventosInscritos] = useState([])
  
  const [modalEvento, setModalEvento] = useState(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setUser(user)

    // Checa Admin
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    setIsAdmin(profile?.is_admin)

    // Busca Alunos
    const { data: dataAlunos } = await supabase.from('alunos').select('*').eq('responsavel_id', user.id)
    if (dataAlunos?.length > 0) {
      setAlunos(dataAlunos)
      setAlunoSelecionado(dataAlunos[0])
    }
    
    // Busca Eventos Futuros (Geral)
    const { data: evs } = await supabase.from('eventos').select('*').gte('data_hora', new Date().toISOString()).order('data_hora')
    setEventosDisponiveis(evs || [])
    
    setLoading(false)
  }

  // Carrega dados específicos do filho selecionado
  useEffect(() => {
    if (!alunoSelecionado) return
    
    // 1. Mensalidades
    supabase.from('mensalidades')
      .select('*')
      .eq('aluno_id', alunoSelecionado.id)
      .order('vencimento', {ascending: false})
      .then(({data}) => setMensalidades(data || []))

    // 2. Inscrições deste aluno
    supabase.from('inscricoes')
      .select('*, eventos(*)')
      .eq('aluno_id', alunoSelecionado.id)
      .then(({data}) => {
         // Filtra para pegar apenas os objetos de evento
         const lista = data?.map(insc => ({ ...insc.eventos, status_pgto: insc.pago })) || []
         setEventosInscritos(lista)
      })

  }, [alunoSelecionado])

  function formatarMes(dataString) {
    // Corrige fuso
    const data = new Date(dataString)
    const userTimezoneOffset = data.getTimezoneOffset() * 60000;
    const dataCorrigida = new Date(data.getTime() + userTimezoneOffset);
    return dataCorrigida.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
  }

  async function inscrever() {
    if(!modalEvento) return;
    const { error } = await supabase.from('inscricoes').insert({ evento_id: modalEvento.id, aluno_id: alunoSelecionado.id })
    
    if (error) alert('Aluno já inscrito neste evento.')
    else {
      alert('Inscrição realizada com sucesso! 🎉')
      setModalEvento(null)
      // Recarrega a página para atualizar listas
      window.location.reload()
    }
  }

  if (loading) return <div className="p-10 text-center text-black">Carregando Painel...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Painel do Responsável</h1>
            <p className="text-xs text-gray-500">Escolinha SDC Guarapari</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && <button onClick={() => router.push('/admin')} className="bg-black text-white px-3 py-1 rounded text-xs font-bold">Admin</button>}
            <button onClick={() => {supabase.auth.signOut(); router.push('/')}} className="text-red-600 px-2 text-xs hover:underline">Sair</button>
          </div>
        </div>

        {alunos.length === 0 ? (
          <div className="bg-yellow-100 text-yellow-800 p-4 rounded">Nenhum aluno encontrado. Cadastre um novo aluno na tela inicial.</div>
        ) : (
          <>
            {/* SELEÇÃO DE FILHO */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase">Aluno Selecionado:</label>
              <div className="flex items-center gap-3 mt-1">
                {alunoSelecionado?.foto_url && (
                  <img src={alunoSelecionado.foto_url} alt="Foto" className="w-12 h-12 rounded-full object-cover border-2 border-green-500" />
                )}
                <select 
                  className="block w-full md:w-64 p-2 border rounded text-black bg-white shadow-sm"
                  onChange={e => setAlunoSelecionado(alunos.find(a => a.id === e.target.value))}
                  value={alunoSelecionado?.id}
                >
                  {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              
              {/* CARD MENSALIDADES */}
              <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
                <h2 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">💰 Mensalidades</h2>
                {mensalidades.length === 0 ? <p className="text-gray-400 text-sm">Nenhum histórico.</p> : (
                  <div className="space-y-3">
                    {mensalidades.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                        <div>
                          <p className="font-bold text-blue-900 text-sm">{formatarMes(m.mes_referencia)}</p>
                          <p className="text-xs text-gray-500">Venc: {m.vencimento} • R$ {m.valor}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {m.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* ÁREA PIX */}
                <div className="mt-6 border-t pt-4">
                  <p className="text-xs text-gray-500 font-bold mb-1">PAGAMENTO VIA PIX</p>
                  <div className="bg-gray-100 p-3 rounded text-center">
                    <p className="text-sm font-mono text-gray-800 break-all select-all">00.000.000/0001-00</p>
                    <p className="text-[10px] text-gray-400 mt-1">(CNPJ SDC Guarapari - Copie e Cole)</p>
                  </div>
                </div>
              </div>

              {/* CARD EVENTOS */}
              <div className="space-y-6">
                
                {/* PRÓXIMOS EVENTOS (Disponíveis) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                  <h2 className="font-bold text-lg mb-4 text-gray-800">🏆 Próximos Eventos</h2>
                  {eventosDisponiveis.length === 0 ? <p className="text-gray-400 text-sm">Nenhum evento aberto.</p> : (
                    <div className="space-y-3">
                      {eventosDisponiveis.map(ev => (
                        <div 
                          key={ev.id} 
                          onClick={() => setModalEvento(ev)}
                          className="cursor-pointer border-l-4 border-blue-500 pl-4 py-2 hover:bg-blue-50 transition rounded-r bg-gray-50"
                        >
                          <h3 className="font-bold text-gray-800 text-sm">{ev.titulo}</h3>
                          <p className="text-xs text-gray-500">📅 {new Date(ev.data_hora).toLocaleDateString()}</p>
                          <p className="text-xs text-blue-600 font-bold mt-1">Toque para inscrever &rarr;</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* EVENTOS JÁ INSCRITOS */}
                <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-green-100">
                  <h2 className="font-bold text-lg mb-4 text-green-800">✅ Inscrito em:</h2>
                  {eventosInscritos.length === 0 ? <p className="text-green-700 text-sm opacity-60">Nenhuma inscrição ativa.</p> : (
                    <ul className="space-y-2">
                      {eventosInscritos.map((ev, i) => (
                        <li key={i} className="text-sm text-green-900 flex items-center gap-2">
                           ⚽ {ev.titulo} 
                           <span className="text-[10px] bg-white px-2 rounded-full border border-green-200">
                             {new Date(ev.data_hora).toLocaleDateString()}
                           </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </div>
            </div>
          </>
        )}
      </div>

      {/* --- MODAL DE EVENTO --- */}
      {modalEvento && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setModalEvento(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black font-bold">X</button>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{modalEvento.titulo}</h2>
            <div className="space-y-3 text-gray-600 mb-6 text-sm">
              <p><strong>📍 Local:</strong> {modalEvento.local}</p>
              <p><strong>📅 Data:</strong> {new Date(modalEvento.data_hora).toLocaleString()}</p>
              <p><strong>💰 Valor:</strong> {modalEvento.valor > 0 ? `R$ ${modalEvento.valor}` : 'Grátis'}</p>
              <div className="bg-gray-100 p-3 rounded italic border-l-2 border-gray-300">
                {modalEvento.descricao || 'Sem descrição.'}
              </div>
            </div>

            <button 
              onClick={inscrever}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg transform active:scale-95 transition"
            >
              Confirmar Inscrição de {alunoSelecionado?.nome.split(' ')[0]}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}