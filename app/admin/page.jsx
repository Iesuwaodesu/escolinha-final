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

  const [alunos, setAlunos] = useState([])
  const [eventos, setEventos] = useState([])
  const [mensalidades, setMensalidades] = useState([])
  const [inscricoes, setInscricoes] = useState([])
  
  // Edição
  const [alunoDetalhe, setAlunoDetalhe] = useState(null)
  const [editandoAluno, setEditandoAluno] = useState(false)
  const [formEdicao, setFormEdicao] = useState({})
  const [novaFotoAluno, setNovaFotoAluno] = useState(null) // NOVO: Estado para a nova foto
  
  const [eventoDetalhe, setEventoDetalhe] = useState(null) 
  
  const [novoEvento, setNovoEvento] = useState({ titulo: '', data: '', local: '', descricao: '', valor: '' })
  const [arquivoEvento, setArquivoEvento] = useState(null)
  const [novoAdmin, setNovoAdmin] = useState({ nome: '', email: '', senha: '' })
  const [novaCobranca, setNovaCobranca] = useState({ aluno_id: '', mes: '', valor: '150' })
  const [configCarteirinha, setConfigCarteirinha] = useState({ titulo: 'CAMPEONATO OFICIAL SDC', equipe: 'SDC GUARAPARI', fundo: null, logo: null })

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

  // --- FUNÇÕES DE EDIÇÃO DE ALUNO (COM FOTO) ---
  function abrirDetalhes(aluno) {
    setAlunoDetalhe(aluno)
    setEditandoAluno(false)
    setNovaFotoAluno(null)
    setFormEdicao({
      nome: aluno.nome,
      posicao: aluno.posicao,
      data_nascimento: aluno.data_nascimento,
      endereco: aluno.endereco,
      data_inicio_pagamento: aluno.data_inicio_pagamento
    })
  }

  async function salvarEdicaoAluno() {
    let urlFinal = alunoDetalhe.foto_url

    // Se escolheu uma foto nova, faz upload
    if (novaFotoAluno) {
      const nomeArquivo = `foto-${Date.now()}-${novaFotoAluno.name}`
      const { error: uploadError } = await supabase.storage.from('fotos-alunos').upload(nomeArquivo, novaFotoAluno)
      
      if (uploadError) return alert('Erro ao subir foto: ' + uploadError.message)
      
      const { data } = supabase.storage.from('fotos-alunos').getPublicUrl(nomeArquivo)
      urlFinal = data.publicUrl
    }

    const { error } = await supabase
      .from('alunos')
      .update({ ...formEdicao, foto_url: urlFinal }) // Salva dados + url da foto
      .eq('id', alunoDetalhe.id)

    if (error) alert('Erro: ' + error.message)
    else {
      alert('Dados atualizados!')
      setEditandoAluno(false)
      setNovaFotoAluno(null)
      carregarTudo()
      // Atualiza o modal visualmente na hora
      setAlunoDetalhe({ ...alunoDetalhe, ...formEdicao, foto_url: urlFinal })
    }
  }

  async function deletarAluno(id) {
    if(!confirm('Apagar tudo?')) return;
    await supabase.from('inscricoes').delete().eq('aluno_id', id)
    await supabase.from('mensalidades').delete().eq('aluno_id', id)
    await supabase.from('alunos').delete().eq('id', id)
    setAlunoDetalhe(null); carregarTudo()
  }

  // --- OUTRAS FUNÇÕES ---
  function handleFundoCarteirinha(e) { if (e.target.files[0]) setConfigCarteirinha({ ...configCarteirinha, fundo: URL.createObjectURL(e.target.files[0]) }) }
  function handleLogoCarteirinha(e) { if (e.target.files[0]) setConfigCarteirinha({ ...configCarteirinha, logo: URL.createObjectURL(e.target.files[0]) }) }
  function imprimirCarteirinhas() { window.print() }
  function enviarCobranca(fatura) { const tel = fatura.alunos?.profiles?.telefone?.replace(/\D/g, ''); if (!tel) return alert('Sem tel'); window.open(`https://wa.me/55${tel}?text=Olá...`, '_blank') }
  function copiarConviteEvento(ev) { navigator.clipboard.writeText(`Evento: ${ev.titulo}...`); alert('Copiado!') }

  async function criarEvento(e) {
    e.preventDefault(); let u = null
    if (arquivoEvento) { const n = `ev-${Date.now()}`; await supabase.storage.from('arquivos-eventos').upload(n, arquivoEvento); u = supabase.storage.from('arquivos-eventos').getPublicUrl(n).data.publicUrl }
    await supabase.from('eventos').insert({ ...novoEvento, valor: Number(novoEvento.valor), arquivo_url: u }); alert('Criado!'); carregarTudo()
  }
  async function deletarEvento(id) { if(confirm('Del?')) { await supabase.from('inscricoes').delete().eq('evento_id', id); await supabase.from('eventos').delete().eq('id', id); carregarTudo() } }
  async function removerInscricaoDoEvento(id) { if(confirm('Remover?')) { await supabase.from('inscricoes').delete().eq('id', id); carregarTudo() } }
  async function criarAdmin(e) { e.preventDefault(); const {data} = await supabase.auth.signUp({email:novoAdmin.email, password:novoAdmin.senha, options:{data:{full_name:novoAdmin.nome}}}); setTimeout(async()=>{await supabase.from('profiles').update({is_admin:true}).eq('id',data.user.id);alert('OK')},1500) }
  async function criarMensalidadeManual(e) { e.preventDefault(); await supabase.from('mensalidades').insert({aluno_id:novaCobranca.aluno_id, mes_referencia:novaCobranca.mes+'-01', valor:novaCobranca.valor, vencimento:novaCobranca.mes+'-10', status:'pendente'}); carregarTudo(); alert('Gerada!') }
  async function alternarMensalidade(id, s) { await supabase.from('mensalidades').update({status: s==='pago'?'pendente':'pago'}).eq('id',id); carregarTudo() }

  const alunosFiltrados = alunos.filter(a => a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.profiles?.nome_completo?.toLowerCase().includes(busca.toLowerCase()))
  if (loading) return <div className="p-10 text-center">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded shadow-sm print:hidden">
          <div><h1 className="text-2xl font-bold text-gray-800">Painel Admin</h1><p className="text-xs text-gray-400">{userProfile?.email}</p></div>
          <div className="flex gap-3"><input placeholder="🔍 Buscar..." className="p-2 border rounded w-64 text-black text-sm" value={busca} onChange={e => setBusca(e.target.value)} /><button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-bold">SAIR</button></div>
        </div>
        <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto print:hidden">
          {['alunos', 'eventos', 'financeiro', 'equipe', 'carteirinhas'].map(n => <button key={n} onClick={() => setAba(n)} className={`px-6 py-2 rounded-t-lg font-bold capitalize ${aba === n ? 'bg-white text-green-700' : 'bg-gray-200 text-gray-500'}`}>{n}</button>)}
        </div>

        {/* CONTEÚDO ABAS RESUMIDO (OMITIDO O REPETIDO PARA FOCAR NA MUDANÇA) */}
        {aba === 'alunos' && (
          <div className="bg-white p-6 rounded shadow-sm print:hidden">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Gerenciar Alunos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {alunosFiltrados.map(a => (
                <div key={a.id} onClick={() => abrirDetalhes(a)} className="border p-4 rounded hover:bg-gray-50 cursor-pointer flex gap-3 items-center relative">
                   {a.foto_url ? <img src={a.foto_url} className="w-12 h-12 rounded-full object-cover border"/> : <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">👤</div>}
                   <div><p className="font-bold text-gray-800">{a.nome}</p><p className="text-xs text-gray-500 font-bold">{a.posicao}</p><p className="text-xs text-gray-400">{a.profiles?.nome_completo}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* ABA CARTEIRINHAS (MANTIDA IGUAL) */}
        {aba === 'carteirinhas' && (
          <div>
            <div className="bg-white p-6 rounded shadow mb-8 print:hidden">
              <div className="grid md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500">Título</label><input className="w-full border p-2 rounded text-black" value={configCarteirinha.titulo} onChange={e => setConfigCarteirinha({...configCarteirinha, titulo: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-500">Equipe</label><input className="w-full border p-2 rounded text-black" value={configCarteirinha.equipe} onChange={e => setConfigCarteirinha({...configCarteirinha, equipe: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-500">Fundo</label><input type="file" className="w-full text-xs" onChange={handleFundoCarteirinha} /></div>
                <div><label className="text-xs font-bold text-gray-500">Logo</label><input type="file" className="w-full text-xs" onChange={handleLogoCarteirinha} /></div>
              </div>
              <button onClick={imprimirCarteirinhas} className="mt-4 bg-blue-600 text-white font-bold py-2 px-6 rounded w-full">🖨️ IMPRIMIR</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:w-full place-items-center md:place-items-start">
              {alunosFiltrados.map(a => (
                <div key={a.id} className="relative border border-black overflow-hidden bg-white print:break-inside-avoid shadow-md print:shadow-none" style={{ width: '85mm', height: '54mm', pageBreakInside: 'avoid' }}>
                  {configCarteirinha.fundo ? <img src={configCarteirinha.fundo} className="absolute inset-0 w-full h-full object-cover z-0 opacity-90" /> : <div className="absolute inset-0 bg-gradient-to-r from-green-700 to-green-900 z-0" />}
                  <div className="relative z-10 p-2 h-full flex flex-col justify-between text-white">
                    <div className="text-center border-b border-white/30 pb-1"><h3 className="font-bold text-[10px] tracking-widest uppercase truncate">{configCarteirinha.titulo}</h3></div>
                    <div className="flex items-center justify-between gap-2 h-[30mm]">
                      <div className="w-[22mm] h-[28mm] bg-white border-2 border-white overflow-hidden shadow-sm flex-shrink-0 relative">{a.foto_url ? <img src={a.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-[8px] font-bold">FOTO</div>}</div>
                      <div className="flex-1 min-w-0"><p className="text-[7px] uppercase text-green-200">Atleta</p><p className="font-bold text-xs leading-tight mb-1 truncate">{a.nome}</p><div className="flex gap-2"><div><p className="text-[7px] uppercase text-green-200">Nasc.</p><p className="font-bold text-[10px]">{a.data_nascimento ? a.data_nascimento.split('-')[0] : '--'}</p></div><div><p className="text-[7px] uppercase text-green-200">Posição</p><p className="font-bold text-[10px] truncate">{a.posicao}</p></div></div></div>
                      <div className="w-[22mm] h-[22mm] bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden rounded-sm flex-shrink-0">{configCarteirinha.logo ? <img src={configCarteirinha.logo} className="w-full h-full object-contain p-1" /> : <span className="text-[7px] text-green-200 uppercase text-center font-bold">LOGO</span>}</div>
                    </div>
                    <div className="bg-black/40 -mx-2 -mb-2 p-1 text-center"><p className="text-[8px] font-bold tracking-widest text-yellow-400 uppercase truncate">{configCarteirinha.equipe}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESTANTE DAS ABAS FINANCEIRO, EVENTOS, EQUIPE (IGUAL ANTERIOR) */}
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
              {eventos.map(ev => (<div key={ev.id} className="border-b py-3 flex justify-between items-center"><p className="font-bold text-gray-800">{ev.titulo}</p><button onClick={() => deletarEvento(ev.id)} className="text-red-500 text-sm">Excluir</button></div>))}
            </div>
          </div>
        )}
        {aba === 'financeiro' && <div className="bg-white p-6 rounded shadow print:hidden"><form onSubmit={criarMensalidadeManual} className="flex gap-2 mb-4"><select className="border p-1 text-black" onChange={e=>setNovaCobranca({...novaCobranca, aluno_id:e.target.value})}>{alunos.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select><input type="month" className="border p-1 text-black" onChange={e=>setNovaCobranca({...novaCobranca, mes:e.target.value})} /><button className="bg-black text-white px-2 rounded">Gerar</button></form>{mensalidades.map(m=><div key={m.id} className="border-b py-1 flex justify-between"><span className="text-gray-700">{m.alunos?.nome}</span><button onClick={()=>alternarMensalidade(m.id, m.status)} className={`px-2 rounded text-xs font-bold ${m.status==='pago'?'bg-green-100 text-green-700':'bg-red-100'}`}>{m.status}</button></div>)}</div>}
        {aba === 'equipe' && <div className="bg-white p-6 rounded shadow max-w-md mx-auto print:hidden"><form onSubmit={criarAdmin} className="space-y-4"><input placeholder="Nome" className="w-full border p-3 rounded text-black" value={novoAdmin.nome} onChange={e => setNovoAdmin({...novoAdmin, nome: e.target.value})} /><input placeholder="E-mail" className="w-full border p-3 rounded text-black" value={novoAdmin.email} onChange={e => setNovoAdmin({...novoAdmin, email: e.target.value})} /><input type="password" placeholder="Senha" className="w-full border p-3 rounded text-black" value={novoAdmin.senha} onChange={e => setNovoAdmin({...novoAdmin, senha: e.target.value})} /><button className="w-full bg-blue-600 text-white p-3 rounded font-bold">Criar</button></form></div>}
      </div>

      {/* MODAL DETALHES ALUNO COM EDIÇÃO E TROCA DE FOTO */}
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
                <label className="text-xs font-bold text-gray-500">Trocar Foto:</label>
                <input type="file" className="w-full text-xs" onChange={e => setNovaFotoAluno(e.target.files[0])} />
                <label className="text-xs font-bold text-gray-500">Início Pagamento:</label><input type="date" className="w-full border p-2 rounded text-black" value={formEdicao.data_inicio_pagamento || ''} onChange={e => setFormEdicao({...formEdicao, data_inicio_pagamento: e.target.value})} />
                <div className="flex gap-2 mt-4"><button onClick={salvarEdicaoAluno} className="flex-1 bg-green-600 text-white py-2 rounded font-bold">Salvar</button><button onClick={() => setEditandoAluno(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded font-bold">Cancelar</button></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                   {alunoDetalhe.foto_url && <img src={alunoDetalhe.foto_url} className="w-20 h-20 rounded-full object-cover border"/>}
                   <div><p className="text-gray-600"><strong>Posição:</strong> {alunoDetalhe.posicao}</p><p className="text-gray-600"><strong>Nasc:</strong> {alunoDetalhe.data_nascimento}</p></div>
                </div>
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-500"><p><strong>Resp:</strong> {alunoDetalhe.profiles?.nome_completo}</p><p><strong>Tel:</strong> {alunoDetalhe.profiles?.telefone}</p></div>
                <button onClick={() => deletarAluno(alunoDetalhe.id)} className="w-full bg-red-100 text-red-700 py-2 rounded font-bold mt-2">🗑️ Excluir</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}