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
  const [modo, setModo] = useState('login') // 'login', 'cadastro_aluno', 'cadastro_admin'
  const [loading, setLoading] = useState(false)

  // Estados dos Forms
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // Form Cadastro Aluno
  const [form, setForm] = useState({
    nomeAluno: '', nascimento: '', endereco: '', posicao: '',
    nomeResponsavel: '', emailResponsavel: '', telefoneResponsavel: '',
    senha: '', confirmaSenha: ''
  })
  const [arquivoFoto, setArquivoFoto] = useState(null)

  // Form Cadastro Admin
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
    
    // Cria usuário sem aluno
    const { error } = await supabase.auth.signUp({
      email: formAdmin.email,
      password: formAdmin.senha,
      options: { data: { full_name: formAdmin.nome } }
    })

    if (error) alert('Erro: ' + error.message)
    else {
      alert('Conta Admin/Staff criada! Aguarde aprovação ou entre no painel.')
      setModo('login')
    }
    setLoading(false)
  }

  const handleCadastroAluno = async (e) => {
    e.preventDefault()
    if (form.senha !== form.confirmaSenha) return alert('As senhas não conferem!')
    if (!arquivoFoto) return alert('Foto obrigatória.')

    setLoading(true)
    // 1. Criar Usuário
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.emailResponsavel,
      password: form.senha,
      options: { data: { full_name: form.nomeResponsavel, telefone: form.telefoneResponsavel } }
    })
    if (authError) { alert(authError.message); setLoading(false); return }

    // 2. Upload Foto
    const nomeArquivo = `foto-${Date.now()}-${arquivoFoto.name}`
    const { error: fotoError } = await supabase.storage.from('fotos-alunos').upload(nomeArquivo, arquivoFoto)
    let fotoUrl = null
    if (!fotoError) {
      const { data: publicUrlData } = supabase.storage.from('fotos-alunos').getPublicUrl(nomeArquivo)
      fotoUrl = publicUrlData.publicUrl
    }

    // 3. Salvar Aluno
    const { error: alunoError } = await supabase.from('alunos').insert({
      responsavel_id: authData.user.id,
      nome: form.nomeAluno,
      data_nascimento: form.nascimento,
      endereco: form.endereco,
      posicao: form.posicao,
      foto_url: fotoUrl
    })

    if (alunoError) alert('Erro aluno: ' + alunoError.message)
    else {
      alert('Cadastro realizado! Verifique seu email.')
      setModo('login')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        
        <div className="bg-green-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">⚽ Escolinha SDC Guarapari</h1>
          <p className="text-green-100 text-sm mt-1">Gestão Esportiva</p>
        </div>

        {/* Abas */}
        <div className="flex border-b overflow-x-auto">
          <button onClick={() => setModo('login')} className={`flex-1 p-3 text-xs font-bold ${modo === 'login' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500'}`}>ENTRAR</button>
          <button onClick={() => setModo('cadastro_aluno')} className={`flex-1 p-3 text-xs font-bold ${modo === 'cadastro_aluno' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500'}`}>NOVO ALUNO</button>
          <button onClick={() => setModo('cadastro_admin')} className={`flex-1 p-3 text-xs font-bold ${modo === 'cadastro_admin' ? 'text-black border-b-2 border-black bg-gray-50' : 'text-gray-500'}`}>SOU STAFF/ADM</button>
        </div>

        <div className="p-8">
          {/* LOGIN */}
          {modo === 'login' && (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700">Email</label>
              <input className="w-full border p-3 rounded text-black" onChange={e => setEmail(e.target.value)} />
              <label className="block text-sm font-bold text-gray-700">Senha</label>
              <input type="password" className="w-full border p-3 rounded text-black" onChange={e => setPassword(e.target.value)} />
              <button onClick={handleLogin} disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700">
                {loading ? 'Entrando...' : 'Acessar Painel'}
              </button>
            </div>
          )}

          {/* CADASTRO ADMIN */}
          {modo === 'cadastro_admin' && (
            <form onSubmit={handleCadastroAdmin} className="space-y-4">
              <div className="bg-gray-100 p-3 rounded text-xs text-gray-600 mb-4">
                Crie uma conta administrativa sem vincular alunos.
              </div>
              <input required placeholder="Nome Completo" className="w-full border p-2 rounded text-black" value={formAdmin.nome} onChange={e => setFormAdmin({...formAdmin, nome: e.target.value})} />
              <input required type="email" placeholder="Email" className="w-full border p-2 rounded text-black" value={formAdmin.email} onChange={e => setFormAdmin({...formAdmin, email: e.target.value})} />
              <div className="flex gap-2">
                <input required type="password" placeholder="Senha" className="w-1/2 border p-2 rounded text-black" value={formAdmin.senha} onChange={e => setFormAdmin({...formAdmin, senha: e.target.value})} />
                <input required type="password" placeholder="Confirmar" className="w-1/2 border p-2 rounded text-black" value={formAdmin.confirma} onChange={e => setFormAdmin({...formAdmin, confirma: e.target.value})} />
              </div>
              <button disabled={loading} className="w-full bg-black text-white font-bold py-3 rounded hover:bg-gray-800">
                {loading ? 'Criando...' : 'CRIAR CONTA ADMIN'}
              </button>
            </form>
          )}

          {/* CADASTRO ALUNO */}
          {modo === 'cadastro_aluno' && (
            <form onSubmit={handleCadastroAluno} className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <input required placeholder="Nome do Aluno" className="w-full border p-2 rounded text-black" value={form.nomeAluno} onChange={e => setForm({...form, nomeAluno: e.target.value})} />
                <div className="flex gap-2">
                  <input required type="date" className="w-1/2 border p-2 rounded text-black" value={form.nascimento} onChange={e => setForm({...form, nascimento: e.target.value})} />
                  <input required placeholder="Posição" className="w-1/2 border p-2 rounded text-black" value={form.posicao} onChange={e => setForm({...form, posicao: e.target.value})} />
                </div>
                <input required placeholder="Endereço" className="w-full border p-2 rounded text-black" value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
                <label className="text-xs font-bold text-gray-500">Foto 3x4</label>
                <input required type="file" className="w-full text-sm" onChange={e => setArquivoFoto(e.target.files[0])} />
                
                <hr className="my-2"/>
                <input required placeholder="Nome Responsável" className="w-full border p-2 rounded text-black" value={form.nomeResponsavel} onChange={e => setForm({...form, nomeResponsavel: e.target.value})} />
                <div className="flex gap-2">
                  <input required type="email" placeholder="Email Resp." className="w-2/3 border p-2 rounded text-black" value={form.emailResponsavel} onChange={e => setForm({...form, emailResponsavel: e.target.value})} />
                  <input required placeholder="Tel" className="w-1/3 border p-2 rounded text-black" value={form.telefoneResponsavel} onChange={e => setForm({...form, telefoneResponsavel: e.target.value})} />
                </div>
                <div className="flex gap-2">
                  <input required type="password" placeholder="Senha" className="w-1/2 border p-2 rounded text-black" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} />
                  <input required type="password" placeholder="Confirmar" className="w-1/2 border p-2 rounded text-black" value={form.confirmaSenha} onChange={e => setForm({...form, confirmaSenha: e.target.value})} />
                </div>
              </div>
              <button disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700">
                {loading ? 'Cadastrando...' : 'CADASTRAR ALUNO'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}