import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HubApiService } from '../../core/hub-api.service';
import { DocIndexItem, GenerateResult, JiraConfig, JiraInitiative } from '../../core/models';

const KEY_RE = /([A-Z][A-Z0-9_]+-\d+)/i;

@Component({
  selector: 'app-generar',
  imports: [FormsModule, RouterLink],
  templateUrl: './generar.html'
})
export class GenerarPage implements OnInit, OnDestroy {
  private readonly hub = inject(HubApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  scope = 'assigned';
  query = '';
  link = '';
  figma = '';
  featureBranch = '';
  config = signal<JiraConfig | null>(null);
  items = signal<JiraInitiative[]>([]);
  documented = signal<Set<string>>(new Set());
  jql = '';
  fetchedAt = '';
  listError = '';
  loading = false;
  genError = '';
  progress = '';
  submitting = false;
  result = signal<GenerateResult | null>(null);
  files: Record<string, File[]> = { det: [], sequence: [], architecture: [], tests: [], others: [] };
  over: Record<string, boolean> = {};
  connClass = '';
  connText = 'Conectando…';
  docs = signal<DocIndexItem[]>([]);
  draftStatus = '';
  draftFiles: Record<string, Array<{ name: string; size: number }>> = {};
  savingDraft = false;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadConfig();
    this.loadDocs();
    this.route.queryParamMap.subscribe((params) => {
      const draft = (params.get('draft') || '').toUpperCase();
      if (draft) this.restoreDraft(draft);
    });
  }

  ngOnDestroy(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
  }

  filtered(): JiraInitiative[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((i) =>
      [i.key, i.summary, i.assignee, i.description].some((v) => (v || '').toLowerCase().includes(q))
    );
  }

  initials(name: string): string {
    return (name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?';
  }

  docsCount(): number {
    return this.items().filter((i) => this.documented().has(i.key)).length;
  }

  peopleCount(): number {
    return new Set(this.items().map((i) => i.assignee)).size;
  }

  hint(): { ok: boolean; text: string } {
    const match =
      this.link.match(/selectedIssue=([A-Z][A-Z0-9_]+-\d+)/i) ||
      this.link.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i) ||
      this.link.match(KEY_RE);
    if (match) {
      const key = match[1].toUpperCase();
      const extra = this.documented().has(key) ? ' (ya existe: se respaldará el informe actual)' : '';
      return { ok: true, text: `Iniciativa ${key} → DOCUMENTACION/${key}/informe-${key}.html${extra}` };
    }
    return { ok: false, text: 'Pega el link de Jira (browse o selectedIssue). Se usa la clave para la carpeta.' };
  }

  setScope(scope: string): void {
    this.scope = scope;
    this.jql = this.config()?.jql?.[scope] || this.jql;
    this.loadInitiatives();
  }

  fillLink(url: string): void {
    this.link = url;
    document.getElementById('gen-form')?.scrollIntoView({ behavior: 'smooth' });
    const key = this.currentKey();
    if (key && !this.documented().has(key)) this.restoreDraft(key);
  }

  onFiles(kind: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files[kind] = Array.from(input.files || []);
    this.scheduleDraft();
  }

  onDrop(kind: string, event: DragEvent): void {
    event.preventDefault();
    this.over[kind] = false;
    const incoming = Array.from(event.dataTransfer?.files || []);
    const multiple = kind === 'sequence' || kind === 'architecture' || kind === 'others';
    this.files[kind] = multiple ? [...this.files[kind], ...incoming] : incoming.slice(0, 1);
    this.scheduleDraft();
  }

  onMetaChange(): void {
    this.scheduleDraft();
  }

  docStatus(key: string): DocIndexItem | undefined {
    return this.docs().find((row) => row.key === key);
  }

