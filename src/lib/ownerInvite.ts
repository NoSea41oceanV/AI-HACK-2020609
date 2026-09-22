const OWNER_INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const OWNER_INVITE_HASH_PATTERN = /^[a-f0-9]{64}$/

export type AppRoute =
  | { kind: 'staff' }
  | { kind: 'owner'; token: string | null }
  | { kind: 'not-found' }

export function generateOwnerInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function isOwnerInviteToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && OWNER_INVITE_TOKEN_PATTERN.test(value)
}

export function isOwnerInviteHash(value: string | null | undefined): value is string {
  return typeof value === 'string' && OWNER_INVITE_HASH_PATTERN.test(value)
}

export async function hashOwnerInviteToken(token: string): Promise<string> {
  if (!isOwnerInviteToken(token)) throw new Error('招待トークンの形式が不正です。')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function parseAppRoute(location: Pick<Location, 'pathname' | 'hash'>): AppRoute {
  const pathname = location.pathname.replace(/\/+$/, '') || '/'
  if (pathname === '/') return { kind: 'staff' }
  if (pathname !== '/owner') return { kind: 'not-found' }

  const fragment = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
  const token = new URLSearchParams(fragment).get('invite')
  return { kind: 'owner', token: isOwnerInviteToken(token) ? token : null }
}

export function createOwnerInviteUrl(origin: string, token: string): string {
  if (!isOwnerInviteToken(token)) throw new Error('招待トークンの形式が不正です。')
  const url = new URL('/owner', origin)
  url.hash = new URLSearchParams({ invite: token }).toString()
  return url.toString()
}
