import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

// Credits to add per product type
const CREDITS_FOR_PLAN: Record<string, number> = {
  credits:  60,
  monthly:  300,
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'No signature.' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // One-time credit pack purchase OR first month of subscription
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan

        if (!userId || !plan) {
          console.warn('checkout.session.completed missing metadata', session.id)
          break
        }

        if (plan === 'credits') {
          // Add 60 credits to pool
          await addCredits(userId, CREDITS_FOR_PLAN.credits)
        }

        if (plan === 'monthly') {
          // Set tier + add 300 credits
          await setTier(userId, 'captio_monthly')
          await addCredits(userId, CREDITS_FOR_PLAN.monthly)

          // Store Stripe customer ID for billing portal lookups
          if (session.customer) {
            await supabase
              .from('profiles')
              .update({ stripe_customer_id: session.customer as string })
              .eq('id', userId)
          }
        }

        break
      }

      // Monthly renewal — add 300 credits, respecting rollover cap
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        if (!invoice.subscription) break // Not a subscription invoice

        // Find user by Stripe customer ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, tier')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (!profile) {
          console.warn('invoice.paid: no user found for customer', customerId)
          break
        }

        // Only process for captio_monthly users — skip the first payment
        // (handled by checkout.session.completed)
        if (profile.tier === 'captio_monthly' && invoice.billing_reason === 'subscription_cycle') {
          await renewMonthlyCredits(profile.id)
        }

        break
      }

      // Subscription cancelled or expired
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (profile) {
          await setTier(profile.id, 'free')
          // Credits already earned are kept — don't deduct them
        }

        break
      }

      // Subscription payment failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Log it — don't immediately downgrade, Stripe will retry
        console.warn('Payment failed for customer:', customerId)
        break
      }

      default:
        // Ignore unhandled events
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setTier(userId: string, tier: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ tier })
    .eq('id', userId)

  if (error) console.error('setTier error:', error)
}

async function addCredits(userId: string, amount: number) {
  // Increment credits_total (available pool)
  const { data: row } = await supabase
    .from('generation_credits')
    .select('credits_total')
    .eq('user_id', userId)
    .single()

  if (!row) {
    // Create row if doesn't exist yet
    await supabase
      .from('generation_credits')
      .insert({ user_id: userId, credits_total: amount, credits_used: 0 })
    return
  }

  await supabase
    .from('generation_credits')
    .update({ credits_total: row.credits_total + amount })
    .eq('user_id', userId)
}

async function renewMonthlyCredits(userId: string) {
  const { data: row } = await supabase
    .from('generation_credits')
    .select('credits_total, credits_used')
    .eq('user_id', userId)
    .single()

  if (!row) {
    await supabase
      .from('generation_credits')
      .insert({ user_id: userId, credits_total: 300, credits_used: 0 })
    return
  }

  const remaining = Math.max(0, row.credits_total - row.credits_used)
  const rollover = Math.min(remaining, 150) // max 150 credits roll over

  // Reset: rollover + fresh 300
  const newTotal = rollover + 300

  await supabase
    .from('generation_credits')
    .update({ credits_total: newTotal, credits_used: 0 })
    .eq('user_id', userId)
}
