import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: Request) {
  const body: unknown = await req.json()

  if (
    typeof body !== 'object' ||
    body === null ||
    !('email' in body) ||
    typeof (body as Record<string, unknown>).email !== 'string'
  ) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
  }

  const email = ((body as Record<string, string>).email).trim()

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
  }

  try {
    await resend.emails.send({
      from: 'noreply@keyweaver.io',
      to: 'paddywestvideo@gmail.com',
      subject: 'New Cuemark Waitlist Signup',
      text: `New waitlist signup: ${email}\nSigned up at: ${new Date().toISOString()}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Waitlist email error:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
