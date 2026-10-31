import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HubApiService } from '../../core/hub-api.service';
import { DocIndexItem, DocLifecycleStatus } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html'
})
export class DashboardPage implements OnInit {
  private readonly hub = inject(HubApiService);
  readonly status = signal('all');
  readonly items = signal<DocIndexItem[]>([]);
  readonly error = signal('');

  readonly filteredInitiatives = computed(() => {
    const status = this.status();
    return this.items().filter((row) => status === 'all' || this.statusOf(row) === status);
  });

  readonly counts = computed(() => {
    const rows = this.items();
    const of = (id: DocLifecycleStatus) => rows.filter((row) => this.statusOf(row) === id).length;
    return {
      total: rows.length,
      borrador: of('borrador'),
      revision: of('revision'),
      publicada: of('publicada'),
      desactualizada: of('desactualizada')
    };
  });

  ngOnInit(): void {
    this.hub.docsIndex().subscribe({
      next: (data) => this.items.set(data.items || []),
      error: (err: Error) => this.error.set(err.message)
    });
  }

  setStatus(status: string): void {
    this.status.set(status);
  }

  routeFor(row: DocIndexItem): string[] {
    if (this.statusOf(row) === 'borrador') {
      return ['/portal/generar'];
    }
    return ['/portal/informe', row.key];
  }

  queryFor(row: DocIndexItem): Record<string, string> | null {
    return this.statusOf(row) === 'borrador' ? { draft: row.key } : null;
  }

  statusOf(row: DocIndexItem): DocLifecycleStatus {
    if (row.status === 'borrador' || row.hasReport === false || row.isDraft) return 'borrador';
    if (row.status === 'publicada' || row.status === 'desactualizada' || row.status === 'revision') {
      return row.status;
    }
    return 'revision';
  }

  missingLabel(row: DocIndexItem): string {
    return row.missing && row.missing.length ? row.missing.join(', ') : '—';
  }

  fmt(iso?: string): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('es-PE');
  }
}
