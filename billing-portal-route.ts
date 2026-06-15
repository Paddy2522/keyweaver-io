import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function getUserFromRequest(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const rawToken = auth.slice(7)
  const tokenHash = hashToken(rawToken)

  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null

  return session.user_id
}

export async function POST(req: Request) {
  try {
    const userId = await getUserFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }

    // Get user's email to find their Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    let customerId = profile.stripe_customer_id

    // If no Stripe customer ID stored yet, look it up by email
    if (!customerId) {
      const customers = await stripe.customers.list({
        email: profile.email,
        limit: 1,
      })

      if (customers.data.length > 0) {
        customerId = customers.data[0].id

        // Cache it for future use
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId)
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account found. Purchase credits first.' },
        { status: 404 }
      )
    }

    // Create a Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL}/account`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error('Billing portal error:', err)
    return NextResponse.json({ error: 'Could not open billing portal.' }, { status: 500 })
  }
}