  loadConfig(): void {
    this.hub.config().subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        if (!cfg.configured) {
          this.connClass = 'error';
          this.connText = 'Sin credenciales Jira';
        } else if (cfg.error) {
          this.connClass = 'error';
          this.connText = 'Error de conexión';
        } else {
          this.connClass = 'ok';
          this.connText = `${cfg.user?.name || 'Jira'} · ${cfg.site ? new URL(cfg.site).host : ''}`;
        }
        this.jql = cfg.jql?.[this.scope] || '';
        this.loadInitiatives();
      },
      error: () => {
        this.connClass = 'error';
        this.connText = 'Servidor no disponible';
      }
    });
  }

  loadInitiatives(): void {
    this.loading = true;
    this.listError = '';
    this.hub.initiatives(this.scope).subscribe({
      next: (data) => {
        this.items.set(data.items || []);
        this.documented.set(new Set(data.documented || []));
        this.jql = data.jql;
        this.fetchedAt = data.fetchedAt
          ? 'Actualizado ' + new Date(data.fetchedAt).toLocaleTimeString('es-PE')
          : '';
        this.loading = false;
      },
      error: (err: Error) => {
        this.items.set([]);
        this.listError = err.message;
        this.loading = false;
      }
    });
  }

  loadDocs(): void {
    this.hub.docsIndex().subscribe({
      next: (data) => this.docs.set(data.items || []),
      error: () => this.docs.set([])
    });
  }

  saveDraft(manual = false): void {
    const key = this.currentKey();
    if (!key || this.documented().has(key) || this.savingDraft || this.submitting) return;
    if (!this.hasDraftPayload()) {
      if (manual) this.draftStatus = 'Adjunta insumos o indica Figma / rama feature para guardar el borrador.';
      return;
    }
    this.savingDraft = true;
    this.draftStatus = 'Guardando borrador…';
    this.hub.saveDraft(this.buildForm()).subscribe({
      next: (saved) => {
        this.savingDraft = false;
        this.draftFiles = saved.files || {};
        this.draftStatus = `Borrador guardado ${new Date(saved.savedAt || Date.now()).toLocaleTimeString('es-PE')}.`;
        this.loadDocs();
      },
      error: (err: Error) => {
        this.savingDraft = false;
        if (/ya tiene documentación/i.test(err.message)) {
          this.draftStatus = '';
          return;
        }
        this.draftStatus = err.message || 'No se pudo guardar el borrador.';
      }
    });
  }

  generate(): void {
    this.genError = '';
    const problems: string[] = [];
    const branch = this.featureBranch.trim();
    if (!KEY_RE.test(this.link)) problems.push('Ingresa el link de la iniciativa en Jira.');
    if (!this.files['det'].length && !this.draftFiles['det']?.length) {
      problems.push('Adjunta el documento técnico (DET).');
    }
    if ((this.files['tests'].length || this.draftFiles['tests']?.length) && !branch) {
      problems.push('Indica el link de la rama feature para contrastar los casos de prueba.');
    }
    if (problems.length) {
      this.genError = 'Faltan datos: ' + problems.join(' ');
      return;
    }
    const form = this.buildForm();
    this.submitting = true;
    this.progress = 'La documentación se está generando y analizando los casos de prueba.';
    this.hub.generate(form).subscribe({
      next: (result) => {
        this.submitting = false;
        this.progress = '';
        this.result.set(result);
        const next = new Set(this.documented());
        next.add(result.key);
        this.documented.set(next);
        this.draftFiles = {};
        this.draftStatus = '';
        void this.router.navigate(['/portal/iniciativas'], { queryParams: { generated: result.key } });
      },
      error: (err: Error) => {
        this.submitting = false;
        this.progress = '';
        this.genError = err.message;
      }
    });
  }

  private currentKey(): string {
    const match =
      this.link.match(/selectedIssue=([A-Z][A-Z0-9_]+-\d+)/i) ||
      this.link.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i) ||
      this.link.match(KEY_RE);
    return match ? match[1].toUpperCase() : '';
  }

  private hasDraftPayload(): boolean {
    return Boolean(
      this.figma.trim() ||
        this.featureBranch.trim() ||
        Object.values(this.files).some((list) => list.length)
    );
  }

  private buildForm(): FormData {
    const form = new FormData();
    form.append('link', this.link);
    if (this.figma) form.append('figma', this.figma);
    if (this.featureBranch.trim()) form.append('featureBranch', this.featureBranch.trim());
    this.files['det'].forEach((f) => form.append('det', f));
    this.files['sequence'].forEach((f) => form.append('sequence', f));
    this.files['architecture'].forEach((f) => form.append('architecture', f));
    this.files['tests'].forEach((f) => form.append('tests', f));
    this.files['others'].forEach((f) => form.append('others', f));
    return form;
  }

  private scheduleDraft(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.saveDraft(false), 1800);
  }

  private restoreDraft(key: string): void {
    this.hub.loadDraft(key).subscribe({
      next: (draft) => {
        this.link = draft.link || this.link || `https://pichinchaperu.atlassian.net/browse/${key}`;
        this.figma = draft.figmaUrl || this.figma;
        this.featureBranch = draft.featureBranch || this.featureBranch;
        this.draftFiles = draft.files || {};
        this.draftStatus = draft.savedAt
          ? `Borrador recuperado (${new Date(draft.savedAt).toLocaleString('es-PE')}). Los archivos quedan en el servidor.`
          : 'Borrador recuperado.';
      },
      error: () => {
        /* sin borrador */
      }
    });
  }
}
