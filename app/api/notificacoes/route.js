import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// import { Resend } from 'resend' // Instalar: npm install resend

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
// const resend = new Resend('SUA_CHAVE_API_RESEND')

export async function GET() {
  // 1. Buscar mensalidades vencidas e pendentes
  const hoje = new Date().toISOString().split('T')[0]
  const { data: devedores } = await supabase
    .from('mensalidades')
    .select('*, alunos(nome, profiles(email, nome_completo))')
    .eq('status', 'pendente')
    .lt('vencimento', hoje) // Vencimento menor que hoje (Atrasado)

  // 2. Loop para enviar emails (Exemplo)
  if (devedores) {
    for (const fatura of devedores) {
      const email = fatura.alunos.profiles.email
      console.log(`Enviando aviso para ${email} sobre ${fatura.alunos.nome}`)
      
      // await resend.emails.send({
      //   from: 'Escolinha <onboarding@resend.dev>',
      //   to: email,
      //   subject: 'Aviso de Mensalidade',
      //   html: `<p>Olá, a mensalidade de ${fatura.alunos.nome} venceu em ${fatura.vencimento}.</p>`
      // })
    }
  }

  return NextResponse.json({ success: true, avisados: devedores?.length })
}