import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HubApiService } from '../../core/hub-api.service';
import { AdminDoc, DocIndexItem } from '../../core/models';

interface MsCite {
  key: string;
  title: string;
  tag: string;
  tagClass: string;
}

interface MsRow {
  name: string;
  blurb: string;
  tag: string;
  tagClass: string;
  route?: string;
  initiatives: MsCite[];
  search: string;
}

interface AnalysisMs {
  name?: string;
  tag?: string;
  context?: string;
}

const TAG_RANK: Record<string, number> = {
  Nuevo: 4,
  Modificado: 3,
  Core: 2,
  Reutilizado: 1,
  Citado: 0
};

@Component({
  selector: 'app-ficha-ms',
  imports: [FormsModule, RouterLink],
  templateUrl: './ficha-ms.html'
})
export class FichaMsPage implements OnInit {
  private readonly hub = inject(HubApiService);

  query = signal('');
  loading = signal(true);
  error = signal('');
  rows = signal<MsRow[]>([]);

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.rows();
    if (!q) return list;
    return list.filter((row) => row.search.includes(q));
  });

  ngOnInit(): void {
    this.hub.docsIndex().subscribe({
      next: (data) => {
        const items = data.items || [];
        if (!items.length) {
          this.loading.set(false);
          return;
        }
        forkJoin(items.map((item) => this.hub.doc(item.key).pipe(catchError(() => of(null))))).subscribe({
          next: (docs) => {
            this.rows.set(this.merge(items, docs));
            this.loading.set(false);
          },
          error: () => {
            this.error.set('No se pudieron leer las fichas de las iniciativas.');
            this.loading.set(false);
          }
        });
      },
      error: (err: Error) => {
        this.error.set(err.message || 'No se pudo cargar la documentación generada.');
        this.loading.set(false);
      }
    });
  }

  private merge(items: DocIndexItem[], docs: Array<AdminDoc | null>): MsRow[] {
    const byName = new Map<string, MsRow>();
    docs.forEach((doc, index) => {
      if (!doc) return;
      const key = doc.key || items[index]?.key;
      if (!key) return;
      const title = doc.title || items[index]?.title || key;
      const analysis = (doc.model?.['analysis'] as { microservices?: AnalysisMs[] } | undefined) || {};
      const fromModel = analysis.microservices || [];
      const fromHtml = this.parseHtmlCards(Object.values(doc.sectionsHtml || {}).join('\n'));
      const owner = String(doc.model?.['ownerMs'] || '').trim();
      const entries = [
        ...fromModel,
        ...fromHtml,
        ...(owner ? [{ name: owner, tag: 'Modificado', context: `Microservicio responsable de ${key}.` }] : [])
      ];
      for (const ms of entries) {
        const name = String(ms.name || '').trim();
        if (!this.looksLikeMs(name)) continue;
        const tag = this.normalizeTag(ms.tag);
        const cite: MsCite = { key, title, tag, tagClass: this.tagClass(tag) };
        const blurb = this.stripHtml(ms.context || '').trim() || `Citado en la documentación de ${key}.`;
        this.upsert(byName, name, blurb, cite);
      }
    });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private upsert(byName: Map<string, MsRow>, name: string, blurb: string, cite: MsCite): void {
    const matchId = this.findExisting(byName, name);
    if (matchId) {
      const current = byName.get(matchId)!;
      if (name.length > current.name.length) {
        byName.delete(matchId);
        current.name = name;
        current.route = this.routeFor(name);
        byName.set(name.toLowerCase(), current);
      }
      if (blurb.length > current.blurb.length) current.blurb = blurb;
      if (!current.initiatives.some((row) => row.key === cite.key)) {
        current.initiatives.push(cite);
      }
      this.refreshRow(current);
      return;
    }
    const row: MsRow = {
      name,
      blurb,
      tag: cite.tag,
      tagClass: cite.tagClass,
      route: this.routeFor(name),
      initiatives: [cite],
      search: ''
    };
    this.refreshRow(row);
    byName.set(name.toLowerCase(), row);
  }

  private findExisting(byName: Map<string, MsRow>, name: string): string | undefined {
    const id = name.toLowerCase();
    if (byName.has(id)) return id;
    for (const existing of byName.keys()) {
      if (existing.length < 12 || id.length < 12) continue;
      if (existing.endsWith(id) || id.endsWith(existing)) return existing;
    }
    return undefined;
  }

  private parseHtmlCards(html: string): AnalysisMs[] {
    if (!html) return [];
    const re = /<span class="tag[^"]*">([\s\S]*?)<\/span>\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
    const out: AnalysisMs[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(html))) {
      out.push({
        tag: this.stripHtml(match[1]),
        name: this.stripHtml(match[2]),
        context: this.stripHtml(match[3])
      });
    }
    return out;
  }

  private looksLikeMs(name: string): boolean {
    const value = name.trim();
    if (value.length < 4) return false;
    if (/[·|/]/.test(value)) return false;
    if (/hazelcast|^as400|session|sesi[oó]n/i.test(value)) return false;
    return /[-_]/.test(value);
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private refreshRow(row: MsRow): void {
    const primary = row.initiatives.reduce((best, cite) => {
      const rank = TAG_RANK[cite.tag] ?? 0;
      const bestRank = TAG_RANK[best] ?? 0;
      return rank > bestRank ? cite.tag : best;
    }, row.initiatives[0]?.tag || 'Citado');
    const uniqueTags = new Set(row.initiatives.map((cite) => cite.tag));
    row.tag = uniqueTags.size > 1 ? 'Varios usos' : primary;
    row.tagClass = uniqueTags.size > 1 ? 'review' : this.tagClass(primary);
    row.search = [row.name, row.tag, ...row.initiatives.flatMap((item) => [item.key, item.title, item.tag])]
      .join(' ')
      .toLowerCase();
  }

  private normalizeTag(tag?: string): string {
    const value = String(tag || '').trim();
    if (/nuev/i.test(value)) return 'Nuevo';
    if (/modific/i.test(value)) return 'Modificado';
    if (/reutil/i.test(value) || /reuse/i.test(value)) return 'Reutilizado';
    if (/core/i.test(value)) return 'Core';
    return value || 'Citado';
  }

  private tagClass(tag: string): string {
    if (tag === 'Nuevo') return 'new';
    if (tag === 'Modificado') return 'mod';
    if (tag === 'Reutilizado') return 'reuse';
    if (tag === 'Core') return 'draft';
    return 'review';
  }

  private routeFor(name: string): string | undefined {
    if (name.toLowerCase().includes('customer-agreement')) return '/portal/ms-agreement';
    return undefined;
  }
}
