import { describe, it, expect } from 'bun:test'
import { RemoteAuth } from './auth.js'

describe('RemoteAuth', () => {
  const secret = 'test-secret-key-for-jwt'

  describe('generateToken()', () => {
    it('returns a non-empty JWT string', () => {
      const auth = new RemoteAuth(secret)
      const token = auth.generateToken()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
      // JWTs have 3 dot-separated parts
      expect(token.split('.').length).toBe(3)
    })
  })

  describe('verifyToken()', () => {
    it('returns true for valid token', () => {
      const auth = new RemoteAuth(secret)
      const token = auth.generateToken()
      expect(auth.verifyToken(token)).toBe(true)
    })

    it('returns false for invalid token', () => {
      const auth = new RemoteAuth(secret)
      expect(auth.verifyToken('invalid.token.here')).toBe(false)
    })

    it('returns false for tampered token', () => {
      const auth = new RemoteAuth(secret)
      expect(auth.verifyToken('tampered.jwt.token')).toBe(false)
    })
  })

  describe('round-trip', () => {
    it('generate then verify returns true', () => {
      const auth = new RemoteAuth(secret)
      const token = auth.generateToken()
      expect(auth.verifyToken(token)).toBe(true)
    })
  })

  describe('different secret', () => {
    it('verify fails with different secret', () => {
      const auth1 = new RemoteAuth('secret-one')
      const auth2 = new RemoteAuth('secret-two')
      const token = auth1.generateToken()
      expect(auth2.verifyToken(token)).toBe(false)
    })
  })

  describe('validateApiKey()', () => {
    it('returns true when key matches', () => {
      const auth = new RemoteAuth(secret, 'my-api-key')
      expect(auth.validateApiKey('my-api-key')).toBe(true)
    })

    it('returns false when key does not match', () => {
      const auth = new RemoteAuth(secret, 'my-api-key')
      expect(auth.validateApiKey('wrong-key')).toBe(false)
    })

    it('returns false when no apiKey is set', () => {
      const auth = new RemoteAuth(secret)
      expect(auth.validateApiKey('any-key')).toBe(false)
    })
  })

  describe('authenticateHeader()', () => {
    it('delegates Bearer token to verifyToken', () => {
      const auth = new RemoteAuth(secret)
      const token = auth.generateToken()
      expect(auth.authenticateHeader(`Bearer ${token}`)).toBe(true)
      expect(auth.authenticateHeader('Bearer invalid-token')).toBe(false)
    })

    it('delegates ApiKey to validateApiKey', () => {
      const auth = new RemoteAuth(secret, 'correct-key')
      expect(auth.authenticateHeader('ApiKey correct-key')).toBe(true)
      expect(auth.authenticateHeader('ApiKey wrong-key')).toBe(false)
    })

    it('returns false for invalid header format', () => {
      const auth = new RemoteAuth(secret, 'my-key')
      expect(auth.authenticateHeader('Invalid something')).toBe(false)
      expect(auth.authenticateHeader('Basic dXNlcjpwYXNz')).toBe(false)
      expect(auth.authenticateHeader('')).toBe(false)
    })
  })
})
