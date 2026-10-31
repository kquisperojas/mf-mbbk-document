import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CATALOG_DESCRIPTIONS } from '../../core/hub-data';
import { HubApiService } from '../../core/hub-api.service';
import { CatalogMsRow } from '../../core/models';

@Component({
  selector: 'app-catalogo',
  imports: [RouterLink],
  templateUrl: './catalogo.html'
})
export class CatalogoPage {}

@Component({
  selector: 'app-catalog-table',
  templateUrl: './catalog-table.html'
})
export class CatalogTablePage implements OnInit {
  private readonly hub = inject(HubApiService);
  private readonly route = inject(ActivatedRoute);
  group: 'experiencia' | 'soporte' = 'experiencia';
  title = '';
  lede = '';
  status = signal('');
  warn = signal(false);
  rows = signal<Array<CatalogMsRow & { item: number; displayName: string; description: string; ownerLabel: string; lastMod: string; mail: string; swagger: string }>>([]);

  ngOnInit(): void {
    this.group = this.route.snapshot.data['group'] === 'soporte' ? 'soporte' : 'experiencia';
    this.title = this.group === 'experiencia' ? 'Microservicios de experiencia' : 'Microservicios de soporte canal';
    this.lede =
      this.group === 'experiencia'
        ? 'Prefijos ch-mbbk-* y jch-mbbk-*.'
        : 'Prefijo jsc-mbbk-* (soporte canal). Convención Jarvis jsc-mbbk-*-vN-des.';
    this.hub.catalog().subscribe({
      next: (data) => {
        const list = (this.group === 'experiencia' ? data.experiencia : data.soporteCanal) || [];
        this.warn.set(!list.length);
        this.status.set(
          list.length
            ? `${list.length} microservicios · sync ${data.generatedAt || 'sin fecha'}`
            : data.error || 'Sin filas en este grupo.'
        );
        this.rows.set(list.map((row, index) => this.mapRow(row, index)));
      },
      error: (err: Error) => {
        this.warn.set(true);
        this.status.set(err.message || 'No se pudo cargar el catálogo.');
        this.rows.set([]);
      }
    });
  }

  private mapRow(row: CatalogMsRow, index: number) {
    const slug = String(row.repo || '')
      .toLowerCase()
      .replace(/^(ch|jch|jsc)-mbbk-/, '')
      .replace(/-v\d+$/, '');
    const displayName = this.toTitle(row.nombre, row.repo);
    const description =
      (row.descripcion || '').trim() ||
      CATALOG_DESCRIPTIONS[slug] ||
      (displayName ? `Microservicio ${displayName} del canal MBBK.` : 'Pendiente');
    const blob = [row.canal, row.repo, row.nombre].join(' ').toLowerCase();
    const ownerLabel = /m+bbk/.test(blob) ? 'Canales digitales' : (row.owner || 'Pendiente');
    const lastMod = String(row.ultimaModificacion || row.contactName || '')
      .replace(/^(MBBK|MMBK|MBPB|HBBO)\s*[-–:]\s*/i, '')
      .trim();
    const mail = String(row.correo || row.contactEmail || row.email || '');
    const swagger =
      row.swaggerUrl ||
      (row.repo
        ? `https://github.com/pichincha-peru/${row.repo}/blob/desarrollo/src/main/resources/static/openapi.yaml`
        : '');
    return {
      ...row,
      item: index + 1,
      displayName,
      description,
      ownerLabel,
      lastMod: lastMod.toLowerCase() === 'canales digitales' ? '' : lastMod,
      mail: mail.includes('@') ? mail : '',
      swagger
    };
  }

  private toTitle(value?: string, repo?: string): string {
    let source = String(value || repo || '').trim();
    source = source.replace(/^(ch|jch|jsc)-mbbk-/i, '').replace(/-v\d+$/i, '');
    source = source.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    return source
      .split(/[\s\-_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
