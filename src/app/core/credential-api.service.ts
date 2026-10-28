import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError, timeout } from 'rxjs';
import { ApiCredential } from './models';

@Injectable({ providedIn: 'root' })
export class CredentialApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<ApiCredential[]> {
    return this.http.get<ApiCredential[]>('/api/v1/credenciales-apis').pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudieron cargar las credenciales.'))
    );
  }

  upsert(payload: {
    proveedor: string;
    clave: string;
    valor: string;
    descripcion?: string;
  }): Observable<ApiCredential> {
    return this.http.put<ApiCredential>('/api/v1/credenciales-apis', payload).pipe(
      timeout({ first: 15000 }),
      catchError((err) => this.fail(err, 'No se pudo guardar la credencial.'))
    );
  }

  private fail(err: HttpErrorResponse | { name?: string }, fallback: string) {
    if ((err as { name?: string }).name === 'TimeoutError' || (err as HttpErrorResponse).status === 0) {
      return throwError(() => new Error('El API Java no responde en :8080. Arráncalo e inténtalo de nuevo.'));
    }
    const http = err as HttpErrorResponse;
    const body = http.error as { detail?: string; error?: string } | null;
    return throwError(() => new Error(body?.detail || body?.error || fallback));
  }
}
