import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import {
  AdminDoc,
  CatalogPayload,
  DocIndexItem,
  GenerateResult,
  JiraConfig,
  JiraInitiative
} from './models';

@Injectable({ providedIn: 'root' })
export class HubApiService {
  private readonly http = inject(HttpClient);

  docsUrl(key: string, hash = '#iniciativa'): string {
    return `/docs/${key}/informe-${key}.html${hash}`;
  }

  resolveDocUrl(pathOrUrl: string | undefined, key: string): string {
    if (pathOrUrl && /^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    if (pathOrUrl && pathOrUrl.startsWith('/docs/')) return pathOrUrl;
    return this.docsUrl(key);
  }

  catalog(): Observable<CatalogPayload> {
    return this.http.get<CatalogPayload>('/api/v1/catalog').pipe(catchError((err) => this.fail(err)));
  }

  config(): Observable<JiraConfig> {
    return this.http.get<JiraConfig>('/api/v1/config').pipe(catchError((err) => this.fail(err)));
  }

  initiatives(scope: string): Observable<{
    items: JiraInitiative[];
    documented: string[];
    jql: string;
    fetchedAt: string;
  }> {
    return this.http
      .get<{ items: JiraInitiative[]; documented: string[]; jql: string; fetchedAt: string }>(
        `/api/v1/initiatives?scope=${scope}`
      )
      .pipe(catchError((err) => this.fail(err)));
  }

  docsIndex(): Observable<{ items: DocIndexItem[] }> {
    return this.http
      .get<{ items: DocIndexItem[] }>('/api/v1/docs')
      .pipe(catchError((err) => this.fail(err)));
  }

  doc(key: string): Observable<AdminDoc> {
    return this.http.get<AdminDoc>(`/api/v1/docs/${encodeURIComponent(key)}`).pipe(catchError((err) => this.fail(err)));
  }

  saveDoc(key: string, payload: unknown): Observable<{ url?: string }> {
    return this.http
      .put<{ url?: string }>(`/api/v1/docs/${encodeURIComponent(key)}`, payload)
      .pipe(catchError((err) => this.fail(err)));
  }

  deleteDoc(key: string): Observable<unknown> {
    return this.http
      .delete(`/api/v1/docs/${encodeURIComponent(key)}`)
      .pipe(catchError((err) => this.fail(err)));
  }

  generate(form: FormData): Observable<GenerateResult> {
    return this.http.post<GenerateResult>('/api/v1/generate', form).pipe(catchError((err) => this.fail(err)));
  }

  uploadTests(
    key: string,
    file: File,
    featureBranch: string
  ): Observable<{ key: string; cases: number; url?: string; warnings?: string[]; summary?: Record<string, unknown> }> {
    const form = new FormData();
    form.append('tests', file);
    form.append('featureBranch', featureBranch);
    return this.http
      .post<{ key: string; cases: number; url?: string; warnings?: string[]; summary?: Record<string, unknown> }>(
        `/api/v1/docs/${encodeURIComponent(key)}/tests`,
        form
      )
      .pipe(catchError((err) => this.fail(err)));
  }

  private fail(err: HttpErrorResponse) {
    const body = err.error as { error?: string; detail?: string } | null;
    return throwError(() => new Error(body?.detail || body?.error || `Error ${err.status}`));
  }
}
