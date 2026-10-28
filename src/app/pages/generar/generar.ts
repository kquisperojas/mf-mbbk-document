import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HubApiService } from '../../core/hub-api.service';
import { GenerateResult, JiraConfig, JiraInitiative } from '../../core/models';

const KEY_RE = /([A-Z][A-Z0-9_]+-\d+)/i;

@Component({
  selector: 'app-generar',
  imports: [FormsModule],
  templateUrl: './generar.html'
})
export class GenerarPage implements OnInit {
  private readonly hub = inject(HubApiService);
  private readonly router = inject(Router);

  scope = 'assigned';
  query = '';
  link = '';
  figma = '';
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

  ngOnInit(): void {
    this.loadConfig();
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
  }

  onFiles(kind: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files[kind] = Array.from(input.files || []);
  }

  onDrop(kind: string, event: DragEvent): void {
    event.preventDefault();
    this.over[kind] = false;
    const incoming = Array.from(event.dataTransfer?.files || []);
    const multiple = kind === 'sequence' || kind === 'architecture' || kind === 'others';
    this.files[kind] = multiple ? [...this.files[kind], ...incoming] : incoming.slice(0, 1);
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

  generate(): void {
    this.genError = '';
    const problems: string[] = [];
    if (!KEY_RE.test(this.link)) problems.push('Ingresa el link de la iniciativa en Jira.');
    if (!this.files['det'].length) problems.push('Adjunta el documento técnico (DET).');
    if (problems.length) {
      this.genError = 'Faltan datos: ' + problems.join(' ');
      return;
    }
    const form = new FormData();
    form.append('link', this.link);
    if (this.figma) form.append('figma', this.figma);
    this.files['det'].forEach((f) => form.append('det', f));
    this.files['sequence'].forEach((f) => form.append('sequence', f));
    this.files['architecture'].forEach((f) => form.append('architecture', f));
    this.files['tests'].forEach((f) => form.append('tests', f));
    this.files['others'].forEach((f) => form.append('others', f));
    this.submitting = true;
    this.progress = 'Leyendo Jira, analizando el DET y renderizando diagramas…';
    this.hub.generate(form).subscribe({
      next: (result) => {
        this.submitting = false;
        this.progress = '';
        this.result.set(result);
        const next = new Set(this.documented());
        next.add(result.key);
        this.documented.set(next);
        void this.router.navigate(['/portal/informe', result.key]);
      },
      error: (err: Error) => {
        this.submitting = false;
        this.progress = '';
        this.genError = err.message;
      }
    });
  }
}
