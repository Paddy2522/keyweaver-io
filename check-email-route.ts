import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    return NextResponse.json({ exists: !!data })
  } catch (err) {
    console.error('Check email error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
