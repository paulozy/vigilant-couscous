import { SESSION_COOKIE, parseCookie, verifySession } from './_lib/auth'

export async function GET(request: Request): Promise<Response> {
  const token = parseCookie(request.headers.get('cookie'), SESSION_COOKIE)
  const valid = await verifySession(token)

  return new Response(JSON.stringify({ ok: valid }), {
    status: valid ? 200 : 401,
    headers: { 'Content-Type': 'application/json' },
  })
}
