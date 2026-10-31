import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import {
  AdminDoc,
  CatalogPayload,
  DocDraft,
  DocIndexItem,
  DocReview,
  DocReviewComment,
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

  jiraIssue(key: string): Observable<JiraInitiative> {
    return this.http
      .get<JiraInitiative>(`/api/v1/initiatives/${encodeURIComponent(key)}`)
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

  review(key: string): Observable<DocReview> {
    return this.http
      .get<DocReview>(`/api/v1/docs/${encodeURIComponent(key)}/review`)
      .pipe(catchError((err) => this.fail(err)));
  }

  saveReview(key: string, payload: DocReview): Observable<DocReview> {
    return this.http
      .put<DocReview>(`/api/v1/docs/${encodeURIComponent(key)}/review`, payload)
      .pipe(catchError((err) => this.fail(err)));
  }

  addComment(key: string, actor: { id?: string; username: string }, texto: string): Observable<DocReviewComment> {
    return this.http
      .post<DocReviewComment>(`/api/v1/docs/${encodeURIComponent(key)}/comentarios`, this.actorBody(actor, { texto }))
      .pipe(catchError((err) => this.fail(err)));
  }

  updateComment(
    key: string,
    commentId: string,
    actor: { id?: string; username: string },
    texto: string
  ): Observable<DocReviewComment> {
    return this.http
      .put<DocReviewComment>(
        `/api/v1/docs/${encodeURIComponent(key)}/comentarios/${encodeURIComponent(commentId)}`,
        this.actorBody(actor, { texto })
      )
      .pipe(catchError((err) => this.fail(err)));
  }

  deleteComment(key: string, commentId: string, actor: { id?: string; username: string }): Observable<void> {
    const query = new URLSearchParams();
    if (actor.id) query.set('usuarioId', actor.id);
    if (actor.username) query.set('githubUsername', actor.username);
    return this.http
      .delete<void>(`/api/v1/docs/${encodeURIComponent(key)}/comentarios/${encodeURIComponent(commentId)}?${query}`)
      .pipe(catchError((err) => this.fail(err)));
  }

  approveDoc(key: string, actor: { id?: string; username: string }): Observable<DocReview> {
    return this.http
      .post<DocReview>(`/api/v1/docs/${encodeURIComponent(key)}/aprobar`, this.actorBody(actor))
      .pipe(catchError((err) => this.fail(err)));
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

  saveDraft(form: FormData): Observable<DocDraft> {
    return this.http.post<DocDraft>('/api/v1/drafts', form).pipe(catchError((err) => this.fail(err)));
  }

  loadDraft(key: string): Observable<DocDraft> {
    return this.http
      .get<DocDraft>(`/api/v1/drafts/${encodeURIComponent(key)}`)
      .pipe(catchError((err) => this.fail(err)));
  }

  deleteDraft(key: string): Observable<unknown> {
    return this.http
      .delete(`/api/v1/drafts/${encodeURIComponent(key)}`)
      .pipe(catchError((err) => this.fail(err)));
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

  private actorBody(actor: { id?: string; username: string }, extra: Record<string, string> = {}): Record<string, string> {
    return {
      ...extra,
      ...(actor.id ? { usuarioId: actor.id } : {}),
      githubUsername: actor.username
    };
  }

  private fail(err: HttpErrorResponse) {
    if (err.status === 0) {
      return throwError(() => new Error('El servicio de documentación no responde. Comprueba que el backend esté en el puerto 8080.'));
    }
    const body = err.error as { error?: string; detail?: string } | null;
    const detail = body && typeof body === 'object' ? body.detail || body.error : '';
    return throwError(() => new Error(detail || `Error ${err.status}`));
  }
}
