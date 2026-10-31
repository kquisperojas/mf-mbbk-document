import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HubApiService } from '../../core/hub-api.service';
import { AdminDoc, DocIndexItem, DocLifecycleStatus } from '../../core/models';

interface AdminRow {
  method?: string;
  path?: string;
  description?: string;
  name?: string;
  tag?: string;
  context?: string;
  tema?: string;
  det?: string;
  propuesta?: string;
  kind?: string;
  label?: string;
  src?: string;
  id?: string;
  title?: string;
  group?: string;
  result?: string;
  evidence?: string;
}

interface AdminFields {
  title: string;
  subtitle: string;
  objective: string;
  inScope: string;
  outScope: string;
  figmaUrl: string;
  jiraSummary: string;
  jiraAssignee: string;
  jiraStatus: string;
  solutionLead: string;
  rules: string;
  risks: string;
  ownerMs: string;
  pendingDiagrams: string;
}

@Component({
  selector: 'app-administrar',
  imports: [FormsModule],
  templateUrl: './administrar.html'
})
export class AdministrarPage implements OnInit {
  private readonly hub = inject(HubApiService);
  private readonly router = inject(Router);

  items = signal<DocIndexItem[]>([]);
  key = '';
  statusFilter = '';
  query = '';
  readonly statusOptions = [
    { id: '', label: 'Todas' },
    { id: 'borrador', label: 'Borrador' },
    { id: 'revision', label: 'En revisión' },
    { id: 'publicada', label: 'Publicada' },
    { id: 'desactualizada', label: 'Desactualizada' }
  ];
  editorOpen = signal(false);
  deleteOpen = signal(false);
  deleteSubmitting = signal(false);
  pendingDelete = signal<DocIndexItem | null>(null);
  tab = 'iniciativa';
  readonly tabs = [
    { id: 'iniciativa', label: 'Iniciativa' },
    { id: 'solucion', label: 'Solución' },
    { id: 'diagramas', label: 'Diagramas' },
    { id: 'pruebas', label: 'Pruebas' }
  ];
  error = '';
  status = '';
  saving = false;
  toast = '';
  doc = signal<AdminDoc | null>(null);
  model: Record<string, unknown> = {};
  html: Record<string, string> = { iniciativa: '', solucion: '', diagramas: '', pruebas: '' };
  fields: AdminFields = {
    title: '',
    subtitle: '',
    objective: '',
    inScope: '',
    outScope: '',
    figmaUrl: '',
    jiraSummary: '',
    jiraAssignee: '',
    jiraStatus: '',
    solutionLead: '',
    rules: '',
    risks: '',
    ownerMs: '',
    pendingDiagrams: ''
  };
  endpoints: AdminRow[] = [];
  microservices: AdminRow[] = [];
  contrast: AdminRow[] = [];
  diagrams: AdminRow[] = [];
  cases: AdminRow[] = [];
  testFile: File | null = null;
  testFileName = signal('');
  testsUploading = signal(false);
  featureBranch = '';
  private pendingTab = '';

  ngOnInit(): void {
    this.refreshIndex();
  }

  refreshIndex(): void {
    this.hub.docsIndex().subscribe({
      next: (data) => this.items.set(data.items || []),
      error: (err: Error) => (this.error = err.message)
    });
  }

