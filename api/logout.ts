import { expiredSessionCookie, jsonResponse, withErrorHandling } from './_lib/auth'

export const POST = withErrorHandling(async (): Promise<Response> => {
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': expiredSessionCookie() })
})
