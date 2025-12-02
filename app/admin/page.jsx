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
  const [busca, setBusca] = useState('') // Estado do Filtro
  
  // Dados
  const [mensalidades, setMensalidades] = useState([])
  const [eventos, setEventos] = useState([])
  const [alunos, setAlunos] = useState([])
  const [inscricoes, setInscricoes] = useState([])
  
  // Forms
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data: '', local: '', descricao: '', valor: '0' })
  const [novoAdmin, setNovoAdmin] = useState({ nome: '', email: '', senha: '' })

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
    
    // 1. Alunos (Trazendo tudo para o filtro funcionar)
    const { data: a } = await supabase
      .from('alunos')
      .select('*, profiles(nome_completo, email, telefone)')
      .order('nome')
    setAlunos(a || [])

    // 2. Eventos
    const { data: e } = await supabase.from('eventos').select('*').order('data_hora')
    setEventos(e || [])

    // 3. Inscrições (Para ver quem está inscrito)
    const { data: i } = await supabase
      .from('inscricoes')
      .select('*, alunos(nome, data_nascimento, endereco, profiles(nome_completo)), eventos(titulo)')
    setInscricoes(i || [])

    // 4. Mensalidades
    const { data: m } = await supabase
      .from('mensalidades')
      .select('*, alunos(nome, profiles(nome_completo))')
      .order('vencimento', { ascending: false })
    setMensalidades(m || [])

    setLoading(false)
  }

  // --- LÓGICA DE FILTRO INTELIGENTE ---
  function filtrar(lista, tipo) {
    if (!busca) return lista
    const termo = busca.toLowerCase()

    return lista.filter(item => {
      if (tipo === 'alunos') {
        const nome = item.nome?.toLowerCase() || ''
        const resp = item.profiles?.nome_completo?.toLowerCase() || ''
        const end = item.endereco?.toLowerCase() || '' // Bairro/Endereço
        const idade = calcularIdade(item.data_nascimento).toString()
        return nome.includes(termo) || resp.includes(termo) || end.includes(termo) || idade === termo
      }
      if (tipo === 'financeiro') {
        const aluno = item.alunos?.nome?.toLowerCase() || ''
        const resp = item.alunos?.profiles?.nome_completo?.toLowerCase() || ''
        return aluno.includes(termo) || resp.includes(termo)
      }
      return true
    })
  }

  function calcularIdade(dataNasc) {
    if (!dataNasc) return ''
    const hoje = new Date()
    const nasc = new Date(dataNasc)
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  // --- AÇÕES ADMIN ---

  async function criarAdmin(e) {
    e.preventDefault()
    // 1. Cria o usuário no Auth
    const { data, error } = await supabase.auth.signUp({
      email: novoAdmin.email,
      password: novoAdmin.senha,
      options: { data: { full_name: novoAdmin.nome } }
    })

    if (error) return alert('Erro ao criar usuário: ' + error.message)

    // 2. Força ele a ser Admin no Banco (Update)
    // O gatilho cria o perfil automaticamente, nós só atualizamos para TRUE
    setTimeout(async () => {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', data.user.id) // ID do novo usuário

      if (updateError) alert('Usuário criado, mas erro ao dar permissão Admin.')
      else {
        alert('Novo Administrador criado com sucesso!')
        setNovoAdmin({ nome: '', email: '', senha: '' })
      }
    }, 2000) // Espera 2s para garantir que o gatilho rodou
  }

  async function removerInscricao(id) {
    if(!confirm('Remover a inscrição deste aluno na competição?')) return;
    await supabase.from('inscricoes').delete().eq('id', id)
    carregarTudo()
  }

  async function deletarEvento(id) {
    if(!confirm('Isso apaga o evento e TODAS as inscrições dele.')) return;
    await supabase.from('inscricoes').delete().eq('evento_id', id)
    await supabase.from('eventos').delete().eq('id', id)
    carregarTudo()
  }

  async function criarEvento(e) {
    e.preventDefault()
    const { error } = await supabase.from('eventos').insert(novoEvento)
    if (!error) {
      alert('Evento criado!')
      setNovoEvento({ titulo: '', data: '', local: '', descricao: '', valor: '0' })
      carregarTudo()
    }
  }

  if (loading) return <div className="p-10 text-center font-bold">Carregando Admin...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">Painel Admin</h1>
          
          {/* BARRA DE PESQUISA */}
          <div className="w-full md:w-1/3">
             <input 
               placeholder="🔍 Pesquisar por nome, responsável, bairro ou idade..." 
               className="w-full p-3 rounded-full border shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-black"
               value={busca}
               onChange={e => setBusca(e.target.value)}
             />
          </div>
          
          <button onClick={() => router.push('/dashboard')} className="text-blue-600 underline text-sm">Voltar ao App</button>
        </div>

        {/* Menu */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['alunos', 'eventos', 'financeiro', 'equipe'].map(nome => (
            <button key={nome} onClick={() => setAba(nome)} 
              className={`px-4 py-2 rounded capitalize font-bold whitespace-nowrap ${aba === nome ? 'bg-black text-white' : 'bg-white text-gray-700'}`}>
              {nome === 'equipe' ? 'Gestionar Admins' : nome}
            </button>
          ))}
        </div>

        {/* 1. ABA ALUNOS */}
        {aba === 'alunos' && (
           <div className="bg-white p-6 rounded shadow">
             <h2 className="text-xl font-bold mb-4 text-black">Alunos ({filtrar(alunos, 'alunos').length})</h2>
             <div className="space-y-2">
               {filtrar(alunos, 'alunos').map(a => (
                 <div key={a.id} className="border-b py-3 hover:bg-gray-50 flex justify-between items-center">
                   <div>
                     <p className="font-bold text-gray-800 text-lg">{a.nome}</p>
                     <p className="text-sm text-gray-600">
                       {calcularIdade(a.data_nascimento)} anos • {a.posicao} • {a.endereco}
                     </p>
                     <p className="text-xs text-gray-400">Resp: {a.profiles?.nome_completo} ({a.profiles?.telefone})</p>
                   </div>
                 </div>
               ))}
               {filtrar(alunos, 'alunos').length === 0 && <p className="text-gray-500">Nenhum aluno encontrado.</p>}
             </div>
           </div>
        )}

        {/* 2. ABA EVENTOS (Com gestão de inscritos) */}
        {aba === 'eventos' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded shadow h-fit">
              <h2 className="text-xl font-bold mb-4 text-black">Criar Competição/Evento</h2>
              <form onSubmit={criarEvento} className="space-y-3">
                <input required placeholder="Título" className="w-full border p-2 rounded text-black" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} />
                <div className="flex gap-2">
                   <input required type="datetime-local" className="w-1/2 border p-2 rounded text-black" value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} />
                   <input type="number" placeholder="Valor R$" className="w-1/2 border p-2 rounded text-black" value={novoEvento.valor} onChange={e => setNovoEvento({...novoEvento, valor: e.target.value})} />
                </div>
                <input required placeholder="Local" className="w-full border p-2 rounded text-black" value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} />
                <button type="submit" className="w-full bg-green-600 text-white p-2 rounded font-bold">Criar</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded shadow">
              <h2 className="text-xl font-bold mb-4 text-black">Gerenciar Inscrições</h2>
              {eventos.map(ev => {
                const inscritosNesseEvento = inscricoes.filter(i => i.evento_id === ev.id)
                // Aplica o filtro de busca também nos inscritos
                const inscritosFiltrados = !busca ? inscritosNesseEvento : inscritosNesseEvento.filter(i => 
                  i.alunos.nome.toLowerCase().includes(busca.toLowerCase()) || 
                  i.alunos.profiles.nome_completo.toLowerCase().includes(busca.toLowerCase())
                )

                return (
                  <div key={ev.id} className="border-b mb-6 pb-4">
                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <p className="font-bold text-gray-800">{ev.titulo} <span className="text-sm font-normal">({inscritosNesseEvento.length} inscritos)</span></p>
                      <button onClick={() => deletarEvento(ev.id)} className="text-red-600 text-xs hover:underline">Deletar Evento</button>
                    </div>
                    
                    <div className="mt-2 pl-4 space-y-2">
                      {inscritosFiltrados.length === 0 ? <p className="text-xs text-gray-400 italic">Ninguém inscrito (ou não encontrado na busca).</p> : null}
                      {inscritosFiltrados.map(insc => (
                        <div key={insc.id} className="flex justify-between items-center text-sm border-b border-gray-100 py-1">
                          <span className="text-gray-700">{insc.alunos.nome} <span className="text-xs text-gray-400">({insc.alunos.profiles.nome_completo})</span></span>
                          <button 
                            onClick={() => removerInscricao(insc.id)}
                            className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs border border-red-200"
                          >
                            Remover Inscrição
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 3. ABA FINANCEIRO */}
        {aba === 'financeiro' && (
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-xl font-bold mb-4 text-black">Mensalidades</h2>
            {filtrar(mensalidades, 'financeiro').map(m => (
              <div key={m.id} className="flex justify-between items-center border-b py-2 text-gray-700">
                <span>{m.alunos?.nome} - {new Date(m.mes_referencia).toLocaleDateString('pt-BR', {month:'long'})}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* 4. ABA EQUIPE (CRIAR ADM) */}
        {aba === 'equipe' && (
          <div className="max-w-lg mx-auto bg-white p-8 rounded shadow">
            <h2 className="text-2xl font-bold mb-6 text-black text-center">Cadastrar Novo Administrador</h2>
            <div className="bg-blue-50 p-4 mb-4 rounded text-blue-800 text-sm">
              ℹ️ Este usuário terá acesso total ao sistema e <strong>não poderá cadastrar alunos</strong> (perfil exclusivo de gestão).
            </div>
            <form onSubmit={criarAdmin} className="space-y-4">
              <input required placeholder="Nome do Admin" className="w-full border p-3 rounded text-black" value={novoAdmin.nome} onChange={e => setNovoAdmin({...novoAdmin, nome: e.target.value})} />
              <input required type="email" placeholder="E-mail de Acesso" className="w-full border p-3 rounded text-black" value={novoAdmin.email} onChange={e => setNovoAdmin({...novoAdmin, email: e.target.value})} />
              <input required type="password" placeholder="Senha Forte" className="w-full border p-3 rounded text-black" value={novoAdmin.senha} onChange={e => setNovoAdmin({...novoAdmin, senha: e.target.value})} />
              <button type="submit" className="w-full bg-black text-white p-3 rounded font-bold hover:bg-gray-800">Criar Conta Admin</button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}