import { createHash, timingSafeEqual } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'uc_session'
const SESSION_TTL = '15d'
const SESSION_MAX_AGE_SECONDS = 15 * 24 * 60 * 60

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function signingKey(): Uint8Array {
  return new TextEncoder().encode(requiredEnv('AUTH_SECRET'))
}

/**
 * Compares the given password against APP_PASSWORD using a timing-safe,
 * fixed-length comparison (both sides hashed first so unequal input lengths
 * never leak via timingSafeEqual's length check).
 */
export function checkPassword(input: string): boolean {
  const expected = requiredEnv('APP_PASSWORD')
  const a = createHash('sha256').update(input).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export async function signSession(): Promise<string> {
  return new SignJWT({ sub: 'owner' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(signingKey())
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    await jwtVerify(token, signingKey())
    return true
  } catch {
    return false
  }
}

export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
}

export function expiredSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}
