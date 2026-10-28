import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HubApiService } from '../../core/hub-api.service';
import { DocIndexItem } from '../../core/models';

@Component({
  selector: 'app-iniciativas',
  imports: [RouterLink, FormsModule],
  templateUrl: './iniciativas.html'
})
export class IniciativasPage implements OnInit {
  private readonly hub = inject(HubApiService);
  query = signal('');
  items = signal<DocIndexItem[]>([]);
  error = signal('');
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter(
      (d) => !q || d.key.toLowerCase().includes(q) || (d.title || '').toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.hub.docsIndex().subscribe({
      next: (data) => this.items.set(data.items || []),
      error: (err: Error) => this.error.set(err.message)
    });
  }

  fmt(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
