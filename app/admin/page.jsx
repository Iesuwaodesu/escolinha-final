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
  
  // Forms Criação
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data: '', local: '', descricao: '', valor: '' })
  const [arquivoEvento, setArquivoEvento] = useState(null)
  const [novoAdmin, setNovoAdmin] = useState({ nome: '', email: '', senha: '' })
  const [novaCobranca, setNovaCobranca] = useState({ aluno_id: '', mes: '', valor: '150' })

  // --- ESTADOS DA CARTEIRINHA ---
  const [configCarteirinha, setConfigCarteirinha] = useState({
    titulo: 'CAMPEONATO OFICIAL SDC',
    equipe: 'SDC GUARAPARI',
    fundo: null // URL da imagem de fundo
  })

  useEffect(() => { checkAdmin() }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/')
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setUserProfile(profile)
    if (!profile?.is_admin) router.push('/dashboard')
    else carregarTudo()
  }

  async function carregarTudo() {
    setLoading(true)
    const { data: a } = await supabase.from('alunos').select('*, profiles(nome_completo, email, telefone)').order('nome')
    setAlunos(a || [])
    const { data: e } = await supabase.from('eventos').select('*').order('data_hora')
    setEventos(e || [])
    const { data: i } = await supabase.from('inscricoes').select('*, alunos(nome, data_nascimento), profiles:alunos(responsavel_id, profiles(nome_completo, telefone))')
    setInscricoes(i || [])
    const { data: m } = await supabase.from('mensalidades').select('*, alunos(nome, profiles(nome_completo, telefone))')
    setMensalidades(m || [])
    setLoading(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // --- FUNÇÕES DA CARTEIRINHA ---
  function handleFundoCarteirinha(e) {
    if (e.target.files && e.target.files[0]) {
      // Cria uma URL temporária para ver a imagem na hora sem precisar subir no banco
      const url = URL.createObjectURL(e.target.files[0])
      setConfigCarteirinha({ ...configCarteirinha, fundo: url })
    }
  }

  function imprimirCarteirinhas() {
    window.print()
  }

  // --- FUNÇÕES GERAIS ---
  function enviarCobranca(fatura) {
    const tel = fatura.alunos?.profiles?.telefone?.replace(/\D/g, '')
    if (!tel) return alert('Telefone não cadastrado.')
    const msg = `Olá! ⚽ Passando para lembrar sobre a mensalidade de ${new Date(fatura.mes_referencia).toLocaleDateString('pt-BR', { month: 'long' })} do atleta ${fatura.alunos?.nome}.`
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function copiarConviteEvento(ev) {
    const msg = `🏆 *${ev.titulo}* 🏆\n📅 Data: ${new Date(ev.data_hora).toLocaleString()}\n📍 Local: ${ev.local}\n📝 Inscrições no App!`
    navigator.clipboard.writeText(msg)
    alert('Convite copiado!')
  }

  // --- CRUD ---
  async function criarEvento(e) {
    e.preventDefault()
    let arquivoUrl = null
    if (arquivoEvento) {
      const nomeArquivo = `evento-${Date.now()}-${arquivoEvento.name}`
      await supabase.storage.from('arquivos-eventos').upload(nomeArquivo, arquivoEvento)
      const { data } = supabase.storage.from('arquivos-eventos').getPublicUrl(nomeArquivo)
      arquivoUrl = data.publicUrl
    }
    const { error } = await supabase.from('eventos').insert({ ...novoEvento, valor: Number(novoEvento.valor), arquivo_url: arquivoUrl })
    if (!error) { alert('Criado!'); carregarTudo(); }
  }

  async function deletarEvento(id) { if(confirm('Apagar?')) { await supabase.from('inscricoes').delete().eq('evento_id', id); await supabase.from('eventos').delete().eq('id', id); carregarTudo() } }
  
  async function removerInscricaoDoEvento(id) { if(confirm('Remover aluno?')) { await supabase.from('inscricoes').delete().eq('id', id); carregarTudo() } }
  
  async function criarAdmin(e) {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({ email: novoAdmin.email, password: novoAdmin.senha, options: { data: { full_name: novoAdmin.nome } } })
    if (!error) { setTimeout(async () => { await supabase.from('profiles').update({ is_admin: true }).eq('id', data.user.id); alert('Admin criado!'); }, 1500) }
  }

  async function criarMensalidadeManual(e) {
    e.preventDefault()
    if(!novaCobranca.aluno_id) return
    await supabase.from('mensalidades').insert({ aluno_id: novaCobranca.aluno_id, mes_referencia: novaCobranca.mes+'-01', valor: novaCobranca.valor, vencimento: novaCobranca.mes+'-10', status: 'pendente' })
    carregarTudo(); alert('Gerada!')
  }

  // Edição Aluno
  function abrirDetalhes(aluno) { setAlunoDetalhe(aluno); setEditandoAluno(false); setFormEdicao({ nome: aluno.nome, posicao: aluno.posicao, data_nascimento: aluno.data_nascimento, endereco: aluno.endereco, data_inicio_pagamento: aluno.data_inicio_pagamento }) }
  async function salvarEdicaoAluno() { await supabase.from('alunos').update(formEdicao).eq('id', alunoDetalhe.id); alert('Salvo!'); setEditandoAluno(false); carregarTudo(); setAlunoDetalhe({...alunoDetalhe, ...formEdicao}) }
  async function deletarAluno(id) { if(confirm('Apagar tudo?')) { await supabase.from('inscricoes').delete().eq('aluno_id', id); await supabase.from('mensalidades').delete().eq('aluno_id', id); await supabase.from('alunos').delete().eq('id', id); setAlunoDetalhe(null); carregarTudo() } }

  const alunosFiltrados = alunos.filter(a => a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.profiles?.nome_completo?.toLowerCase().includes(busca.toLowerCase()))

  if (loading) return <div className="p-10 text-center font-bold">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER (Esconde na impressão) */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded shadow-sm print:hidden">
          <div><h1 className="text-2xl font-bold text-gray-800">Painel Admin</h1><p className="text-xs text-gray-400">Logado: {userProfile?.email}</p></div>
          <div className="flex gap-3 w-full md:w-auto">
            <input placeholder="🔍 Buscar..." className="p-2 border rounded w-full md:w-64 text-black text-sm" value={busca} onChange={e => setBusca(e.target.value)} />
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-bold">SAIR</button>
          </div>
        </div>

        {/* MENU (Esconde na impressão) */}
        <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto print:hidden">
          {['alunos', 'eventos', 'financeiro', 'equipe', 'carteirinhas'].map(nome => (
            <button key={nome} onClick={() => setAba(nome)} className={`px-6 py-2 rounded-t-lg font-bold capitalize ${aba === nome ? 'bg-white border-t border-l border-r border-gray-200 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{nome}</button>
          ))}
        </div>

        {/* --- ABA CARTEIRINHAS --- */}
        {aba === 'carteirinhas' && (
          <div>
            {/* CONFIGURAÇÃO (Esconde na impressão) */}
            <div className="bg-white p-6 rounded shadow mb-8 print:hidden">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Configurar Carteirinhas</h2>
              <div className="grid md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs font-bold text-gray-500">Título do Evento</label>
                  <input className="w-full border p-2 rounded text-black" value={configCarteirinha.titulo} onChange={e => setConfigCarteirinha({...configCarteirinha, titulo: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Nome da Equipe</label>
                  <input className="w-full border p-2 rounded text-black" value={configCarteirinha.equipe} onChange={e => setConfigCarteirinha({...configCarteirinha, equipe: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Imagem de Fundo</label>
                  <input type="file" className="w-full text-xs" onChange={handleFundoCarteirinha} />
                </div>
                <button onClick={imprimirCarteirinhas} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2">
                  🖨️ IMPRIMIR TODOS
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Dica: Ajuste a margem da impressora para "Nenhuma" nas configurações do navegador.</p>
            </div>

            {/* ÁREA DE VISUALIZAÇÃO / IMPRESSÃO */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-2 print:w-full">
              {alunosFiltrados.map(a => (
                <div key={a.id} className="relative border border-black overflow-hidden bg-white print:break-inside-avoid" style={{ width: '85mm', height: '54mm', pageBreakInside: 'avoid' }}>
                  
                  {/* Fundo */}
                  {configCarteirinha.fundo ? (
                    <img src={configCarteirinha.fundo} className="absolute inset-0 w-full h-full object-cover z-0 opacity-90" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-800 z-0" />
                  )}

                  {/* Conteúdo */}
                  <div className="relative z-10 p-2 h-full flex flex-col justify-between text-white">
                    {/* Topo */}
                    <div className="text-center border-b border-white/30 pb-1">
                      <h3 className="font-bold text-[10px] tracking-widest uppercase">{configCarteirinha.titulo}</h3>
                    </div>

                    {/* Centro */}
                    <div className="flex items-center gap-3">
                      <div className="w-[22mm] h-[28mm] bg-white border-2 border-white overflow-hidden shadow-sm flex-shrink-0">
                        {a.foto_url ? (
                          <img src={a.foto_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-xs">FOTO</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-[8px] uppercase text-green-100">Nome do Atleta</p>
                        <p className="font-bold text-sm leading-tight mb-1">{a.nome}</p>
                        
                        <div className="flex gap-4">
                          <div>
                            <p className="text-[8px] uppercase text-green-100">Nasc.</p>
                            <p className="font-bold text-xs">{a.data_nascimento ? a.data_nascimento.split('-')[0] : '--'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase text-green-100">Posição</p>
                            <p className="font-bold text-xs">{a.posicao || 'JOGADOR'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rodapé */}
                    <div className="bg-black/40 -mx-2 -mb-2 p-1 text-center">
                      <p className="text-[9px] font-bold tracking-widest text-yellow-400 uppercase">{configCarteirinha.equipe}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA ALUNOS */}
        {aba === 'alunos' && (
          <div className="bg-white p-6 rounded shadow-sm print:hidden">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Gerenciar Alunos ({alunosFiltrados.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {alunosFiltrados.map(a => (
                <div key={a.id} className="border p-4 rounded hover:bg-gray-50 flex gap-3 items-center relative group">
                   <div onClick={() => abrirDetalhes(a)} className="flex-1 cursor-pointer flex gap-3 items-center">
                     {a.foto_url ? <img src={a.foto_url} className="w-12 h-12 rounded-full object-cover border"/> : <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">👤</div>}
                     <div>
                       <p className="font-bold text-gray-800">{a.nome}</p>
                       <p className="text-xs text-gray-500 font-bold">{a.posicao}</p>
                       <p className="text-xs text-gray-400">Resp: {a.profiles?.nome_completo}</p>
                     </div>
                   </div>
                   <button onClick={() => enviarCobranca({alunos: a, valor: 'Mensalidade', mes_referencia: new Date().toISOString()})} className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 shadow-sm">📱</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA EVENTOS */}
        {aba === 'eventos' && (
          <div className="grid md:grid-cols-3 gap-6 print:hidden">
            <div className="bg-white p-6 rounded shadow h-fit">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Novo Evento</h3>
              <form onSubmit={criarEvento} className="space-y-3">
                <input required placeholder="Título" className="w-full border p-2 rounded text-black" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} />
                <input required type="datetime-local" className="w-full border p-2 rounded text-black" value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} />
                <input required placeholder="Local" className="w-full border p-2 rounded text-black" value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} />
                <input type="number" placeholder="Valor" className="w-full border p-2 rounded text-black" value={novoEvento.valor} onChange={e => setNovoEvento({...novoEvento, valor: e.target.value})} />
                <textarea placeholder="Descrição" className="w-full border p-2 rounded text-black" value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} />
                <div className="text-sm"><label>Cartaz:</label><input type="file" onChange={e => setArquivoEvento(e.target.files[0])} /></div>
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
                        <button onClick={() => copiarConviteEvento(ev)} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded border border-green-200">📋 Convite Zap</button>
                      </div>
                    </div>
                    <button onClick={() => deletarEvento(ev.id)} className="text-red-500 border border-red-200 px-3 py-1 rounded text-sm">Excluir</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ABA FINANCEIRO */}
        {aba === 'financeiro' && (
          <div className="bg-white p-6 rounded shadow print:hidden">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-lg text-gray-800">Mensalidades</h3>
               <form onSubmit={criarMensalidadeManual} className="flex gap-2 items-center bg-gray-50 p-2 rounded border">
                 <select className="border rounded p-1 text-sm w-32 text-black" onChange={e => setNovaCobranca({...novaCobranca, aluno_id: e.target.value})}>
                   <option value="">Aluno...</option>
                   {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                 </select>
                 <input type="month" className="border rounded p-1 text-sm text-black" onChange={e => setNovaCobranca({...novaCobranca, mes: e.target.value})} />
                 <input type="number" placeholder="R$" className="border rounded p-1 text-sm w-16 text-black" value={novaCobranca.valor} onChange={e => setNovaCobranca({...novaCobranca, valor: e.target.value})} />
                 <button type="submit" className="bg-black text-white px-2 py-1 rounded text-xs">Gerar</button>
               </form>
             </div>
             <table className="w-full text-left">
               <thead className="bg-gray-50 text-gray-600"><tr><th className="p-2">Aluno</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Avisar</th></tr></thead>
               <tbody>
                 {mensalidades.map(m => (
                   <tr key={m.id} className="border-b text-gray-700">
                     <td className="p-2">{m.alunos?.nome}</td><td>{m.vencimento}</td><td>R$ {m.valor}</td>
                     <td><button className={`px-2 py-1 rounded text-xs font-bold w-20 ${m.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status.toUpperCase()}</button></td>
                     <td>{m.status !== 'pago' && <button onClick={() => enviarCobranca(m)} className="bg-green-500 text-white p-1 rounded hover:bg-green-600">📱 Cobrar</button>}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        )}

        {/* ABA EQUIPE */}
        {aba === 'equipe' && (
          <div className="bg-white p-6 rounded shadow max-w-md mx-auto print:hidden">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Adicionar Admin</h2>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative">
            <button onClick={() => setAlunoDetalhe(null)} className="absolute top-4 right-4 text-gray-400 font-bold text-xl">X</button>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">{editandoAluno ? 'Editar Aluno' : alunoDetalhe.nome}</h2>
              {!editandoAluno && <button onClick={() => setEditandoAluno(true)} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm font-bold border border-yellow-300">✏️ Editar</button>}
            </div>
            {editandoAluno ? (
              <div className="space-y-3">
                <input className="w-full border p-2 rounded text-black" value={formEdicao.nome} onChange={e => setFormEdicao({...formEdicao, nome: e.target.value})} placeholder="Nome" />
                <div className="flex gap-2"><input className="w-1/2 border p-2 rounded text-black" value={formEdicao.posicao} onChange={e => setFormEdicao({...formEdicao, posicao: e.target.value})} placeholder="Posição" /><input className="w-1/2 border p-2 rounded text-black" type="date" value={formEdicao.data_nascimento} onChange={e => setFormEdicao({...formEdicao, data_nascimento: e.target.value})} /></div>
                <textarea className="w-full border p-2 rounded text-black" value={formEdicao.endereco} onChange={e => setFormEdicao({...formEdicao, endereco: e.target.value})} placeholder="Endereço" />
                <label className="text-xs font-bold text-gray-500">Início Pagamento:</label><input type="date" className="w-full border p-2 rounded text-black" value={formEdicao.data_inicio_pagamento || ''} onChange={e => setFormEdicao({...formEdicao, data_inicio_pagamento: e.target.value})} />
                <div className="flex gap-2 mt-4"><button onClick={salvarEdicaoAluno} className="flex-1 bg-green-600 text-white py-2 rounded font-bold">Salvar</button><button onClick={() => setEditandoAluno(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded font-bold">Cancelar</button></div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600"><strong>Posição:</strong> {alunoDetalhe.posicao}</p>
                <p className="text-gray-600"><strong>Nasc:</strong> {alunoDetalhe.data_nascimento}</p>
                <p className="text-gray-600"><strong>Início Pag:</strong> {alunoDetalhe.data_inicio_pagamento}</p>
                <p className="text-gray-600"><strong>Endereço:</strong> {alunoDetalhe.endereco}</p>
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-500"><p><strong>Resp:</strong> {alunoDetalhe.profiles?.nome_completo}</p><p><strong>Tel:</strong> {alunoDetalhe.profiles?.telefone}</p></div>
                <button onClick={() => deletarAluno(alunoDetalhe.id)} className="w-full bg-red-100 text-red-700 py-2 rounded font-bold mt-2">🗑️ Excluir</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL INSCRITOS */}
      {eventoDetalhe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative max-h-[80vh] overflow-y-auto">
            <button onClick={() => setEventoDetalhe(null)} className="absolute top-4 right-4 text-gray-400 font-bold text-xl">X</button>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Inscritos: {eventoDetalhe.titulo}</h2>
            <div className="space-y-2">
              {inscricoes.filter(i => i.evento_id === eventoDetalhe.id).map(insc => (
                <div key={insc.id} className="flex justify-between items-center border-b pb-2">
                  <div><p className="font-bold text-gray-700">{insc.alunos?.nome}</p><p className="text-xs text-gray-500">Resp: {insc.profiles?.nome_completo}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => removerInscricaoDoEvento(insc.id)} className="text-red-600 text-xs border border-red-200 px-2 py-1 rounded">Remover</button>
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