import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

export async function GET(req: Request) {
  try {
    const userId = await getUserFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })
    }

    // Fetch profile, credits, and recent jobs in parallel
    const [profileRes, creditsRes, jobsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('email, tier, created_at')
        .eq('id', userId)
        .single(),

      supabase
        .from('generation_credits')
        .select('credits_total, credits_used')
        .eq('user_id', userId)
        .single(),

      supabase
        .from('captio_jobs')
        .select('file_name, file_duration_seconds, credits_consumed, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (profileRes.error || !profileRes.data) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    const profile = profileRes.data
    const credits = creditsRes.data
    const jobs = jobsRes.data ?? []

    const creditsTotal = credits?.credits_total ?? 0
    const creditsUsed = credits?.credits_used ?? 0
    const creditsRemaining = Math.max(0, creditsTotal - creditsUsed)

    return NextResponse.json({
      email: profile.email,
      tier: profile.tier,
      created_at: profile.created_at,
      credits_remaining: creditsRemaining,
      credits_total: creditsTotal,
      credits_used: creditsUsed,
      recent_jobs: jobs.map(j => ({
        file_name: j.file_name,
        duration_seconds: j.file_duration_seconds,
        credits_consumed: j.credits_consumed,
        status: j.status,
        created_at: j.created_at,
      })),
    })
  } catch (err) {
    console.error('Account route error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
