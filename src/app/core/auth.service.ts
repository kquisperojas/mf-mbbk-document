import { Injectable, computed, signal } from '@angular/core';
import { SQUAD_MANAGER_ROLES } from './hub-data';
import { HubSession, UserDto } from './models';

const SESSION_KEY = 'mbbkHubSession';
const JUST_LOGGED_IN_KEY = 'mbbkHubJustLoggedIn';
const TTL_MS = 8 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<HubSession | null>(this.readSession());
  readonly session = this.sessionSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.sessionSignal() !== null);
  readonly isAdmin = computed(() => {
    const session = this.sessionSignal();
    if (!session) return false;
    return this.normalizedRole(session.role) === 'administrador' || session.username.toLowerCase() === 'admin';
  });
  readonly canManageSquad = computed(() => {
    const session = this.sessionSignal();
    if (!session) return false;
    if (this.isAdmin()) return true;
    return SQUAD_MANAGER_ROLES.includes(this.normalizedRole(session.role));
  });
  readonly isTechLead = computed(() => {
    const session = this.sessionSignal();
    if (!session) return false;
    const role = this.normalizedRole(session.role);
    return role === 'tech lead' || role === 'lider tecnico';
  });
  readonly homePath = computed(() => '/portal/dashboard');

  commentKind(): 'lead' | 'owner' {
    return this.isTechLead() ? 'lead' : 'owner';
  }

  private normalizedRole(role: string | undefined): string {
    return (role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

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
    if (!keepSessionTimes) {
      sessionStorage.setItem(JUST_LOGGED_IN_KEY, '1');
    }
    return session;
  }

  consumeLoginToast(): string | null {
    if (!sessionStorage.getItem(JUST_LOGGED_IN_KEY)) return null;
    sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
    const session = this.sessionSignal();
    return session ? `Sesión iniciada como ${session.username}` : null;
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
    this.sessionSignal.set(null);
  }

  avatarUrl(username: string): string {
    return `https://github.com/${encodeURIComponent(username)}.png?size=120`;
  }

  githubUrl(username: string): string {
    return `https://github.com/${encodeURIComponent(username)}`;
  }
}
