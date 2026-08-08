import { checkPassword, signSession, sessionCookie, jsonResponse, withErrorHandling } from './_lib/auth.js'

export const POST = withErrorHandling(async (request: Request): Promise<Response> => {
  let body: { password?: unknown }
  try {
    body = (await request.json()) as { password?: unknown }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const password = typeof body.password === 'string' ? body.password : ''

  if (!password || !checkPassword(password)) {
    return jsonResponse({ error: 'Invalid password' }, 401)
  }

  const token = await signSession()

  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) })
})
