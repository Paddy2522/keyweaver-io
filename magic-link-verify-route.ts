import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateToken(): string {
  return crypto.randomBytes(64).toString('hex')
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rawToken = searchParams.get('token')

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || ''

    if (!rawToken) {
      return NextResponse.redirect(new URL('/login?error=invalid_link', siteUrl))
      )
    }

    const tokenHash = hashToken(rawToken)

    // Look up the magic link token
    const { data: magicToken } = await supabase
      .from('magic_link_tokens')
      .select('user_id, expires_at, used')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!magicToken) {
      return NextResponse.redirect(new URL('/login?error=invalid_link', siteUrl))
    }

    if (magicToken.used) {
      return NextResponse.redirect(new URL('/login?error=link_used', siteUrl))
    }

    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.redirect(new URL('/login?error=link_expired', siteUrl))
    }

    // Mark token as used
    await supabase
      .from('magic_link_tokens')
      .update({ used: true })
      .eq('token_hash', tokenHash)

    // Create a full session
    const sessionToken = generateToken()
    const sessionHash = hashToken(sessionToken)

    await supabase
      .from('sessions')
      .insert({
        user_id: magicToken.user_id,
        token_hash: sessionHash,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })

    // Redirect to account page with token in URL fragment
    // The account page JS reads it from the fragment and stores in localStorage
    const redirectUrl = new URL('/account', siteUrl)
    redirectUrl.hash = `token=${sessionToken}`

    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error('Magic link verify error:', err)
    return NextResponse.redirect(new URL('/login?error=server_error', process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || ''))
  }
}
