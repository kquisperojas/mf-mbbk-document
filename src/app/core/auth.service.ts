import { Injectable, computed, signal } from '@angular/core';
import { ADMIN_ROLE } from './hub-data';
import { HubSession, UserDto } from './models';

const SESSION_KEY = 'mbbkHubSession';
const TTL_MS = 8 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<HubSession | null>(this.readSession());
  readonly session = this.sessionSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.sessionSignal() !== null);
  readonly isAdmin = computed(() => {
    const session = this.sessionSignal();
    if (!session) return false;
    return session.role === ADMIN_ROLE || session.username.toLowerCase() === 'admin';
  });
  readonly homePath = computed(() => '/portal/dashboard');

  private readSession(): HubSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as HubSession;
      if (!session?.username || !session.expiresAt) return null;
      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      session.publicProfile = session.publicProfile || session.username;
      return session;
    } catch {
      return null;
    }
  }

  saveFromUser(user: UserDto, keepSessionTimes = false): HubSession {
    const current = this.sessionSignal();
    const now = Date.now();
    const session: HubSession = {
      id: user.id,
      username: user.githubUsername,
      displayName: user.nombre,
      role: user.rol,
      squad: user.squad,
      email: user.email,
      publicProfile: user.perfilPublico || user.githubUsername,
      loginAt: keepSessionTimes && current?.loginAt ? current.loginAt : now,
      expiresAt: keepSessionTimes && current?.expiresAt ? current.expiresAt : now + TTL_MS
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
    return session;
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    this.sessionSignal.set(null);
  }

  avatarUrl(username: string): string {
    return `https://github.com/${encodeURIComponent(username)}.png?size=120`;
  }

  githubUrl(username: string): string {
    return `https://github.com/${encodeURIComponent(username)}`;
  }
}
