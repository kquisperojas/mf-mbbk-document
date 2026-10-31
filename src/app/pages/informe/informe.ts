import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { HubApiService } from '../../core/hub-api.service';
import { TeamApiService } from '../../core/team-api.service';
import { UserApiService } from '../../core/user-api.service';
import { DocLifecycleStatus, DocReview, DocReviewComment, JiraInitiative } from '../../core/models';
import { buildInitiativeDocx, collectDiagramImages, downloadBlob } from '../../core/word-report';

@Component({
  selector: 'app-informe',
  imports: [FormsModule],
  templateUrl: './informe.html'
})
export class InformePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly hub = inject(HubApiService);
  private readonly team = inject(TeamApiService);
  private readonly users = inject(UserApiService);
  readonly auth = inject(AuthService);
  readonly isTechLead = this.auth.isTechLead;

  src = signal<SafeResourceUrl>(this.sanitizer.bypassSecurityTrustResourceUrl('about:blank'));
  key = signal('');
  downloading = signal(false);
  review = signal<DocReview | null>(null);
  loadingReview = signal(false);
  reviewError = signal('');
  savingComment = signal(false);
  publishing = signal(false);
  approveOpen = signal(false);
  reviewInFrame = signal(false);
  editingId = signal<string | null>(null);
  editDraft = '';
  draft = '';
  comments = computed(() => this.review()?.comments || []);
  canApprove = computed(
    () => this.auth.isTechLead() && this.review()?.status === 'revision' && !this.publishing()
  );
  private frame: HTMLIFrameElement | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const key = params.get('key') || '';
      this.key.set(key);
      const hash = (typeof location !== 'undefined' && location.hash) || '#iniciativa';
      const url = `/docs/${key}/informe-${key}.html?t=${Date.now()}${hash.startsWith('#') ? hash : '#' + hash}`;
      this.src.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      this.draft = '';
      this.editDraft = '';
      this.editingId.set(null);
      this.approveOpen.set(false);
      this.reviewInFrame.set(false);
      this.frame = null;
      this.loadReview(key);
    });
  }

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent): void {
    if (event.origin !== location.origin) return;
    if (event.data?.type !== 'mbbk-download-word') return;
    this.downloadWord(this.frameDoc());
  }

  onFrameLoad(frame: HTMLIFrameElement): void {
    let doc: Document | null = null;
    try {
      doc = frame.contentDocument;
    } catch {
      this.frame = null;
      this.reviewInFrame.set(false);
      return;
    }
    if (!doc || doc.location?.href === 'about:blank') return;
    this.frame = frame;
    this.ensureWordAction(doc);
    this.syncReviewIntoFrame();
  }

  addComment(): void {
    const frameText = this.frameDoc()?.getElementById('mbbk-review-comment') as HTMLTextAreaElement | null;
    if (frameText) this.draft = frameText.value;
    const text = this.draft.trim();
    const key = this.key();
    const session = this.auth.session();
    if (!text || !key || !session || this.savingComment()) return;
    this.savingComment.set(true);
    this.reviewError.set('');
    this.syncReviewIntoFrame();
    this.hub.addComment(key, session, text).subscribe({
      next: () => {
        this.draft = '';
        this.savingComment.set(false);
        this.loadReview(key, true);
      },
      error: (err: Error) => {
        this.savingComment.set(false);
        this.reviewError.set(err.message || 'No se pudo publicar el comentario.');
        this.syncReviewIntoFrame();
      }
    });
  }

  startEdit(item: DocReviewComment): void {
    if (!this.canEditComment(item)) return;
    this.editingId.set(item.id);
    this.editDraft = item.text;
    this.syncReviewIntoFrame();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editDraft = '';
    this.syncReviewIntoFrame();
  }

  saveEdit(item?: DocReviewComment): void {
    const frameText = this.frameDoc()?.querySelector('[data-edit-text]') as HTMLTextAreaElement | null;
    if (frameText) this.editDraft = frameText.value;
    const text = this.editDraft.trim();
    const key = this.key();
    const session = this.auth.session();
    const target = item || this.comments().find((row) => row.id === this.editingId());
    if (!text || !key || !session || !target || this.savingComment()) return;
    this.savingComment.set(true);
    this.reviewError.set('');
    this.hub.updateComment(key, target.id, session, text).subscribe({
      next: () => {
        this.savingComment.set(false);
        this.editingId.set(null);
        this.editDraft = '';
        this.loadReview(key, true);
      },
      error: (err: Error) => {
        this.savingComment.set(false);
        this.reviewError.set(err.message || 'No se pudo editar el comentario.');
        this.syncReviewIntoFrame();
      }
    });
  }

  removeComment(item: DocReviewComment): void {
    const key = this.key();
    const session = this.auth.session();
    if (!key || !session || !this.canDeleteComment(item)) return;
    if (!window.confirm('¿Eliminar este comentario?')) return;
    this.savingComment.set(true);
    this.reviewError.set('');
    this.hub.deleteComment(key, item.id, session).subscribe({
      next: () => {
        this.savingComment.set(false);
        if (this.editingId() === item.id) this.editingId.set(null);
        this.loadReview(key, true);
      },
      error: (err: Error) => {
        this.savingComment.set(false);
        this.reviewError.set(err.message || 'No se pudo eliminar el comentario.');
        this.syncReviewIntoFrame();
      }
    });
  }

  canEditComment(item: DocReviewComment): boolean {
    const session = this.auth.session();
    if (!session) return false;
    return this.isSameUser(item, session);
  }

  canDeleteComment(item: DocReviewComment): boolean {
    return this.canEditComment(item);
  }

  openApprove(): void {
    if (!this.canApprove()) return;
    this.approveOpen.set(true);
  }

  closeApprove(event?: Event): void {
    if (event && event.target !== event.currentTarget) return;
    this.approveOpen.set(false);
  }

  confirmApprove(): void {
    const key = this.key();
    const session = this.auth.session();
    if (!key || this.publishing()) return;
    if (!session) {
      this.reviewError.set('Vuelve a iniciar sesión para aprobar.');
      this.syncReviewIntoFrame();
      return;
    }
    if (!this.auth.isTechLead()) {
      this.reviewError.set('Solo el líder técnico puede aprobar la documentación.');
      this.syncReviewIntoFrame();
      return;
    }
    this.publishing.set(true);
    this.reviewError.set('');
    this.syncReviewIntoFrame();
    this.hub.approveDoc(key, session).subscribe({
      next: (saved) => {
        this.review.set(this.normalizeReview(key, saved));
        this.publishing.set(false);
        this.approveOpen.set(false);
        this.syncReviewIntoFrame();
      },
      error: (err: Error) => {
        this.publishing.set(false);
        this.reviewError.set(err.message || 'No se pudo aprobar la documentación.');
        this.syncReviewIntoFrame();
      }
    });
  }

  formatWhen(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
  }

  private loadReview(key: string, silent = false): void {
    if (!key) return;
    if (!silent) this.loadingReview.set(true);
    this.reviewError.set('');
    this.hub.review(key).subscribe({
      next: (data) => {
        this.review.set(this.normalizeReview(key, data));
        this.loadingReview.set(false);
        this.syncReviewIntoFrame();
      },
      error: (err: Error) => {
        this.review.set(this.emptyReview(key));
        this.loadingReview.set(false);
        this.reviewError.set(err.message || 'No se pudieron cargar las observaciones.');
        this.syncReviewIntoFrame();
      }
    });
  }

  private syncReviewIntoFrame(): void {
    const doc = this.frameDoc();
    if (!doc) {
      this.reviewInFrame.set(false);
      return;
    }
    const iniciativa = doc.getElementById('iniciativa');
    if (!iniciativa) {
      this.reviewInFrame.set(false);
      return;
    }
    this.ensureReviewStyles(doc);
    let host = doc.getElementById('mbbk-doc-review');
    if (!host) {
      host = doc.createElement('section');
      host.id = 'mbbk-doc-review';
      host.className = 'mbbk-doc-review';
      iniciativa.appendChild(host);
    }
    this.renderReviewHost(doc, host);
    this.reviewInFrame.set(true);
  }

  private frameDoc(): Document | null {
    try {
      const doc = this.frame?.contentDocument || null;
      if (!doc || doc.location?.href === 'about:blank') return null;
      return doc;
    } catch {
      return null;
    }
  }

  private ensureReviewStyles(doc: Document): void {
    if (doc.getElementById('mbbk-review-style')) return;
    const style = doc.createElement('style');
    style.id = 'mbbk-review-style';
    style.textContent = `
      .mbbk-doc-review { margin: 32px 0 8px; padding-top: 8px; border-top: 1px solid var(--border); }
      .mbbk-doc-review-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
      .mbbk-doc-review-head h2 { margin: 0 0 6px; }
      .mbbk-doc-review-head .muted { margin: 0; }
      .mbbk-doc-review .tag.published { background: var(--success-bg); color: #1d7a38; }
      .mbbk-doc-review .tag.review { background: #d5e4f2; color: #104798; }
      .mbbk-doc-review .tag.stale { background: var(--warn-bg); color: var(--warn); }
      .mbbk-comments { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
      .mbbk-comment { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
      .mbbk-comment.lead { border-left: 4px solid var(--bp-blue); }
      .mbbk-comment.owner { border-left: 4px solid var(--bp-yellow); }
      .mbbk-comment header { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: baseline; margin-bottom: 8px; }
      .mbbk-comment header strong { color: var(--bp-blue); }
      .mbbk-comment header span, .mbbk-comment header time { color: var(--tertiary); font-size: 0.85rem; }
      .mbbk-comment p { margin: 0; white-space: pre-wrap; }
      .mbbk-comment-actions { display: flex; gap: 10px; margin-top: 10px; }
      .mbbk-link { background: none; border: 0; padding: 0; color: var(--link); font: inherit; font-weight: 700; cursor: pointer; }
      .mbbk-link:hover { text-decoration: underline; }
      .mbbk-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
      .mbbk-btn.secondary { background: #fff; border: 1px solid var(--border); min-width: 0; }
      .mbbk-comment-form { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 20px; }
      .mbbk-comment-form label { display: block; font-weight: 600; color: var(--bp-blue); margin-bottom: 8px; }
      .mbbk-comment-form textarea { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font: inherit; resize: vertical; min-height: 96px; }
      .mbbk-comment-form textarea:focus { outline: 2px solid var(--bp-yellow); border-color: var(--bp-blue); }
      .mbbk-comment-form-actions, .mbbk-review-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
      .mbbk-btn { border: 0; border-radius: 8px; background: var(--bp-yellow); color: var(--bp-blue); font: inherit; font-weight: 700; padding: 12px 18px; cursor: pointer; min-width: 220px; }
      .mbbk-btn:hover { filter: brightness(0.97); }
      .mbbk-btn:disabled { opacity: 0.6; cursor: wait; }
    `;
    doc.head.appendChild(style);
  }

  private renderReviewHost(doc: Document, host: HTMLElement): void {
    const review = this.review() || this.emptyReview(this.key());
    const comments = review.comments;
    const status = review.status;
    const published = status === 'publicada';
    const stale = status === 'desactualizada';
    const error = this.reviewError();
    const loading = this.loadingReview();
    const saving = this.savingComment();
    const lead = this.auth.isTechLead();
    const canApprove = this.canApprove();
    const list = loading
      ? '<p class="muted">Cargando comentarios…</p>'
      : comments.length
        ? comments
            .map((item) => {
              const kind = item.kind || this.kindFromRole(item.role);
              const editing = this.editingId() === item.id;
              const actions = this.canEditComment(item) || this.canDeleteComment(item)
                ? `<div class="mbbk-comment-actions">
                    ${this.canEditComment(item) ? `<button type="button" class="mbbk-link" data-edit="${this.escapeHtml(item.id)}">Editar</button>` : ''}
                    ${this.canDeleteComment(item) ? `<button type="button" class="mbbk-link" data-delete="${this.escapeHtml(item.id)}">Eliminar</button>` : ''}
                  </div>`
                : '';
              const body = editing
                ? `<textarea data-edit-text rows="3" maxlength="2000">${this.escapeHtml(this.editDraft || item.text)}</textarea>
                   <div class="mbbk-edit-actions">
                     <button type="button" class="mbbk-btn secondary" data-cancel-edit>Cancelar</button>
                     <button type="button" class="mbbk-btn" data-save-edit="${this.escapeHtml(item.id)}">Guardar</button>
                   </div>`
                : `<p>${this.escapeHtml(item.text)}</p>${actions}`;
              return `<article class="mbbk-comment ${kind}" data-comment-id="${this.escapeHtml(item.id)}">
          <header>
            <strong>${this.escapeHtml(item.author)}</strong>
            <span>${kind === 'lead' ? 'Líder técnico' : 'Dueño de la iniciativa'}</span>
            <span>${this.escapeHtml(item.role || '')}</span>
            <time>${this.escapeHtml(this.formatWhen(item.createdAt))}</time>
          </header>
          ${body}
        </article>`;
            })
            .join('')
        : '<p class="muted">Aún no hay observaciones ni respuestas.</p>';
    const publishedNote =
      published && review.publishedBy
        ? `<p class="muted">Aprobada y publicada por ${this.escapeHtml(review.publishedBy)}${
            review.publishedAt ? ` · ${this.escapeHtml(this.formatWhen(review.publishedAt))}` : ''
          }</p>`
        : '';
    const missingNote =
      stale && review.missing?.length
        ? `<div class="callout warn">Documentación desactualizada: faltan ${this.escapeHtml(
            review.missing.join(' y ')
          )}. Completa los adjuntos y vuelve a generar para pasar a En revisión.</div>`
        : '';
    const placeholder = lead
      ? 'Indica qué no cumple o qué hay que corregir en la documentación.'
      : 'Indica qué se corrigió o actualizó para responder al líder técnico.';
    host.innerHTML = `
      <div class="mbbk-doc-review-head">
        <div>
          <h2>Observaciones y respuestas</h2>
          <p class="muted">El líder técnico marca lo que no cumple. El dueño de la iniciativa responde cuando ya lo corrigió.</p>
        </div>
        <span class="tag ${this.statusTagClass(status)}">${this.statusLabel(status)}</span>
      </div>
      ${error ? `<div class="callout warn">${this.escapeHtml(error)}</div>` : ''}
      ${missingNote}
      ${publishedNote}
      <div class="mbbk-comments">${list}</div>
      <form class="mbbk-comment-form" id="mbbk-review-form">
        <label for="mbbk-review-comment">Nuevo comentario</label>
        <textarea id="mbbk-review-comment" rows="4" maxlength="2000"
          placeholder="${placeholder}"
          ${saving ? 'disabled' : ''}></textarea>
        <div class="mbbk-comment-form-actions">
          <button type="submit" class="mbbk-btn" ${saving ? 'disabled' : ''}>Publicar comentario</button>
        </div>
      </form>
      ${
        lead
          ? `<div class="mbbk-review-actions">
        <button type="button" class="mbbk-btn" id="mbbk-review-approve" ${canApprove ? '' : 'disabled'}>Aprobar documentación</button>
      </div>`
          : ''
      }
    `;
    const textarea = host.querySelector('#mbbk-review-comment') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.value = this.draft;
      textarea.addEventListener('input', () => {
        this.draft = textarea.value;
      });
    }
    host.querySelector('#mbbk-review-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.addComment();
    });
    host.querySelector('#mbbk-review-approve')?.addEventListener('click', () => this.openApprove());
    host.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = this.comments().find((row) => row.id === button.dataset['edit']);
        if (item) this.startEdit(item);
      });
    });
    host.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = this.comments().find((row) => row.id === button.dataset['delete']);
        if (item) this.removeComment(item);
      });
    });
    host.querySelector('[data-cancel-edit]')?.addEventListener('click', () => this.cancelEdit());
    host.querySelectorAll<HTMLButtonElement>('[data-save-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = this.comments().find((row) => row.id === button.dataset['saveEdit']);
        this.saveEdit(item);
      });
    });
    const editArea = host.querySelector('[data-edit-text]') as HTMLTextAreaElement | null;
    if (editArea) {
      editArea.addEventListener('input', () => {
        this.editDraft = editArea.value;
      });
    }
  }

  private escapeHtml(value: string): string {
    return String(value || '').replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#39;';
      }
    });
  }

  private emptyReview(key: string): DocReview {
    return { key, status: 'revision', statusLabel: 'En revisión', publishedAt: null, publishedBy: null, missing: [], comments: [] };
  }

  private normalizeReview(key: string, data: DocReview | null | undefined): DocReview {
    const status = this.normalizeStatus(data?.status);
    return {
      key: data?.key || key,
      status,
      statusLabel: data?.statusLabel || this.statusLabel(status),
      publishedAt: data?.publishedAt || null,
      publishedBy: data?.publishedBy || null,
      missing: Array.isArray(data?.missing) ? data.missing : [],
      comments: Array.isArray(data?.comments)
        ? data.comments.map((item) => ({
            ...item,
            id: String(item.id),
            usuarioId: item.usuarioId ? String(item.usuarioId) : undefined,
            rolId: item.rolId ? String(item.rolId) : undefined,
            text: item.text,
            kind: item.kind || this.kindFromRole(item.role)
          }))
        : []
    };
  }

  private normalizeStatus(status?: string): DocLifecycleStatus {
    if (status === 'publicada' || status === 'borrador' || status === 'desactualizada' || status === 'revision') {
      return status;
    }
    return 'revision';
  }

  private statusLabel(status: DocLifecycleStatus): string {
    if (status === 'publicada') return 'Publicada';
    if (status === 'desactualizada') return 'Desactualizada';
    if (status === 'borrador') return 'Borrador';
    return 'En revisión';
  }

  private statusTagClass(status: DocLifecycleStatus): string {
    if (status === 'publicada') return 'published';
    if (status === 'desactualizada') return 'stale';
    if (status === 'borrador') return 'draft';
    return 'review';
  }

  private kindFromRole(role?: string): 'lead' | 'owner' {
    const normalized = (role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    return normalized === 'tech lead' || normalized === 'lider tecnico' ? 'lead' : 'owner';
  }

  private isSameUser(item: DocReviewComment, session: { id?: string; username: string }): boolean {
    if (item.usuarioId && session.id) return item.usuarioId === session.id;
    return !!item.username && item.username.toLowerCase() === session.username.toLowerCase();
  }

  private ensureWordAction(doc: Document): void {
    const menu = doc.getElementById('share-menu');
    if (!menu) return;
    if (!menu.querySelector('#share-word')) {
      const item = doc.createElement('div');
      item.className = 'share-item';
      item.setAttribute('role', 'none');
      item.innerHTML =
        '<button type="button" class="share-section share-word" id="share-word" role="menuitem">Descargar Word</button>';
      menu.appendChild(item);
    }
    if (doc.documentElement.dataset['mbbkWord'] === '1') return;
    doc.documentElement.dataset['mbbkWord'] = '1';
    doc.addEventListener(
      'click',
      (event) => {
        const target = event.target as Element | null;
        if (!target?.closest?.('#share-word, .share-word')) return;
        event.preventDefault();
        event.stopPropagation();
        menu.classList.remove('open');
        menu.hidden = true;
        doc.getElementById('share-btn')?.setAttribute('aria-expanded', 'false');
        this.downloadWord(doc);
      },
      true
    );
  }

  downloadWord(frameDoc?: Document | null): void {
    const key = this.key();
    const toastDoc = frameDoc || this.frameDoc();
    if (!key || this.downloading()) return;
    this.downloading.set(true);
    this.toast(toastDoc, 'Generando Word…');
    forkJoin({
      doc: this.hub.doc(key),
      review: this.hub.review(key).pipe(catchError(() => of(this.review()))),
      jira: this.hub.jiraIssue(key).pipe(catchError(() => of(null as JiraInitiative | null))),
      assigned: this.hub.initiatives('assigned').pipe(
        catchError(() => of({ items: [] as JiraInitiative[], documented: [], jql: '', fetchedAt: '' }))
      ),
      team: this.team.list().pipe(catchError(() => of([]))),
      users: this.users.list().pipe(catchError(() => of([])))
    }).subscribe({
      next: async ({ doc, review, jira, assigned, team, users }) => {
        try {
          const session = this.auth.session();
          const fromList = assigned.items.find((item) => item.key === key) || null;
          const live = jira && String(jira.summary || '').trim() ? jira : fromList;
          this.toast(toastDoc, 'Incluyendo diagramas en el Word…');
          const images = await collectDiagramImages(doc);
          const blob = await buildInitiativeDocx(
            doc,
            {
              displayName: session?.displayName,
              role: session?.role,
              squad: session?.squad,
              review: review || this.review(),
              jira: live,
              team,
              users
            },
            images
          );
          downloadBlob(blob, `informe-${key}.docx`);
          this.toast(toastDoc, 'Word descargado.');
        } catch (err) {
          this.toast(toastDoc, err instanceof Error ? err.message : 'No se pudo generar el Word.');
        } finally {
          this.downloading.set(false);
        }
      },
      error: (err: Error) => {
        this.downloading.set(false);
        this.toast(toastDoc, err.message || 'No se pudo leer la documentación.');
      }
    });
  }

  private toast(frameDoc: Document | null | undefined, message: string): void {
    const el = frameDoc?.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.setTimeout(() => el.classList.remove('show'), 2200);
  }
}
