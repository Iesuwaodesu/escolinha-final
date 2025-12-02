'use client'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState('login')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const [form, setForm] = useState({
    nomeAluno: '', nascimento: '', endereco: '', posicao: '',
    nomeResponsavel: '', emailResponsavel: '', telefoneResponsavel: '',
    senha: '', confirmaSenha: ''
  })
  const [arquivoFoto, setArquivoFoto] = useState(null)
  const [formAdmin, setFormAdmin] = useState({ nome: '', email: '', senha: '', confirma: '' })

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('Erro: ' + error.message)
    else router.push('/dashboard') 
    setLoading(false)
  }

  const handleCadastroAdmin = async (e) => {
    e.preventDefault()
    if (formAdmin.senha !== formAdmin.confirma) return alert('Senhas não conferem.')
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email: formAdmin.email, password: formAdmin.senha, options: { data: { full_name: formAdmin.nome } } })
    if (error) alert(error.message); else { alert('Conta criada!'); setModo('login') }
    setLoading(false)
  }

  const handleCadastroAluno = async (e) => {
    e.preventDefault()
    if (form.senha !== form.confirmaSenha) return alert('Senhas não conferem!')
    if (!arquivoFoto) return alert('Foto obrigatória.')
    setLoading(true)
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: form.emailResponsavel, password: form.senha, options: { data: { full_name: form.nomeResponsavel, telefone: form.telefoneResponsavel } } })
    if (authError) { alert(authError.message); setLoading(false); return }
    const nomeArquivo = `foto-${Date.now()}-${arquivoFoto.name}`
    const { error: fotoError } = await supabase.storage.from('fotos-alunos').upload(nomeArquivo, arquivoFoto)
    let fotoUrl = null
    if (!fotoError) { const { data } = supabase.storage.from('fotos-alunos').getPublicUrl(nomeArquivo); fotoUrl = data.publicUrl }
    const { error: alunoError } = await supabase.from('alunos').insert({ responsavel_id: authData.user.id, nome: form.nomeAluno, data_nascimento: form.nascimento, endereco: form.endereco, posicao: form.posicao, foto_url: fotoUrl })
    if (alunoError) alert(alunoError.message); else { alert('Cadastro realizado!'); setModo('login') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
        
        {/* CABEÇALHO */}
        <div className="bg-white p-6 text-center border-b border-gray-100 flex flex-col items-center">
          <img src="/logo.png" alt="Logo SDC" className="h-24 w-auto mb-2 object-contain" onError={(e) => e.target.style.display='none'} />
          <h1 className="text-xl font-bold text-green-800">Escolinha SDC Guarapari</h1>
          <p className="text-green-600 text-xs tracking-widest uppercase mt-1">Gestão Esportiva</p>
        </div>

        {/* ABAS */}
        <div className="flex border-b bg-gray-50">
          <button onClick={() => setModo('login')} className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider ${modo === 'login' ? 'bg-white text-green-700 border-t-2 border-green-600' : 'text-gray-400 hover:text-gray-600'}`}>Entrar</button>
          <button onClick={() => setModo('cadastro_aluno')} className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider ${modo === 'cadastro_aluno' ? 'bg-white text-green-700 border-t-2 border-green-600' : 'text-gray-400 hover:text-gray-600'}`}>Novo Aluno</button>
          <button onClick={() => setModo('cadastro_admin')} className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider ${modo === 'cadastro_admin' ? 'bg-white text-black border-t-2 border-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>Staff</button>
        </div>

        <div className="p-8">
          {modo === 'login' && (
            <div className="space-y-4">
              <input className="w-full border border-gray-300 p-3 rounded-lg text-black outline-none focus:border-green-500" placeholder="Email do Responsável" onChange={e => setEmail(e.target.value)} />
              <input type="password" className="w-full border border-gray-300 p-3 rounded-lg text-black outline-none focus:border-green-500" placeholder="Senha" onChange={e => setPassword(e.target.value)} />
              <button onClick={handleLogin} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-md transition">{loading ? 'Aguarde...' : 'ACESSAR PAINEL'}</button>
            </div>
          )}
{/* 
          {modo === 'cadastro_admin' && (
            <form onSubmit={handleCadastroAdmin} className="space-y-4">
              <input required placeholder="Nome Completo" className="w-full border p-2 rounded text-black" value={formAdmin.nome} onChange={e => setFormAdmin({...formAdmin, nome: e.target.value})} />
              <input required type="email" placeholder="Email" className="w-full border p-2 rounded text-black" value={formAdmin.email} onChange={e => setFormAdmin({...formAdmin, email: e.target.value})} />
              <div className="flex gap-2"><input required type="password" placeholder="Senha" className="w-1/2 border p-2 rounded text-black" value={formAdmin.senha} onChange={e => setFormAdmin({...formAdmin, senha: e.target.value})} /><input required type="password" placeholder="Confirmar" className="w-1/2 border p-2 rounded text-black" value={formAdmin.confirma} onChange={e => setFormAdmin({...formAdmin, confirma: e.target.value})} /></div>
              <button disabled={loading} className="w-full bg-black text-white font-bold py-3 rounded hover:bg-gray-800">{loading ? '...' : 'CRIAR ADMIN'}</button>
            </form>
          )} */}

          {modo === 'cadastro_aluno' && (
            <form onSubmit={handleCadastroAluno} className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <input required placeholder="Nome do Aluno" className="w-full border p-2 rounded text-black" value={form.nomeAluno} onChange={e => setForm({...form, nomeAluno: e.target.value})} />
                <div className="flex gap-2"><input required type="date" className="w-1/2 border p-2 rounded text-black" value={form.nascimento} onChange={e => setForm({...form, nascimento: e.target.value})} /><input required placeholder="Posição" className="w-1/2 border p-2 rounded text-black" value={form.posicao} onChange={e => setForm({...form, posicao: e.target.value})} /></div>
                <input required placeholder="Endereço" className="w-full border p-2 rounded text-black" value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
                <label className="text-xs font-bold text-gray-500">Foto 3x4</label><input required type="file" className="w-full text-sm" onChange={e => setArquivoFoto(e.target.files[0])} />
                <hr className="my-2 border-dashed"/>
                <input required placeholder="Nome Responsável" className="w-full border p-2 rounded text-black" value={form.nomeResponsavel} onChange={e => setForm({...form, nomeResponsavel: e.target.value})} />
                <div className="flex gap-2"><input required type="email" placeholder="Email" className="w-2/3 border p-2 rounded text-black" value={form.emailResponsavel} onChange={e => setForm({...form, emailResponsavel: e.target.value})} /><input required placeholder="Tel" className="w-1/3 border p-2 rounded text-black" value={form.telefoneResponsavel} onChange={e => setForm({...form, telefoneResponsavel: e.target.value})} /></div>
                <div className="flex gap-2"><input required type="password" placeholder="Senha" className="w-1/2 border p-2 rounded text-black" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} /><input required type="password" placeholder="Confirmar" className="w-1/2 border p-2 rounded text-black" value={form.confirmaSenha} onChange={e => setForm({...form, confirmaSenha: e.target.value})} /></div>
              </div>
              <button disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700">{loading ? '...' : 'FINALIZAR CADASTRO'}</button>
            </form>
          )}
        </div>
      </div>

      {/* RODAPÉ EDITÁVEL */}
      <div className="text-center space-y-2">
        <p className="text-green-800 font-bold text-sm">📞 CONTATO ESCOLINHA</p>
        
        {/* --- EDITE SEU TELEFONE AQUI --- */}
        <p className="text-gray-600 text-sm">
           (27) 98116-2741 | escolinhadefutebolsdcgua@gmail.com.br
        </p>

        <div className="bg-white px-4 py-2 rounded-full shadow-sm inline-block mt-2">
          <span className="text-xs font-bold text-gray-500 mr-2">CHAVE PIX CNPJ:</span>
          
          {/* --- EDITE SEU PIX AQUI --- */}
          <span className="font-mono text-black font-bold select-all">
             14.910.051/0001-65
          </span>
        </div>
      </div>
    </div>
  )
}