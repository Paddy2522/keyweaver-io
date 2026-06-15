import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

// Single price ID per product — Stripe handles multi-currency internally
const PRICE_IDS: Record<string, string> = {
  credits: process.env.STRIPE_PRICE_CREDITS!,
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
}

function generateToken(): string {
  return crypto.randomBytes(64).toString('hex') // 128 hex chars
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, plan = 'free' } = body

    // Validate
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check email not already in use
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'An account with that email already exists.' },
        { status: 409 }
      )
    }

    // Hash password
    const salt = crypto.randomBytes(32).toString('hex')
    const passwordHash = hashPassword(password, salt)

    // Create profile
    const userId = crypto.randomUUID()
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: normalizedEmail,
        password_hash: passwordHash,
        password_salt: salt,
        tier: 'free',
        created_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error('Profile insert error:', profileError)
      return NextResponse.json({ error: 'Could not create account.' }, { status: 500 })
    }

    // Initialise credits row (3 free generates = 3 credits)
    await supabase
      .from('generation_credits')
      .insert({
        user_id: userId,
        credits_total: 3,
        credits_used: 0,
      })

    // Create session token
    const token = generateToken()
    const tokenHash = hashToken(token)

    await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      })

    // Free plan — return token immediately
    if (plan === 'free') {
      return NextResponse.json({ token, plan: 'free' })
    }

    // Paid plans — create Stripe checkout session
    const priceId = PRICE_IDS[plan]

    if (!priceId) {
      console.warn(`No price ID configured for plan=${plan}`)
      return NextResponse.json({ token, plan })
    }

    const isSubscription = plan === 'monthly'

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      customer_email: normalizedEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: userId,
        plan,
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL}/account?welcome=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL}/pricing`,
    })

    return NextResponse.json({
      token,
      plan,
      checkout_url: session.url,
    })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