  filteredRows(): DocIndexItem[] {
    const status = this.statusFilter;
    const q = this.query.trim().toLowerCase();
    return this.items().filter((row) => {
      if (status && this.statusOf(row) !== status) return false;
      if (!q) return true;
      const haystack = `${row.key} ${row.title || ''} ${row.subtitle || ''} ${this.statusLabel(row)}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  emptyMessage(): string {
    if (this.query.trim()) return 'No hay coincidencias para esa búsqueda.';
    if (this.statusFilter) return 'No hay iniciativas en este estado.';
    return 'No hay documentación para mostrar.';
  }

  statusOf(row: DocIndexItem): DocLifecycleStatus {
    if (row.status === 'borrador' || row.hasReport === false || row.isDraft) return 'borrador';
    if (row.status === 'publicada' || row.status === 'desactualizada' || row.status === 'revision') {
      return row.status;
    }
    return 'revision';
  }

  statusLabel(row: DocIndexItem): string {
    if (row.statusLabel) return row.statusLabel;
    const status = this.statusOf(row);
    if (status === 'publicada') return 'Publicada';
    if (status === 'desactualizada') return 'Desactualizada';
    if (status === 'borrador') return 'Borrador';
    return 'En revisión';
  }

  fmt(iso?: string): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('es-PE');
  }

  edit(row: DocIndexItem): void {
    this.error = '';
    if (this.statusOf(row) === 'borrador') {
      void this.router.navigate(['/portal/generar'], { queryParams: { draft: row.key } });
      return;
    }
    this.key = row.key;
    this.tab = 'iniciativa';
    this.editorOpen.set(true);
    this.load();
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.doc.set(null);
    this.key = '';
    this.error = '';
  }

  onOverlayClick(event: Event, kind: 'edit' | 'delete'): void {
    if (event.target !== event.currentTarget) return;
    if (kind === 'edit') this.closeEditor();
    else this.closeDelete();
  }

  askDelete(row?: DocIndexItem): void {
    const target = row || this.items().find((item) => item.key === this.key) || null;
    if (!target && !this.key) return;
    this.pendingDelete.set(
      target || ({ key: this.key, title: this.key, status: this.statusFilter } as DocIndexItem)
    );
    this.deleteOpen.set(true);
  }

  closeDelete(): void {
    if (this.deleteSubmitting()) return;
    this.deleteOpen.set(false);
    this.pendingDelete.set(null);
  }

  load(): void {
    this.error = '';
    if (!this.key) {
      this.doc.set(null);
      return;
    }
    this.hub.doc(this.key).subscribe({
      next: (doc) => {
        this.doc.set(doc);
        this.status = doc.structured
          ? `Modelo estructurado · última actualización ${new Date(doc.updated).toLocaleString('es-PE')}`
          : 'Informe HTML (sin modelo). Edición por sección.';
        if (doc.structured) this.fillModel(doc.model || {});
        else this.html = { iniciativa: '', solucion: '', diagramas: '', pruebas: '', ...(doc.sectionsHtml || {}) };
        this.tab = this.pendingTab || this.tab || 'iniciativa';
        this.pendingTab = '';
      },
      error: (err: Error) => {
        this.error = err.message;
        this.editorOpen.set(false);
      }
    });
  }

  private lines(text: string): string[] {
    return String(text || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private fillModel(model: Record<string, unknown>): void {
    this.model = model;
    const analysis = (model['analysis'] || {}) as Record<string, unknown>;
    const jira = (model['jira'] || {}) as Record<string, string>;
    this.fields = {
      title: String(model['title'] || ''),
      subtitle: String(model['subtitle'] || ''),
      objective: String(analysis['objective'] || ''),
      inScope: ((analysis['inScope'] as string[]) || []).join('\n'),
      outScope: ((analysis['outScope'] as string[]) || []).join('\n'),
      figmaUrl: String(model['figmaUrl'] || ''),
      jiraSummary: jira['summary'] || '',
      jiraAssignee: jira['assignee'] || '',
      jiraStatus: jira['status'] || '',
      solutionLead: String(model['solutionLead'] || ''),
      rules: ((analysis['rules'] as string[]) || []).join('\n'),
      risks: ((analysis['risks'] as string[]) || []).join('\n'),
      ownerMs: String(model['ownerMs'] || ''),
      pendingDiagrams: ((model['pendingDiagrams'] as string[]) || []).join('\n')
    };
    this.endpoints = ((analysis['endpoints'] as AdminRow[]) || []).map((e) => ({ ...e }));
    this.microservices = ((analysis['microservices'] as AdminRow[]) || []).map((e) => ({ ...e }));
    this.contrast = ((model['contrast'] as AdminRow[]) || []).map((e) => ({ ...e }));
    this.diagrams = ((model['diagrams'] as AdminRow[]) || []).map((e) => ({ ...e }));
    this.cases = ((model['cases'] as AdminRow[]) || []).map((e) => ({ ...e }));
    this.featureBranch = String(model['featureBranchUrl'] || '');
  }

  add(kind: string): void {
    const empty: Record<string, AdminRow[]> = {
      endpoints: this.endpoints,
      microservices: this.microservices,
      contrast: this.contrast,
      diagrams: this.diagrams,
      cases: this.cases
    };
    empty[kind]?.push({});
  }

  remove(list: AdminRow[], index: number): void {
    list.splice(index, 1);
  }

  previewUrl(): string {
    const doc = this.doc();
    return doc ? this.hub.resolveDocUrl(doc.url, doc.key) : '#';
  }

  onTestsFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.testFile = input.files?.[0] || null;
    this.testFileName.set(this.testFile ? this.testFile.name : '');
    this.error = '';
  }

  uploadTests(): void {
    if (!this.key || !this.testFile) return;
    const branch = this.featureBranch.trim();
    if (!branch) {
      this.error = 'Indica el link de la rama feature de la solución.';
      return;
    }
    this.testsUploading.set(true);
    this.error = '';
    this.hub.uploadTests(this.key, this.testFile, branch).subscribe({
      next: (result) => {
        this.testsUploading.set(false);
        const summary = result.summary as { cumple?: number; total?: number } | undefined;
        this.showToast(
          summary
            ? `${result.cases} casos validados contra la rama: ${summary.cumple || 0} cumplen de ${summary.total || result.cases}.`
            : `${result.cases} casos cargados. Sección Pruebas regenerada.`
        );
        this.pendingTab = 'pruebas';
        this.load();
      },
      error: (err: Error) => {
        this.testsUploading.set(false);
        this.error = err.message;
      }
    });
  }

  save(): void {
    const current = this.doc();
    if (!current || !this.key) return;
    this.saving = true;
    this.error = '';
    const payload = current.structured
      ? { mode: 'model', model: this.readModel() }
      : { mode: 'html', sectionsHtml: this.html };
    this.hub.saveDoc(this.key, payload).subscribe({
      next: () => {
        this.saving = false;
        this.showToast('Guardado. Informe actualizado.');
        this.load();
      },
      error: (err: Error) => {
        this.saving = false;
        this.error = err.message;
      }
    });
  }

  confirmDelete(): void {
    const target = this.pendingDelete();
    const deleted = target?.key;
    if (!deleted || this.deleteSubmitting()) return;
    const draft = target ? this.statusOf(target) === 'borrador' : false;
    this.deleteSubmitting.set(true);
    this.error = '';
    const request = draft ? this.hub.deleteDraft(deleted) : this.hub.deleteDoc(deleted);
    request.subscribe({
      next: () => {
        this.deleteSubmitting.set(false);
        this.deleteOpen.set(false);
        this.pendingDelete.set(null);
        this.showToast(`${deleted} eliminada de la lista.`);
        if (this.key === deleted) this.closeEditor();
        this.items.update((list) => list.filter((i) => i.key !== deleted));
      },
      error: (err: Error) => {
        this.deleteSubmitting.set(false);
        this.error = err.message;
      }
    });
  }

  private readModel(): Record<string, unknown> {
    const analysis = {
      ...((this.model['analysis'] as object) || {}),
      objective: this.fields.objective,
      inScope: this.lines(this.fields.inScope),
      outScope: this.lines(this.fields.outScope),
      rules: this.lines(this.fields.rules),
      risks: this.lines(this.fields.risks),
      endpoints: this.endpoints,
      microservices: this.microservices
    };
    const jira = {
      ...((this.model['jira'] as object) || {}),
      summary: this.fields.jiraSummary,
      assignee: this.fields.jiraAssignee,
      status: this.fields.jiraStatus
    };
    return {
      ...this.model,
      title: this.fields.title,
      subtitle: this.fields.subtitle,
      figmaUrl: this.fields.figmaUrl,
      solutionLead: this.fields.solutionLead,
      ownerMs: this.fields.ownerMs,
      analysis,
      jira,
      contrast: this.contrast,
      diagrams: this.diagrams,
      pendingDiagrams: this.lines(this.fields.pendingDiagrams),
      cases: this.cases
    };
  }

  private showToast(message: string): void {
    this.toast = message;
    setTimeout(() => {
      if (this.toast === message) this.toast = '';
    }, 2800);
  }
}
