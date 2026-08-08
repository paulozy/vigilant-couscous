import { SESSION_COOKIE, parseCookie, verifySession, jsonResponse, withErrorHandling } from './_lib/auth'

export const GET = withErrorHandling(async (request: Request): Promise<Response> => {
  const token = parseCookie(request.headers.get('cookie'), SESSION_COOKIE)
  const valid = await verifySession(token)

  return jsonResponse({ ok: valid }, valid ? 200 : 401)
})
