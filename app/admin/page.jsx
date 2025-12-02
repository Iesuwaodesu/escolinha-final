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
  
  // Dados
  const [mensalidades, setMensalidades] = useState([])
  const [eventos, setEventos] = useState([])
  const [alunos, setAlunos] = useState([])
  
  // Estados para Detalhes e Cadastros
  const [alunoDetalhe, setAlunoDetalhe] = useState(null) // O "Dossiê" do aluno
  const [novoAluno, setNovoAluno] = useState({ nome: '', data_nascimento: '', posicao: '', endereco: '', email_responsavel: '' })

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return router.push('/dashboard')
    
    carregarTudo()
  }

  async function carregarTudo() {
    setLoading(true)
    
    // 1. Mensalidades com dados do aluno
    const { data: m } = await supabase
      .from('mensalidades')
      .select('*, alunos(nome)')
      .order('vencimento', { ascending: false })
    setMensalidades(m || [])

    // 2. Alunos com dados do Responsável
    const { data: a } = await supabase
      .from('alunos')
      .select('*, profiles!inner(nome_completo, email, telefone)')
      .order('nome')
    setAlunos(a || [])

    // 3. Eventos
    const { data: e } = await supabase.from('eventos').select('*').order('data_hora')
    setEventos(e || [])

    setLoading(false)
  }

  // --- FUNÇÕES AUXILIARES ---
  function calcularIdade(dataNasc) {
    if (!dataNasc) return '--'
    const hoje = new Date()
    const nasc = new Date(dataNasc)
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  function formatarMes(dataString) {
    // Ex: 2025-12-01 -> Dezembro/2025
    const data = new Date(dataString)
    // Ajuste do fuso horário gambiarra simples para não voltar 1 dia
    const userTimezoneOffset = data.getTimezoneOffset() * 60000;
    const dataCorrigida = new Date(data.getTime() + userTimezoneOffset);
    return dataCorrigida.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
  }

  // --- AÇÕES ---
  async function cadastrarAlunoAdmin(e) {
    e.preventDefault()
    
    // 1. Achar o pai pelo email
    const { data: pai, error: erroPai } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', novoAluno.email_responsavel)
      .single()

    if (erroPai || !pai) {
      alert('ERRO: E-mail do responsável não encontrado! O pai precisa criar a conta no site primeiro.')
      return
    }

    // 2. Criar aluno
    const { error } = await supabase.from('alunos').insert({
      responsavel_id: pai.id,
      nome: novoAluno.nome,
      data_nascimento: novoAluno.data_nascimento,
      posicao: novoAluno.posicao,
      endereco: novoAluno.endereco
    })

    if (error) alert('Erro ao cadastrar: ' + error.message)
    else {
      alert('Aluno cadastrado com sucesso!')
      setNovoAluno({ nome: '', data_nascimento: '', posicao: '', endereco: '', email_responsavel: '' })
      carregarTudo()
    }
  }

  async function deletarAluno(id) {
    if(!confirm('Tem certeza absoluta? Isso apaga histórico financeiro e inscrições deste aluno.')) return;
    await supabase.from('inscricoes').delete().eq('aluno_id', id)
    await supabase.from('mensalidades').delete().eq('aluno_id', id)
    await supabase.from('alunos').delete().eq('id', id)
    setAlunoDetalhe(null) // Fecha o modal se estiver aberto
    carregarTudo()
  }

  async function alternarMensalidade(id, status) {
    const novoStatus = status === 'pago' ? 'pendente' : 'pago'
    await supabase.from('mensalidades').update({ status: novoStatus }).eq('id', id)
    carregarTudo() // Recarrega para atualizar a lista
    // Atualiza o detalhe se estiver aberto
    if (alunoDetalhe) {
      // Pequeno delay para dar tempo do banco atualizar
      setTimeout(async () => {
        const { data: m } = await supabase.from('mensalidades').select('*').eq('aluno_id', alunoDetalhe.id)
        setAlunoDetalhe(prev => ({ ...prev, mensalidades: m }))
      }, 500)
    }
  }

  // Abre o "Dossiê" do aluno
  async function abrirDetalhes(aluno) {
    // Busca dados extras desse aluno
    const { data: inscricoes } = await supabase.from('inscricoes').select('*, eventos(titulo)').eq('aluno_id', aluno.id)
    const { data: financeiro } = await supabase.from('mensalidades').select('*').eq('aluno_id', aluno.id).order('vencimento', {ascending: false})
    
    setAlunoDetalhe({
      ...aluno,
      historicoInscricoes: inscricoes || [],
      mensalidades: financeiro || []
    })
  }

  if (loading) return <div className="p-10 text-center font-bold">Carregando Sistema...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Painel Admin 🛡️</h1>
          <button onClick={() => router.push('/dashboard')} className="text-blue-600 underline">Voltar</button>
        </div>

        {/* MENU */}
        <div className="flex gap-4 mb-6 border-b pb-2">
          <button onClick={() => setAba('financeiro')} className={`px-4 py-2 rounded font-bold ${aba === 'financeiro' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Financeiro</button>
          <button onClick={() => setAba('alunos')} className={`px-4 py-2 rounded font-bold ${aba === 'alunos' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Alunos</button>
        </div>

        {/* --- ABA FINANCEIRO --- */}
        {aba === 'financeiro' && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-black">Fluxo de Caixa</h2>
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th>Referência</th><th>Aluno</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr>
              </thead>
              <tbody>
                {mensalidades.map(m => (
                  <tr key={m.id} className="border-b hover:bg-gray-50 text-gray-700">
                    <td className="p-3 font-bold text-blue-800">{formatarMes(m.mes_referencia)}</td>
                    <td>{m.alunos?.nome}</td>
                    <td>{m.vencimento}</td>
                    <td>R$ {m.valor}</td>
                    <td>
                      <button 
                        onClick={() => alternarMensalidade(m.id, m.status)}
                        className={`px-3 py-1 rounded text-xs font-bold w-24 ${
                          m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {m.status.toUpperCase()}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- ABA ALUNOS --- */}
        {aba === 'alunos' && (
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* LISTA DE ALUNOS (Esquerda) */}
            <div className="md:col-span-2 bg-white p-6 rounded shadow">
              <h2 className="text-xl font-bold mb-4 text-black">Lista de Atletas ({alunos.length})</h2>
              <div className="max-h-[600px] overflow-y-auto space-y-2">
                {alunos.map(a => (
                  <div 
                    key={a.id} 
                    onClick={() => abrirDetalhes(a)}
                    className="flex justify-between items-center p-4 border rounded hover:bg-blue-50 cursor-pointer transition"
                  >
                    <div>
                      <p className="font-bold text-lg text-gray-800">{a.nome}</p>
                      <p className="text-sm text-gray-500">{a.posicao} • {calcularIdade(a.data_nascimento)} anos</p>
                      <p className="text-xs text-gray-400">Resp: {a.profiles?.nome_completo}</p>
                    </div>
                    <span className="text-blue-600 text-sm font-bold">Ver Dossiê &rarr;</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CADASTRO MANUAL (Direita) */}
            <div className="bg-white p-6 rounded shadow h-fit">
              <h2 className="text-lg font-bold mb-4 text-black">Cadastrar Novo Aluno</h2>
              <form onSubmit={cadastrarAlunoAdmin} className="space-y-3">
                <input required placeholder="E-mail do Responsável (Já cadastrado)" className="w-full border p-2 rounded text-black bg-yellow-50" value={novoAluno.email_responsavel} onChange={e => setNovoAluno({...novoAluno, email_responsavel: e.target.value})} />
                <input required placeholder="Nome do Aluno" className="w-full border p-2 rounded text-black" value={novoAluno.nome} onChange={e => setNovoAluno({...novoAluno, nome: e.target.value})} />
                <input required type="date" className="w-full border p-2 rounded text-black" value={novoAluno.data_nascimento} onChange={e => setNovoAluno({...novoAluno, data_nascimento: e.target.value})} />
                <input required placeholder="Posição (ex: Goleiro)" className="w-full border p-2 rounded text-black" value={novoAluno.posicao} onChange={e => setNovoAluno({...novoAluno, posicao: e.target.value})} />
                <textarea placeholder="Endereço Completo" className="w-full border p-2 rounded text-black" value={novoAluno.endereco} onChange={e => setNovoAluno({...novoAluno, endereco: e.target.value})} />
                <button type="submit" className="w-full bg-black text-white p-2 rounded font-bold hover:bg-gray-800">Salvar Aluno</button>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* --- MODAL: DOSSIÊ DO ALUNO --- */}
      {alunoDetalhe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-8 relative max-h-screen overflow-y-auto">
            <button onClick={() => setAlunoDetalhe(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black font-bold text-xl">X</button>
            
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">{alunoDetalhe.nome}</h2>
                <p className="text-gray-500 text-lg">{alunoDetalhe.posicao} • {calcularIdade(alunoDetalhe.data_nascimento)} anos</p>
              </div>
              <button onClick={() => deletarAluno(alunoDetalhe.id)} className="bg-red-50 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-100">Excluir Aluno do Sistema</button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Lado Esquerdo: Dados Pessoais */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-bold text-gray-700 mb-2">📍 Endereço</h3>
                  <p className="text-gray-600">{alunoDetalhe.endereco || 'Endereço não cadastrado.'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="font-bold text-gray-700 mb-2">👨‍👩‍👦 Responsável</h3>
                  <p className="text-gray-600"><span className="font-bold">Nome:</span> {alunoDetalhe.profiles?.nome_completo}</p>
                  <p className="text-gray-600"><span className="font-bold">Email:</span> {alunoDetalhe.profiles?.email}</p>
                  <p className="text-gray-600"><span className="font-bold">Tel:</span> {alunoDetalhe.profiles?.telefone || 'Sem telefone'}</p>
                </div>
              </div>

              {/* Lado Direito: Eventos e Financeiro */}
              <div className="space-y-4">
                <div className="border rounded p-4">
                  <h3 className="font-bold text-gray-700 mb-2">🏆 Eventos Inscritos</h3>
                  {alunoDetalhe.historicoInscricoes?.length === 0 ? <p className="text-xs text-gray-400">Nenhum evento.</p> : (
                    <ul className="space-y-1">
                      {alunoDetalhe.historicoInscricoes?.map(i => (
                        <li key={i.id} className="text-sm text-gray-600 flex justify-between">
                          <span>{i.eventos?.titulo}</span>
                          <span className={i.pago ? 'text-green-600 font-bold' : 'text-red-500'}>{i.pago ? 'Pago' : 'A pagar'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border rounded p-4">
                  <h3 className="font-bold text-gray-700 mb-2">💰 Histórico Financeiro</h3>
                  <div className="max-h-40 overflow-y-auto">
                     {alunoDetalhe.mensalidades?.map(m => (
                       <div key={m.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                         <span className="text-gray-600">{formatarMes(m.mes_referencia)}</span>
                         <span className={`font-bold cursor-pointer ${m.status === 'pago' ? 'text-green-600' : 'text-red-600'}`} onClick={() => alternarMensalidade(m.id, m.status)}>
                           {m.status.toUpperCase()}
                         </span>
                       </div>
                     ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}