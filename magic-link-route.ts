import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

function generateToken(): string {
  return crypto.randomBytes(64).toString('hex')
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Look up user — silently succeed even if not found (don't reveal existence)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!profile) {
      // Return success anyway — don't leak whether the email is registered
      return NextResponse.json({ ok: true })
    }

    // Create a short-lived magic link token (15 minutes)
    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await supabase
      .from('magic_link_tokens')
      .insert({
        user_id: profile.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used: false,
      })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL
    const magicUrl = `${siteUrl}/api/auth/magic-link/verify?token=${token}`

    // Send email via Resend
    await resend.emails.send({
      from: 'Cuemark by Keyweaver <noreply@keyweaver.io>',
      to: normalizedEmail,
      subject: 'Your sign-in link for Cuemark',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8" /></head>
        <body style="font-family: Inter, -apple-system, sans-serif; background: #0A0A0F; color: #E8E8F0; padding: 40px 20px; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto;">
            <div style="margin-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px;">
                <div style="width: 28px; height: 28px; background: #5B6BF8; border-radius: 6px;"></div>
                <span style="font-weight: 700; font-size: 15px; color: #E8E8F0;">Cuemark <span style="color: #6B6B88; font-weight: 400;">by Keyweaver</span></span>
              </div>
              <h1 style="font-size: 22px; font-weight: 700; color: #E8E8F0; margin: 0 0 8px;">Your sign-in link</h1>
              <p style="color: #6B6B88; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Click the button below to sign in. This link expires in 15 minutes and can only be used once.
              </p>
              <a href="${magicUrl}"
                style="display: inline-block; background: #5B6BF8; color: #fff; text-decoration: none;
                       padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px;">
                Sign in to Cuemark
              </a>
            </div>
            <p style="color: #3A3A52; font-size: 12px; line-height: 1.6; border-top: 1px solid #2A2A3D; padding-top: 20px;">
              If you didn't request this link, you can safely ignore this email. Your account has not been affected.<br /><br />
              Keyweaver Ltd · <a href="${siteUrl}/legal/privacy" style="color: #3A3A52;">Privacy Policy</a>
            </p>
          </div>
        </body>
        </html>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Magic link error:', err)
    return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 })
  }
}
