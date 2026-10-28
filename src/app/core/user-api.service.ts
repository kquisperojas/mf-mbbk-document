import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError, timeout } from 'rxjs';
import { CatalogItem, UserDto } from './models';

export const GITHUB_USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(HttpClient);

  validateCreate(payload: {
    githubUsername: string;
    email: string;
    password: string;
    nombre: string;
    rol: string;
    squad: string;
  }): string | null {
    if (!payload.githubUsername || !payload.email || !payload.password || !payload.nombre) {
      return 'Completa usuario GitHub, correo, contraseña y nombre.';
    }
    if (!GITHUB_USERNAME_PATTERN.test(payload.githubUsername) || payload.githubUsername.length > 39) {
      return 'El usuario GitHub no admite espacios ni @. Usa el handle, por ejemplo kquispe.';
    }
    if (!payload.email.includes('@')) {
      return 'Ingresa un correo válido.';
    }
    if (payload.password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (!payload.rol) {
      return 'Selecciona un rol.';
    }
    if (!payload.squad) {
      return 'Selecciona un squad.';
    }
    return null;
  }

  login(githubUsername: string, password: string): Observable<UserDto> {
    return this.http
      .post<UserDto>('/api/v1/auth/login', { githubUsername, password })
      .pipe(catchError((err) => this.fail(err, 'No se pudo validar la sesión. Reintenta.')));
  }

  resetPassword(githubUsername: string, newPassword: string): Observable<UserDto> {
    return this.http
      .post<UserDto>('/api/v1/auth/password', { githubUsername, newPassword })
      .pipe(
        timeout({ first: 15000 }),
        catchError((err) => this.fail(err, 'No se pudo actualizar la contraseña. Reintenta.'))
      );
  }

  list(): Observable<UserDto[]> {
    return this.http.get<{ content: UserDto[] }>('/api/v1/usuarios?size=100&sort=nombre,asc').pipe(
      map((page) => page.content || []),
      catchError((err) => this.fail(err, 'No se pudieron listar los usuarios.'))
    );
  }

  update(id: string, payload: {
    githubUsername: string;
    email: string;
    password: string;
    nombre: string;
    rol: string;
    squad: string;
    perfilPublico: string;
  }): Observable<UserDto> {
    return this.http.put<UserDto>(`/api/v1/usuarios/${id}`, payload).pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudo actualizar el usuario. Reintenta.'))
    );
  }

  updateProfile(id: string, payload: {
    githubUsername: string;
    nombre: string;
    email: string;
    perfilGithub: string;
  }): Observable<UserDto> {
    return this.http.patch<UserDto>(`/api/v1/usuarios/${id}/perfil`, payload).pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudo guardar el perfil. Reintenta.'))
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/usuarios/${id}`).pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudo eliminar el usuario. Reintenta.'))
    );
  }

  register(payload: {
    githubUsername: string;
    email: string;
    password: string;
    nombre: string;
    rol: string;
    squad: string;
  }): Observable<UserDto> {
    return this.http.post<UserDto>('/api/v1/usuarios', payload).pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudo crear el usuario. Reintenta.'))
    );
  }

  roles(): Observable<CatalogItem[]> {
    return this.http.get<CatalogItem[]>('/api/v1/catalogos/roles').pipe(
      catchError(() =>
        throwError(() => new Error('No se pudieron cargar los roles.'))
      )
    );
  }

  squads(): Observable<CatalogItem[]> {
    return this.http.get<CatalogItem[]>('/api/v1/catalogos/squads').pipe(
      catchError(() =>
        throwError(() => new Error('No se pudieron cargar los squads.'))
      )
    );
  }

  private fail(err: HttpErrorResponse | { name?: string; message?: string }, fallback: string) {
    if ((err as { name?: string }).name === 'TimeoutError' || (err as HttpErrorResponse).status === 0) {
      return throwError(() => new Error('El API Java no responde en :8080. Arráncalo e inténtalo de nuevo.'));
    }
    const http = err as HttpErrorResponse;
    const raw = http.error;
    if (typeof raw === 'string' && raw.trim()) {
      return throwError(() => new Error(raw.length > 180 ? fallback : raw));
    }
    const body = raw as { detail?: string; error?: string; errors?: Record<string, string> } | null;
    const fieldEntries = body?.errors ? Object.entries(body.errors) : [];
    const github = fieldEntries.find(([key]) => key === 'githubUsername')?.[1];
    const password = fieldEntries.find(([key]) => key === 'newPassword' || key === 'password')?.[1];
    const firstField = github
      ? `Usuario GitHub ${github}`
      : password
        ? `Contraseña ${password}`
        : fieldEntries[0]
          ? `${fieldEntries[0][0]}: ${fieldEntries[0][1]}`
          : '';
    const detail = body?.detail && body.detail !== 'Datos de usuario inválidos' ? body.detail : '';
    return throwError(() => new Error(firstField || detail || body?.detail || body?.error || fallback));
  }
}
