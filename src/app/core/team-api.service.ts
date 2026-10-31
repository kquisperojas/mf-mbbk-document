import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError, timeout } from 'rxjs';
import { TeamMemberDto } from './models';

@Injectable({ providedIn: 'root' })
export class TeamApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<TeamMemberDto[]> {
    return this.http.get<TeamMemberDto[]>('/api/v1/squad/members').pipe(
      catchError((err) => this.fail(err, 'No se pudieron listar los miembros del squad.'))
    );
  }

  create(payload: {
    orden?: number | null;
    nombre: string;
    rol: string;
    correo: string;
    numero: string;
  }): Observable<TeamMemberDto> {
    return this.http.post<TeamMemberDto>('/api/v1/squad/members', payload).pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudo crear el miembro. Reintenta.'))
    );
  }

  update(id: string, payload: {
    orden?: number | null;
    nombre: string;
    rol: string;
    correo: string;
    numero: string;
  }): Observable<TeamMemberDto> {
    return this.http.put<TeamMemberDto>(`/api/v1/squad/members/${id}`, payload).pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudo actualizar el miembro. Reintenta.'))
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/squad/members/${id}`).pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudo eliminar el miembro. Reintenta.'))
    );
  }

  validate(payload: { nombre: string; rol: string; correo: string }): string | null {
    if (!payload.nombre.trim() || !payload.rol.trim()) {
      return 'Completa nombre y rol.';
    }
    if (payload.correo.trim() && !payload.correo.includes('@')) {
      return 'Ingresa un correo válido.';
    }
    return null;
  }

  private fail(err: HttpErrorResponse | { name?: string; message?: string }, fallback: string) {
    if ((err as { name?: string }).name === 'TimeoutError' || (err as HttpErrorResponse).status === 0) {
      return throwError(() => new Error('El servicio del squad no responde. Inténtalo de nuevo.'));
    }
    const http = err as HttpErrorResponse;
    const raw = http.error;
    if (typeof raw === 'string' && raw.trim()) {
      return throwError(() => new Error(raw.length > 180 ? fallback : raw));
    }
    const body = raw as { detail?: string; error?: string; errors?: Record<string, string> } | null;
    const fieldEntries = body?.errors ? Object.entries(body.errors) : [];
    const firstField = fieldEntries[0] ? `${fieldEntries[0][0]}: ${fieldEntries[0][1]}` : '';
    const detail = body?.detail && body.detail !== 'Datos de usuario inválidos' ? body.detail : '';
    return throwError(() => new Error(firstField || detail || body?.error || fallback));
  }
}
