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
  const [modo, setModo] = useState('login') // 'login' ou 'cadastro'
  const [loading, setLoading] = useState(false)

  // Login States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Cadastro States
  const [form, setForm] = useState({
    nomeAluno: '',
    nascimento: '',
    endereco: '',
    posicao: '',
    nomeResponsavel: '',
    emailResponsavel: '',
    telefoneResponsavel: '',
    senha: '',
    confirmaSenha: ''
  })
  const [arquivoFoto, setArquivoFoto] = useState(null)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('Erro: ' + error.message)
    else router.push('/dashboard') 
    setLoading(false)
  }

  const handleCadastro = async (e) => {
    e.preventDefault()
    if (form.senha !== form.confirmaSenha) return alert('As senhas não conferem!')
    if (!arquivoFoto) return alert('Por favor, envie a foto 3x4.')

    setLoading(true)

    // 1. Criar Usuário (Responsável)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.emailResponsavel,
      password: form.senha,
      options: {
        data: { 
          full_name: form.nomeResponsavel,
          telefone: form.telefoneResponsavel 
        }
      }
    })

    if (authError) {
      alert('Erro no cadastro: ' + authError.message)
      setLoading(false)
      return
    }

    // 2. Upload da Foto
    const nomeArquivo = `foto-${Date.now()}-${arquivoFoto.name}`
    const { data: fotoData, error: fotoError } = await supabase.storage
      .from('fotos-alunos')
      .upload(nomeArquivo, arquivoFoto)

    let fotoUrl = null
    if (!fotoError) {
      const { data: publicUrlData } = supabase.storage.from('fotos-alunos').getPublicUrl(nomeArquivo)
      fotoUrl = publicUrlData.publicUrl
    }

    // 3. Salvar Aluno no Banco
    // O usuário foi criado, agora usamos o ID dele para vincular o aluno
    const { error: alunoError } = await supabase.from('alunos').insert({
      responsavel_id: authData.user.id,
      nome: form.nomeAluno,
      data_nascimento: form.nascimento,
      endereco: form.endereco,
      posicao: form.posicao,
      foto_url: fotoUrl
    })

    if (alunoError) {
      alert('Conta criada, mas erro ao salvar aluno: ' + alunoError.message)
    } else {
      alert('Cadastro realizado com sucesso! Verifique seu e-mail para confirmar.')
      setModo('login')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="bg-green-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">⚽ Escolinha SDC Guarapari</h1>
          <p className="text-green-100 text-sm mt-1">Transformando futuros craques</p>
        </div>

        {/* Botões de Alternância */}
        <div className="flex border-b">
          <button 
            onClick={() => setModo('login')}
            className={`w-1/2 p-4 font-bold text-sm ${modo === 'login' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            ENTRAR COMO RESPONSÁVEL
          </button>
          <button 
            onClick={() => setModo('cadastro')}
            className={`w-1/2 p-4 font-bold text-sm ${modo === 'cadastro' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            CADASTRAR NOVO ALUNO
          </button>
        </div>

        <div className="p-8">
          {modo === 'login' ? (
            // --- LOGIN FORM ---
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email do Responsável</label>
                <input 
                  className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-black"
                  placeholder="exemplo@email.com"
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
                <input 
                  type="password"
                  className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-black"
                  placeholder="********"
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <button 
                onClick={handleLogin} 
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition shadow-md"
              >
                {loading ? 'Entrando...' : 'Acessar Painel'}
              </button>
            </div>
          ) : (
            // --- CADASTRO COMPLETO FORM ---
            <form onSubmit={handleCadastro} className="space-y-4">
              
              <div className="bg-gray-50 p-3 rounded-lg border">
                <h3 className="text-green-700 font-bold mb-3 border-b pb-1">👤 Dados do Aluno</h3>
                <div className="grid grid-cols-1 gap-3">
                  <input required placeholder="Nome do Aluno" className="w-full border p-2 rounded text-black" value={form.nomeAluno} onChange={e => setForm({...form, nomeAluno: e.target.value})} />
                  <div className="flex gap-2">
                    <div className="w-1/2">
                      <label className="text-xs text-gray-500">Nascimento</label>
                      <input required type="date" className="w-full border p-2 rounded text-black" value={form.nascimento} onChange={e => setForm({...form, nascimento: e.target.value})} />
                    </div>
                    <div className="w-1/2">
                      <label className="text-xs text-gray-500">Posição</label>
                      <input required placeholder="Ex: Atacante" className="w-full border p-2 rounded text-black" value={form.posicao} onChange={e => setForm({...form, posicao: e.target.value})} />
                    </div>
                  </div>
                  <input required placeholder="Endereço Completo" className="w-full border p-2 rounded text-black" value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Foto 3x4 (JPG, PNG ou PDF)</label>
                    <input 
                      required 
                      type="file" 
                      accept="image/png, image/jpeg, application/pdf"
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                      onChange={e => setArquivoFoto(e.target.files[0])}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border">
                <h3 className="text-green-700 font-bold mb-3 border-b pb-1">🛡️ Dados do Responsável (Login)</h3>
                <div className="space-y-3">
                  <input required placeholder="Nome do Responsável" className="w-full border p-2 rounded text-black" value={form.nomeResponsavel} onChange={e => setForm({...form, nomeResponsavel: e.target.value})} />
                  <div className="flex gap-2">
                    <input required type="email" placeholder="Email" className="w-2/3 border p-2 rounded text-black" value={form.emailResponsavel} onChange={e => setForm({...form, emailResponsavel: e.target.value})} />
                    <input required placeholder="Telefone" className="w-1/3 border p-2 rounded text-black" value={form.telefoneResponsavel} onChange={e => setForm({...form, telefoneResponsavel: e.target.value})} />
                  </div>
                  <div className="flex gap-2">
                    <input required type="password" placeholder="Senha" className="w-1/2 border p-2 rounded text-black" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} />
                    <input required type="password" placeholder="Confirmar Senha" className="w-1/2 border p-2 rounded text-black" value={form.confirmaSenha} onChange={e => setForm({...form, confirmaSenha: e.target.value})} />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-black hover:bg-gray-800 text-white font-bold py-3 rounded-lg transition shadow-md"
              >
                {loading ? 'Cadastrando...' : 'CADASTRAR'}
              </button>
            </form>
          )}
        </div>
        
        <div className="bg-gray-50 p-4 text-center text-xs text-gray-400">
          © 2024 SDC Guarapari - Sistema de Gestão
        </div>
      </div>
    </div>
  )
}