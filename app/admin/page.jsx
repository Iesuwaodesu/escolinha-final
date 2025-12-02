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
  const [userProfile, setUserProfile] = useState(null)

  // Dados
  const [alunos, setAlunos] = useState([])
  const [eventos, setEventos] = useState([])
  const [mensalidades, setMensalidades] = useState([])
  const [inscricoes, setInscricoes] = useState([])
  
  // Detalhes e Edição
  const [alunoDetalhe, setAlunoDetalhe] = useState(null)
  const [editandoAluno, setEditandoAluno] = useState(false)
  const [formEdicao, setFormEdicao] = useState({})
  const [eventoDetalhe, setEventoDetalhe] = useState(null) 
  
  // Forms
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data: '', local: '', descricao: '', valor: '' })
  const [arquivoEvento, setArquivoEvento] = useState(null)
  const [novoAdmin, setNovoAdmin] = useState({ nome: '', email: '', senha: '' })

  useEffect(() => { checkAdmin() }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setUserProfile(profile)
    
    if (!profile?.is_admin) {
      router.push('/dashboard')
    } else {
      carregarTudo()
    }
  }

  async function carregarTudo() {
    setLoading(true)
    
    // Alunos
    const { data: a } = await supabase.from('alunos').select('*, profiles(nome_completo, email, telefone)').order('nome')
    setAlunos(a || [])

    // Eventos
    const { data: e } = await supabase.from('eventos').select('*').order('data_hora')
    setEventos(e || [])

    // Inscrições
    const { data: i } = await supabase.from('inscricoes').select('*, alunos(nome, data_nascimento), profiles:alunos(responsavel_id, profiles(nome_completo, telefone))')
    setInscricoes(i || [])

    // Mensalidades (Trazendo telefone do pai para cobrança)
    const { data: m } = await supabase
      .from('mensalidades')
      .select('*, alunos(nome, profiles(nome_completo, telefone))')
      .order('vencimento', {ascending:false})
    setMensalidades(m || [])

    setLoading(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // --- FERRAMENTAS DE WHATSAPP --- //

  function enviarCobranca(fatura) {
    const tel = fatura.alunos?.profiles?.telefone?.replace(/\D/g, '')
    if (!tel) return alert('Telefone do responsável não cadastrado.')
    
    const mes = new Date(fatura.mes_referencia).toLocaleDateString('pt-BR', { month: 'long' })
    const aluno = fatura.alunos?.nome
    const valor = fatura.valor
    
    const msg = `Olá! ⚽ Passando para lembrar sobre a mensalidade de *${mes}* do atleta *${aluno}* (R$ ${valor}). \nPodemos confirmar o pagamento?`
    
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function copiarConviteEvento(ev) {
    const data = new Date(ev.data_hora).toLocaleString()
    const msg = `🏆 *NOVO EVENTO: ${ev.titulo}* 🏆\n\n📅 Data: ${data}\n📍 Local: ${ev.local}\n💰 Valor: ${ev.valor > 0 ? 'R$ '+ev.valor : 'Grátis'}\n\n📝 *Inscrições abertas no App da Escolinha!* \nEntre agora e garanta a vaga do seu craque.`
    
    navigator.clipboard.writeText(msg)
    alert('Texto do convite copiado! Agora cole no Grupo de Pais do WhatsApp.')
  }

  // --- AÇÕES DO SISTEMA --- //

  async function criarEvento(e) {
    e.preventDefault()
    let arquivoUrl = null
    if (arquivoEvento) {
      const nomeArquivo = `evento-${Date.now()}-${arquivoEvento.name}`
      const { error } = await supabase.storage.from('arquivos-eventos').upload(nomeArquivo, arquivoEvento)
      if (!error) {
        const { data } = supabase.storage.from('arquivos-eventos').getPublicUrl(nomeArquivo)
        arquivoUrl = data.publicUrl
      }
    }
    const { error } = await supabase.from('eventos').insert({
      titulo: novoEvento.titulo, data_hora: novoEvento.data, local: novoEvento.local, 
      descricao: novoEvento.descricao, valor: Number(novoEvento.valor), arquivo_url: arquivoUrl
    })
    if (error) alert(error.message); else { alert('Evento criado!'); setNovoEvento({ titulo: '', data: '', local: '', descricao: '', valor: '' }); setArquivoEvento(null); carregarTudo(); }
  }

  async function deletarEvento(id) {
    if(!confirm('Deletar evento?')) return;
    await supabase.from('inscricoes').delete().eq('evento_id', id)
    await supabase.from('eventos').delete().eq('id', id)
    carregarTudo()
  }

  async function alternarPagamentoInscricao(idInscricao, statusAtual) {
    await supabase.from('inscricoes').update({ pago: !statusAtual }).eq('id', idInscricao)
    setInscricoes(prev => prev.map(i => i.id === idInscricao ? {...i, pago: !statusAtual} : i))
  }

  async function criarAdmin(e) {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({ email: novoAdmin.email, password: novoAdmin.senha, options: { data: { full_name: novoAdmin.nome } } })
    if (error) return alert(error.message)
    setTimeout(async () => { await supabase.from('profiles').update({ is_admin: true }).eq('id', data.user.id); alert('Admin criado!'); setNovoAdmin({ nome: '', email: '', senha: '' }) }, 1500)
  }

  // Edição de Aluno
  function abrirDetalhes(aluno) {
    setAlunoDetalhe(aluno); setEditandoAluno(false)
    setFormEdicao({ nome: aluno.nome, posicao: aluno.posicao, data_nascimento: aluno.data_nascimento, endereco: aluno.endereco })
  }
  async function salvarEdicaoAluno() {
    const { error } = await supabase.from('alunos').update(formEdicao).eq('id', alunoDetalhe.id)
    if (!error) { alert('Atualizado!'); setEditandoAluno(false); carregarTudo(); setAlunoDetalhe({ ...alunoDetalhe, ...formEdicao }); }
  }
  async function deletarAluno(id) {
    if(!confirm('Apagar aluno?')) return;
    await supabase.from('inscricoes').delete().eq('aluno_id', id)
    await supabase.from('mensalidades').delete().eq('aluno_id', id)
    await supabase.from('alunos').delete().eq('id', id)
    setAlunoDetalhe(null); carregarTudo()
  }
  async function alternarMensalidade(id, status) {
    const novoStatus = status === 'pago' ? 'pendente' : 'pago'
    await supabase.from('mensalidades').update({ status: novoStatus }).eq('id', id)
    carregarTudo()
  }

  const alunosFiltrados = alunos.filter(a => a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.profiles?.nome_completo?.toLowerCase().includes(busca.toLowerCase()))

  if (loading) return <div className="p-10 text-center font-bold">Carregando Admin...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded shadow-sm">
          <div><h1 className="text-2xl font-bold text-gray-800">Painel Admin</h1><p className="text-xs text-gray-400">Logado: {userProfile?.email}</p></div>
          <div className="flex gap-3 items-center w-full md:w-auto">
            <input placeholder="🔍 Buscar..." className="p-2 border rounded w-full md:w-64 text-black text-sm" value={busca} onChange={e => setBusca(e.target.value)} />
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-bold">SAIR</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto">
          {['alunos', 'eventos', 'financeiro', 'equipe'].map(nome => (
            <button key={nome} onClick={() => setAba(nome)} className={`px-6 py-2 rounded-t-lg font-bold capitalize ${aba === nome ? 'bg-white border-t border-l border-r border-gray-200 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{nome}</button>
          ))}
        </div>

        {aba === 'alunos' && (
          <div className="bg-white p-6 rounded shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Gerenciar Alunos ({alunosFiltrados.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {alunosFiltrados.map(a => (
                <div key={a.id} onClick={() => abrirDetalhes(a)} className="border p-4 rounded hover:bg-gray-50 cursor-pointer flex gap-3 items-center">
                   {a.foto_url ? <img src={a.foto_url} className="w-10 h-10 rounded-full object-cover"/> : <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">👤</div>}
                   <div><p className="font-bold text-gray-800">{a.nome}</p><p className="text-xs text-gray-500">{a.posicao} • Resp: {a.profiles?.nome_completo}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === 'eventos' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded shadow h-fit">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Criar Evento</h3>
              <form onSubmit={criarEvento} className="space-y-3">
                <input required placeholder="Título" className="w-full border p-2 rounded text-black" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} />
                <input required type="datetime-local" className="w-full border p-2 rounded text-black" value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} />
                <input required placeholder="Local" className="w-full border p-2 rounded text-black" value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} />
                <input type="number" placeholder="Valor (R$)" className="w-full border p-2 rounded text-black" value={novoEvento.valor} onChange={e => setNovoEvento({...novoEvento, valor: e.target.value})} />
                <textarea placeholder="Descrição" className="w-full border p-2 rounded text-black" value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} />
                <div className="text-sm"><label>Cartaz/PDF:</label><input type="file" onChange={e => setArquivoEvento(e.target.files[0])} /></div>
                <button className="w-full bg-green-600 text-white font-bold p-2 rounded">Criar</button>
              </form>
            </div>
            <div className="md:col-span-2 bg-white p-6 rounded shadow">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Eventos Ativos</h3>
              {eventos.map(ev => {
                const qtd = inscricoes.filter(i => i.evento_id === ev.id).length
                return (
                  <div key={ev.id} className="border-b py-3 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-800">{ev.titulo}</p>
                      <p className="text-sm text-gray-500">{new Date(ev.data_hora).toLocaleString()} • {ev.valor > 0 ? `R$ ${ev.valor}` : 'Grátis'}</p>
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setEventoDetalhe(ev)} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200">👥 Ver {qtd} Inscritos</button>
                        <button onClick={() => copiarConviteEvento(ev)} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 border border-green-200">📋 Copiar Convite Zap</button>
                      </div>
                    </div>
                    <button onClick={() => deletarEvento(ev.id)} className="text-red-500 border border-red-200 px-3 py-1 rounded text-sm">Excluir</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {aba === 'financeiro' && (
          <div className="bg-white p-6 rounded shadow">
             <h3 className="font-bold text-lg mb-4 text-gray-800">Mensalidades</h3>
             <table className="w-full text-left">
               <thead className="bg-gray-50 text-gray-600"><tr><th className="p-2">Aluno</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Avisar</th></tr></thead>
               <tbody>
                 {mensalidades.map(m => (
                   <tr key={m.id} className="border-b text-gray-700">
                     <td className="p-2">{m.alunos?.nome}</td><td>{m.vencimento}</td><td>R$ {m.valor}</td>
                     <td><button onClick={() => alternarMensalidade(m.id, m.status)} className={`px-2 py-1 rounded text-xs font-bold w-20 ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status.toUpperCase()}</button></td>
                     <td>
                        {m.status !== 'pago' && (
                          <button onClick={() => enviarCobranca(m)} className="bg-green-500 text-white p-1 rounded hover:bg-green-600" title="Cobrar no WhatsApp">📱 Cobrar</button>
                        )}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        )}

        {aba === 'equipe' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded shadow border-l-4 border-blue-600">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Cadastrar Novo Admin</h2>
            <form onSubmit={criarAdmin} className="space-y-4">
              <input required placeholder="Nome" className="w-full border p-3 rounded text-black" value={novoAdmin.nome} onChange={e => setNovoAdmin({...novoAdmin, nome: e.target.value})} />
              <input required type="email" placeholder="E-mail" className="w-full border p-3 rounded text-black" value={novoAdmin.email} onChange={e => setNovoAdmin({...novoAdmin, email: e.target.value})} />
              <input required type="password" placeholder="Senha" className="w-full border p-3 rounded text-black" value={novoAdmin.senha} onChange={e => setNovoAdmin({...novoAdmin, senha: e.target.value})} />
              <button className="w-full bg-blue-600 text-white p-3 rounded font-bold">Criar Admin</button>
            </form>
          </div>
        )}
      </div>

      {/* MODAL DETALHES ALUNO COM EDIÇÃO */}
      {alunoDetalhe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative">
            <button onClick={() => setAlunoDetalhe(null)} className="absolute top-4 right-4 text-gray-400 font-bold text-xl">X</button>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">{editandoAluno ? 'Editar Aluno' : alunoDetalhe.nome}</h2>
              {!editandoAluno && <button onClick={() => setEditandoAluno(true)} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm font-bold border border-yellow-300">✏️ Editar</button>}
            </div>
            {editandoAluno ? (
              <div className="space-y-3">
                <input className="w-full border p-2 rounded text-black" value={formEdicao.nome} onChange={e => setFormEdicao({...formEdicao, nome: e.target.value})} placeholder="Nome" />
                <input className="w-full border p-2 rounded text-black" value={formEdicao.posicao} onChange={e => setFormEdicao({...formEdicao, posicao: e.target.value})} placeholder="Posição" />
                <input type="date" className="w-full border p-2 rounded text-black" value={formEdicao.data_nascimento} onChange={e => setFormEdicao({...formEdicao, data_nascimento: e.target.value})} />
                <textarea className="w-full border p-2 rounded text-black" value={formEdicao.endereco} onChange={e => setFormEdicao({...formEdicao, endereco: e.target.value})} placeholder="Endereço" />
                <div className="flex gap-2 mt-4"><button onClick={salvarEdicaoAluno} className="flex-1 bg-green-600 text-white py-2 rounded font-bold">Salvar</button><button onClick={() => setEditandoAluno(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded font-bold">Cancelar</button></div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600"><strong>Posição:</strong> {alunoDetalhe.posicao}</p>
                <p className="text-gray-600"><strong>Nasc:</strong> {alunoDetalhe.data_nascimento}</p>
                <p className="text-gray-600"><strong>Endereço:</strong> {alunoDetalhe.endereco}</p>
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-500"><p><strong>Resp:</strong> {alunoDetalhe.profiles?.nome_completo}</p><p><strong>Tel:</strong> {alunoDetalhe.profiles?.telefone}</p></div>
                <button onClick={() => deletarAluno(alunoDetalhe.id)} className="w-full bg-red-100 text-red-700 py-2 rounded font-bold mt-2">🗑️ Excluir</button>
              </div>
            )}
          </div>
        </div>
      )}

      {eventoDetalhe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[80vh] overflow-y-auto">
            <button onClick={() => setEventoDetalhe(null)} className="absolute top-4 right-4 text-gray-400 font-bold text-xl">X</button>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Inscritos: {eventoDetalhe.titulo}</h2>
            <div className="space-y-2">
              {inscricoes.filter(i => i.evento_id === eventoDetalhe.id).map(insc => (
                <div key={insc.id} className="flex justify-between items-center border-b pb-2">
                  <div><p className="font-bold text-gray-700">{insc.alunos?.nome}</p><p className="text-xs text-gray-500">Resp: {insc.profiles?.nome_completo}</p></div>
                  <div className="flex gap-2">
                    {eventoDetalhe.valor > 0 && <button onClick={() => alternarPagamentoInscricao(insc.id, insc.pago)} className={`text-xs px-2 py-1 rounded font-bold ${insc.pago ? 'bg-green-600 text-white' : 'bg-yellow-100 text-yellow-700 border border-yellow-300'}`}>{insc.pago ? 'PAGO' : 'RECEBER'}</button>}
                    <button onClick={() => {if(confirm('Remover?')) {supabase.from('inscricoes').delete().eq('id', insc.id).then(()=>carregarTudo())}}} className="text-red-600 text-xs border border-red-200 px-2 py-1 rounded">Remover</button>
                  </div>
                </div>
              ))}
              {inscricoes.filter(i => i.evento_id === eventoDetalhe.id).length === 0 && <p className="text-gray-400">Nenhum inscrito.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}