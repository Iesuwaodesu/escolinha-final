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
  const [alunos, setAlunos] = useState([])
  const [alunoSelecionado, setAlunoSelecionado] = useState(null)
  const [mensalidades, setMensalidades] = useState([])
  const [eventos, setEventos] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Checa se é admin para mostrar botão extra
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      setIsAdmin(profile?.is_admin)

      // Busca Filhos
      const { data: dataAlunos } = await supabase.from('alunos').select('*').eq('responsavel_id', user.id)
      if (dataAlunos?.length > 0) {
        setAlunos(dataAlunos)
        setAlunoSelecionado(dataAlunos[0])
      }

      // Busca Eventos Futuros
      const { data: dataEventos } = await supabase
        .from('eventos')
        .select('*')
        .gte('data_hora', new Date().toISOString()) // Apenas eventos futuros
        .order('data_hora')
      setEventos(dataEventos || [])
      
      setLoading(false)
    }
    carregar()
  }, [])

  useEffect(() => {
    if (!alunoSelecionado) return
    supabase.from('mensalidades').select('*').eq('aluno_id', alunoSelecionado.id).then(({data}) => setMensalidades(data || []))
  }, [alunoSelecionado])

  async function inscrever(eventoId) {
    if(!confirm(`Inscrever ${alunoSelecionado.nome} neste evento?`)) return;
    
    const { error } = await supabase.from('inscricoes').insert({
      evento_id: eventoId,
      aluno_id: alunoSelecionado.id
    })

    if (error) alert('Erro: Talvez o aluno já esteja inscrito.')
    else alert('Inscrição realizada com sucesso! ⚽')
  }

  if (loading) return <div className="p-10 text-center text-black">Carregando painel...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* CABEÇALHO */}
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Painel dos Pais</h1>
            <p className="text-sm text-gray-500">Bem-vindo(a) à escolinha.</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button onClick={() => router.push('/admin')} className="bg-black text-white px-4 py-2 rounded text-sm font-bold">
                Acessar Admin 👔
              </button>
            )}
            <button onClick={() => {supabase.auth.signOut(); router.push('/')}} className="text-red-600 px-3 py-2 text-sm hover:underline">
              Sair
            </button>
          </div>
        </div>

        {alunos.length === 0 ? (
          <div className="bg-yellow-100 p-4 rounded text-yellow-800">
            ⚠️ Nenhum aluno encontrado. Entre em contato com a secretaria.
          </div>
        ) : (
          <>
            {/* SELEÇÃO DE ALUNO */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase">Visualizando:</label>
              <select 
                className="block mt-1 w-full md:w-64 p-2 border rounded text-black bg-white"
                onChange={e => setAlunoSelecionado(alunos.find(a => a.id === e.target.value))}
              >
                {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              
              {/* COLUNA 1: MENSALIDADES */}
              <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
                <h2 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">💰 Mensalidades</h2>
                {mensalidades.length === 0 ? <p className="text-gray-400 italic">Tudo em dia!</p> : (
                  <div className="space-y-3">
                    {mensalidades.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                        <div>
                          <p className="font-semibold text-gray-700 text-sm">Venc: {m.vencimento}</p>
                          <p className="text-xs text-gray-500">Valor: R$ {m.valor}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {m.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* COLUNA 2: PRÓXIMOS EVENTOS */}
              <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
                <h2 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">🏆 Próximos Eventos</h2>
                {eventos.length === 0 ? <p className="text-gray-400 italic">Nenhum evento agendado.</p> : (
                  <div className="space-y-4">
                    {eventos.map(ev => (
                      <div key={ev.id} className="border-l-4 border-blue-500 pl-4 py-2">
                        <h3 className="font-bold text-gray-800">{ev.titulo}</h3>
                        <p className="text-xs text-gray-500">📅 {new Date(ev.data_hora).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">📍 {ev.local}</p>
                        {ev.descricao && <p className="text-xs text-gray-600 mt-1 italic">"{ev.descricao}"</p>}
                        
                        <button 
                          onClick={() => inscrever(ev.id)}
                          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded transition"
                        >
                          Inscrever {alunoSelecionado.nome.split(' ')[0]}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  )
}