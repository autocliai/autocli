import jwt from 'jsonwebtoken'

export class RemoteAuth {
  private secret: string
  private apiKey?: string

  constructor(secret: string, apiKey?: string) {
    this.secret = secret
    this.apiKey = apiKey
  }

  generateToken(expiresIn: string | number = '24h'): string {
    return jwt.sign({ type: 'autocli-remote' }, this.secret, { expiresIn } as jwt.SignOptions)
  }

  verifyToken(token: string): boolean {
    try {
      jwt.verify(token, this.secret)
      return true
    } catch {
      return false
    }
  }

  validateApiKey(key: string): boolean {
    return this.apiKey !== undefined && key === this.apiKey
  }

  authenticateHeader(header: string): boolean {
    if (header.startsWith('Bearer ')) {
      return this.verifyToken(header.slice(7))
    }
    if (header.startsWith('ApiKey ')) {
      return this.validateApiKey(header.slice(7))
    }
    return false
  }
}
