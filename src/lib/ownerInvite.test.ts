import { describe, expect, it, vi } from 'vitest'
import { createOwnerInviteUrl, generateOwnerInviteToken, hashOwnerInviteToken, isOwnerInviteHash, isOwnerInviteToken, parseAppRoute } from './ownerInvite'

describe('owner invite routing', () => {
  it('accepts only the dedicated owner path with a strong token', () => {
    const token = 'a'.repeat(43)
    expect(parseAppRoute({ pathname: '/owner', hash: `#invite=${token}` } as Location)).toEqual({ kind: 'owner', token })
    expect(parseAppRoute({ pathname: '/owner', hash: '' } as Location)).toEqual({ kind: 'owner', token: null })
    expect(parseAppRoute({ pathname: '/demo', hash: '' } as Location)).toEqual({ kind: 'demo' })
    expect(parseAppRoute({ pathname: '/owner', hash: '#invite=PAW-2026' } as Location)).toEqual({ kind: 'owner', token: null })
    expect(parseAppRoute({ pathname: '/staff', hash: `#invite=${token}` } as Location)).toEqual({ kind: 'not-found' })
    expect(parseAppRoute({ pathname: '/', hash: `#invite=${token}` } as Location)).toEqual({ kind: 'staff' })
  })

  it('generates 256-bit base64url tokens and exact owner URLs', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(255) })
    const token = generateOwnerInviteToken()
    expect(token).toBe('_'.repeat(42) + '8')
    expect(isOwnerInviteToken(token)).toBe(true)
    expect(createOwnerInviteUrl('https://example.test/path', token)).toBe(`https://example.test/owner#invite=${token}`)
    vi.unstubAllGlobals()
  })

  it('rejects tokens that could alter a path or query', () => {
    expect(isOwnerInviteToken('../staff')).toBe(false)
    expect(isOwnerInviteToken('a'.repeat(42))).toBe(false)
    expect(isOwnerInviteToken('a'.repeat(44))).toBe(false)
    expect(() => createOwnerInviteUrl('https://example.test', '../staff')).toThrow('形式が不正')
  })

  it('hashes the token before it is used as a Firestore identifier', async () => {
    const token = 'a'.repeat(43)
    const hash = await hashOwnerInviteToken(token)
    expect(hash).toHaveLength(64)
    expect(isOwnerInviteHash(hash)).toBe(true)
    expect(hash).not.toContain(token)
  })
})
