import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HubApiService } from '../../core/hub-api.service';
import { AdminDoc, DocIndexItem } from '../../core/models';

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
  tab = 'iniciativa';
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
    this.hub.docsIndex().subscribe({
      next: (data) => this.items.set(data.items || []),
      error: (err: Error) => (this.error = err.message)
    });
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
        this.tab = this.pendingTab || 'iniciativa';
        this.pendingTab = '';
      },
      error: (err: Error) => (this.error = err.message)
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

  deleteDoc(): void {
    if (!this.key) return;
    if (!confirm(`¿Eliminar la documentación de ${this.key}? Se mueve a _papelera.`)) return;
    const deleted = this.key;
    this.hub.deleteDoc(deleted).subscribe({
      next: () => {
        this.showToast(`${deleted} eliminada de la lista.`);
        this.key = '';
        this.doc.set(null);
        this.items.update((list) => list.filter((i) => i.key !== deleted));
        void this.router.navigateByUrl('/portal/iniciativas');
      },
      error: (err: Error) => (this.error = err.message)
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
