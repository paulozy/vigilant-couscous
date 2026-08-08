import { expiredSessionCookie } from './_lib/auth.ts'

export async function POST(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': expiredSessionCookie(),
    },
  })
}
