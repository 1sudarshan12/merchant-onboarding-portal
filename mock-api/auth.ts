import { randomUUID } from 'node:crypto';
import type { TokenPair } from '../shared/models';
import { ValidationError } from './validation';

interface Session extends TokenPair {
  id: string;
  userId: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

/** Opaque, in-memory demo sessions. A refresh rotates both credentials atomically. */
export class Sessions {
  private readonly accessTokens = new Map<string, Session>();
  private readonly refreshTokens = new Map<string, Session>();

  constructor(
    private readonly now: () => number,
    private readonly accessTtlMs: number,
    private readonly refreshTtlMs: number,
  ) {}

  create(userId: string): TokenPair {
    this.removeExpiredSessions();
    const session: Session = {
      id: randomUUID(),
      userId,
      accessToken: randomUUID(),
      refreshToken: randomUUID(),
      accessExpiresAt: this.now() + this.accessTtlMs,
      refreshExpiresAt: this.now() + this.refreshTtlMs,
    };
    this.store(session);
    return this.tokens(session);
  }

  authenticate(authorization: string | undefined): string {
    this.removeExpiredSessions();
    const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
    const session = token ? this.accessTokens.get(token) : undefined;
    if (!session || this.now() >= session.accessExpiresAt) {
      throw new ValidationError(401, 'UNAUTHENTICATED', 'Sign in again or refresh your session.');
    }
    return session.userId;
  }

  refresh(refreshToken: string): TokenPair {
    this.removeExpiredSessions();
    const session = this.refreshTokens.get(refreshToken);
    if (!session) {
      throw new ValidationError(
        401,
        'INVALID_REFRESH_TOKEN',
        'Your session has expired. Sign in again.',
      );
    }
    this.remove(session);
    session.accessToken = randomUUID();
    session.refreshToken = randomUUID();
    session.accessExpiresAt = this.now() + this.accessTtlMs;
    this.store(session);
    return this.tokens(session);
  }

  logout(refreshToken: string): void {
    this.removeExpiredSessions();
    const session = this.refreshTokens.get(refreshToken);
    if (session) this.remove(session);
  }

  private tokens(session: Session): TokenPair {
    return { accessToken: session.accessToken, refreshToken: session.refreshToken };
  }

  private store(session: Session): void {
    this.accessTokens.set(session.accessToken, session);
    this.refreshTokens.set(session.refreshToken, session);
  }

  private remove(session: Session): void {
    this.accessTokens.delete(session.accessToken);
    this.refreshTokens.delete(session.refreshToken);
  }

  private removeExpiredSessions(): void {
    for (const session of this.refreshTokens.values()) {
      if (this.now() >= session.refreshExpiresAt) this.remove(session);
    }
  }
}
