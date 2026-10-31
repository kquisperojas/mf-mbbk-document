import { AdminDoc, DocReview, TeamMemberDto, UserDto } from './models';

const BLUE = '0F265C';
const MUTED = '484848';
const HEADER_BG = '0F265C';
const HEADER_FG = 'FFFFFF';

type Dict = Record<string, unknown>;

function asDict(value: unknown): Dict {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
}

function asList(value: unknown): Dict[] {
  return Array.isArray(value) ? (value as Dict[]) : [];
}

export type WordContext = {
  displayName?: string;
  role?: string;
  squad?: string;
  review?: DocReview | null;
  jira?: unknown;
  team?: TeamMemberDto[];
  users?: UserDto[];
};

function isLeadRole(rol: string): boolean {
  return /tech\s*lead|l[ií]der\s*t[eé]cnico/i.test(rol || '');
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function pickTechLead(ctx: WordContext = {}): { name: string; email: string; role: string } {
  const named = String(ctx.review?.publishedBy || '').trim();
  const memberByName = named ? (ctx.team || []).find((row) => sameName(row.nombre, named)) : undefined;
  const userByName = named ? (ctx.users || []).find((row) => sameName(row.nombre, named)) : undefined;
  if (named) {
    return {
      name: named,
      email: memberByName?.correo || userByName?.email || '',
      role: ctx.review?.approvedByRole || memberByName?.rol || userByName?.rol || 'Tech Lead'
    };
  }
  const member = (ctx.team || []).find((row) => isLeadRole(row.rol));
  if (member) return { name: member.nombre, email: member.correo || '', role: member.rol };
  const user = (ctx.users || []).find((row) => isLeadRole(row.rol));
  if (user) return { name: user.nombre, email: user.email || '', role: user.rol };
  return { name: '', email: '', role: 'Tech Lead' };
}

function jiraSummary(jira: Dict, analysis: Dict, title: string): string {
  const fromJira = String(jira['summary'] || '').trim();
  if (fromJira) return fromJira;
  const objective = String(analysis['objective'] || '').trim();
  if (objective && !/^pendiente$/i.test(objective)) return objective;
  const scope = lines(analysis['inScope'])[0] || '';
  if (scope) return scope;
  return String(title || '').trim();
}

function mergeJira(model: Dict, fetched?: unknown): Dict {
  const stored = asDict(model['jira']);
  const live = asDict(fetched);
  const merged: Dict = { ...stored };
  for (const [key, value] of Object.entries(live)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') merged[key] = value;
  }
  if (!merged['key']) merged['key'] = model['key'];
  if (!merged['url']) merged['url'] = model['jiraUrl'] || live['url'];
  return merged;
}

function text(value: unknown, fallback = '—'): string {
  const raw = String(value ?? '').trim();
  return raw || fallback;
}

function lines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function htmlToLines(html: string): string[] {
  const normalized = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|li|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return normalized
    .split(/\n+/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item && item !== '•');
}

function fmtDate(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function xml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type DiagramImage = {
  title: string;
  kind: string;
  caption: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  ext: 'png' | 'jpeg';
};

type PackedImage = DiagramImage & { relId: string; fileName: string; cx: number; cy: number; docPrId: number };

const IMAGE_NAME = /\.(png|jpe?g|gif|webp)$/i;
const EMU_PER_PX = 9525;
const MAX_CX = 5486400;
const MAX_CY = 7315200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function docsUrl(key: string, relative: string): string {
  const clean = String(relative || '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
  const parts = clean.split('/').filter(Boolean).map((part) => {
    try {
      return encodeURIComponent(decodeURIComponent(part));
    } catch {
      return encodeURIComponent(part);
    }
  });
  return `/docs/${encodeURIComponent(key)}/${parts.join('/')}`;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + Math.max(len, 2);
  }
  return null;
}

function emuSize(width: number, height: number): { cx: number; cy: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let cx = Math.round(w * EMU_PER_PX);
  let cy = Math.round(h * EMU_PER_PX);
  const scale = Math.min(1, MAX_CX / cx, MAX_CY / cy);
  cx = Math.max(914400, Math.round(cx * scale));
  cy = Math.max(914400, Math.round(cy * scale));
  return { cx, cy };
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function rasterFromBytes(bytes: Uint8Array, extHint = ''): Omit<DiagramImage, 'title' | 'kind' | 'caption'> | null {
  const png = pngSize(bytes);
  if (png) return { bytes, width: png.width, height: png.height, ext: 'png' };
  const jpeg = jpegSize(bytes);
  if (jpeg) return { bytes, width: jpeg.width, height: jpeg.height, ext: 'jpeg' };
  if (/jpe?g/i.test(extHint)) return { bytes, width: 1600, height: 900, ext: 'jpeg' };
  if (bytes.length > 32) return { bytes, width: 1600, height: 900, ext: 'png' };
  return null;
}

async function fetchRaster(url: string): Promise<Omit<DiagramImage, 'title' | 'kind' | 'caption'> | null> {
  const bytes = await fetchBytes(url);
  if (!bytes) return null;
  return rasterFromBytes(bytes, url);
}

type ArchifyWindow = Window & {
  HTMLAnchorElement: typeof HTMLAnchorElement;
  Archify?: { exportMenu?: { run: (format: string) => Promise<unknown> } };
};

function interceptNextDownload(win: ArchifyWindow): Promise<Blob> {
  const proto = win.HTMLAnchorElement.prototype;
  const original = proto.click;
  return new Promise((resolve, reject) => {
    const timer = win.setTimeout(() => {
      proto.click = original;
      reject(new Error('timeout'));
    }, 20000);
    proto.click = function clickOverride(this: HTMLAnchorElement) {
      const href = this.href;
      proto.click = original;
      win.clearTimeout(timer);
      if (!href) {
        reject(new Error('sin archivo'));
        return;
      }
      fetch(href)
        .then((res) => res.blob())
        .then(resolve)
        .catch(reject);
    };
  });
}

async function captureArchifyPng(url: string): Promise<Omit<DiagramImage, 'title' | 'kind' | 'caption'> | null> {
  if (typeof document === 'undefined') return null;
  const iframe = document.createElement('iframe');
  iframe.title = 'Archify export';
  iframe.style.cssText = 'position:fixed;left:-14000px;top:0;width:1400px;height:900px;border:0;opacity:0;pointer-events:none;';
  const target = url.includes('?') ? `${url}&theme=light&embed=1` : `${url}?theme=light&embed=1`;
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('load timeout')), 15000);
      iframe.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      iframe.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('load error'));
      };
      iframe.src = target;
    });
    const win = iframe.contentWindow as ArchifyWindow | null;
    if (!win) return null;
    const start = Date.now();
    let exporter: { run: (format: string) => Promise<unknown> } | null = null;
    while (Date.now() - start < 12000) {
      if (win.Archify?.exportMenu?.run) {
        exporter = win.Archify.exportMenu;
        break;
      }
      await sleep(120);
    }
    if (!exporter) return null;
    try {
      win.document.documentElement.setAttribute('data-theme', 'light');
    } catch {
      /* theme is optional */
    }
    const pending = interceptNextDownload(win);
    await exporter.run('png');
    const blob = await pending;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return rasterFromBytes(bytes, 'png');
  } catch {
    return null;
  } finally {
    iframe.remove();
  }
}

function imageSrcFromHtml(html: string, pageUrl: string): string | null {
  const match = html.match(/<img[^>]+id="img"[^>]*src="([^"]+)"/i) || html.match(/<img[^>]+src="([^"]+)"/i);
  if (!match) return null;
  try {
    return new URL(match[1], pageUrl).href;
  } catch {
    return match[1];
  }
}

async function captureDiagramVisual(key: string, src: string): Promise<Omit<DiagramImage, 'title' | 'kind' | 'caption'> | null> {
  const url = docsUrl(key, src);
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return captureArchifyPng(url);
  const html = await res.text();
  if (/name="generator"\s+content="archify/i.test(html) || /class="diagram-container"/i.test(html)) {
    return captureArchifyPng(url);
  }
  const imgUrl = imageSrcFromHtml(html, new URL(url, location.origin).href);
  if (imgUrl) return fetchRaster(imgUrl);
  return null;
}

function sameVisual(left: string, right: string): boolean {
  const norm = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  const a = norm(left);
  const b = norm(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

export async function collectDiagramImages(doc: AdminDoc): Promise<DiagramImage[]> {
  const model = asDict(doc.model);
  const diagrams = asList(model['diagrams']);
  const attachments = asList(model['attachments']).filter((row) => {
    const group = String(row['group'] || '');
    return (group === 'sequence' || group === 'architecture') && IMAGE_NAME.test(String(row['name'] || row['href'] || ''));
  });
  const images: DiagramImage[] = [];
  const used = new Set<string>();

  for (const diagram of diagrams) {
    const src = String(diagram['src'] || '');
    const title = text(diagram['label'] || diagram['kind'] || 'Diagrama');
    const kind = text(diagram['kind'], 'Diagrama');
    const caption = text(diagram['description'], '');
    let raster = src ? await captureDiagramVisual(doc.key, src) : null;
    if (!raster) {
      const match = attachments.find((row) => sameVisual(String(row['name'] || ''), `${title} ${src}`));
      if (match) raster = await fetchRaster(docsUrl(doc.key, String(match['href'] || `artefactos/${match['name']}`)));
    }
    if (!raster) continue;
    images.push({ title, kind, caption, ...raster });
    used.add(src);
    used.add(title);
  }

  for (const attachment of attachments) {
    const name = String(attachment['name'] || '');
    const href = String(attachment['href'] || `artefactos/${name}`);
    if ([...used].some((item) => sameVisual(item, name) || sameVisual(item, href))) continue;
    const raster = await fetchRaster(docsUrl(doc.key, href));
    if (!raster) continue;
    images.push({
      title: name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
      kind: String(attachment['group'] || '') === 'sequence' ? 'Secuencia' : 'Arquitectura',
      caption: `Imagen adjunta: ${name}`,
      ...raster
    });
  }
  return images;
}

function imageDrawing(image: PackedImage): string {
  return `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="80"/></w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0">
          <wp:extent cx="${image.cx}" cy="${image.cy}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="${image.docPrId}" name="${xml(image.title)}"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
          </wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${image.docPrId}" name="${xml(image.fileName)}"/>
                  <pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${image.relId}"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${image.cx}" cy="${image.cy}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>`;
}

function run(content: string, extra = ''): string {
  return `<w:r><w:rPr>${extra}<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${xml(content)}</w:t></w:r>`;
}

function paragraph(content: string, opts: { bold?: boolean; center?: boolean; color?: string; size?: number; style?: string } = {}): string {
  const rPr = [
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>',
    opts.bold ? '<w:b/>' : '',
    `<w:color w:val="${opts.color || '222222'}"/>`,
    `<w:sz w:val="${opts.size || 22}"/>`,
    `<w:szCs w:val="${opts.size || 22}"/>`
  ].join('');
  const pPr = [
    opts.style ? `<w:pStyle w:val="${opts.style}"/>` : '',
    opts.center ? '<w:jc w:val="center"/>' : '',
    '<w:spacing w:after="160"/>'
  ].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xml(content)}</w:t></w:r></w:p>`;
}

function heading(title: string, level: 1 | 2 | 3): string {
  return paragraph(title, { bold: true, color: BLUE, size: level === 1 ? 32 : 26, style: `Heading${level}` });
}

function bullets(items: string[], empty = 'Sin información registrada.'): string {
  if (!items.length) return paragraph(empty, { color: MUTED });
  return items
    .map(
      (item) =>
        `<w:p><w:pPr><w:pStyle w:val="ListBullet"/><w:spacing w:after="80"/></w:pPr>${run(item)}</w:p>`
    )
    .join('');
}

function pageBreak(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function cellXml(value: string, opts: { header?: boolean; width: number }): string {
  const fill = opts.header ? `<w:shd w:val="clear" w:fill="${HEADER_BG}"/>` : '';
  const color = opts.header ? HEADER_FG : '222222';
  const bold = opts.header ? '<w:b/>' : '';
  return `<w:tc>
    <w:tcPr><w:tcW w:w="${opts.width}" w:type="dxa"/>${fill}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>
    <w:p><w:r><w:rPr>${bold}<w:color w:val="${color}"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xml(value || '—')}</w:t></w:r></w:p>
  </w:tc>`;
}

function tableXml(headers: string[] | null, rows: string[][], widths: number[]): string {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  const head = headers
    ? `<w:tr>${headers.map((h, i) => cellXml(h, { header: true, width: widths[i] })).join('')}</w:tr>`
    : '';
  const body = rows
    .map((row) => `<w:tr>${row.map((value, i) => cellXml(value, { width: widths[i] })).join('')}</w:tr>`)
    .join('');
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9360" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="DBDBDC"/>
        <w:left w:val="single" w:sz="4" w:color="DBDBDC"/>
        <w:bottom w:val="single" w:sz="4" w:color="DBDBDC"/>
        <w:right w:val="single" w:sz="4" w:color="DBDBDC"/>
        <w:insideH w:val="single" w:sz="4" w:color="DBDBDC"/>
        <w:insideV w:val="single" w:sz="4" w:color="DBDBDC"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${grid}</w:tblGrid>
    ${head}${body}
  </w:tbl>
  <w:p/>`;
}

function kvTable(rows: Array<[string, string]>): string {
  return tableXml(null, rows, [2800, 6560]);
}

function dataTable(headers: string[], rows: string[][]): string {
  if (!rows.length) return paragraph('Sin registros.', { color: MUTED });
  const width = Math.floor(9360 / headers.length);
  return tableXml(headers, rows, headers.map(() => width));
}

function tocBlock(): string {
  return `${heading('Índice', 1)}
    <w:sdt>
      <w:sdtPr><w:docPartObj><w:docPartGallery w:val="Table of Contents"/><w:docPartUnique/></w:docPartObj></w:sdtPr>
      <w:sdtContent>
        <w:p>
          <w:r><w:fldChar w:fldCharType="begin"/></w:r>
          <w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>
          <w:r><w:fldChar w:fldCharType="separate"/></w:r>
          <w:r><w:t>Abre el archivo en Microsoft Word para generar el índice (puede pedir actualizar campos).</w:t></w:r>
          <w:r><w:fldChar w:fldCharType="end"/></w:r>
        </w:p>
      </w:sdtContent>
    </w:sdt>`;
}

function reviewStatus(model: Dict, cases: Dict[]): string {
  const jiraStatus = text(asDict(model['jira'])['status'], '');
  if (!cases.length) return 'En revisión (pruebas pendientes)';
  if (cases.some((row) => /no cumple/i.test(text(row['result'], '')))) return 'En revisión (casos no cumplidos)';
  if (cases.some((row) => /pendiente|parcial/i.test(text(row['result'], '')))) return 'En revisión';
  if (/solucionado|done|cerrado/i.test(jiraStatus)) return 'Lista para aprobación del Tech Lead';
  return 'En revisión';
}

function htmlSection(title: string, html: string): string {
  const body = htmlToLines(html);
  return heading(title, 1) + (body.length ? body.map((line) => paragraph(line)).join('') : paragraph('Sin contenido en esta sección.', { color: MUTED }));
}

function structuredBody(doc: AdminDoc, images: PackedImage[] = []): string {
  const model = asDict(doc.model);
  const analysis = asDict(model['analysis']);
  const jira = asDict(model['jira']);
  const endpoints = asList(analysis['endpoints']);
  const microservices = asList(analysis['microservices']);
  const contrast = asList(model['contrast']);
  const diagrams = asList(model['diagrams']);
  const cases = asList(model['cases']);
  const children = asList(jira['children']);
  const attachments = asList(model['attachments']);
  const chunks: string[] = [];

  chunks.push(heading('1. Iniciativa', 1));
  chunks.push(paragraph('Alcance, objetivo y artefactos de la iniciativa según Jira, DET y entregables.'));
  chunks.push(heading('1.1 Objetivo', 2));
  chunks.push(paragraph(text(analysis['objective'] || jira['summary'] || doc.title)));
  chunks.push(heading('1.2 Épica en Jira', 2));
  const summary = jiraSummary(jira, analysis, doc.title);
  const issueType = String(jira['issueType'] || jira['issuetype'] || '').trim() || 'Epic';
  chunks.push(
    kvTable([
      ['Clave', text(jira['key'] || doc.key)],
      ['Resumen', text(summary)],
      ['Responsable', text(jira['assignee'] || jira['assigneeEmail'] || jira['reporter'])],
      ['Estado', text(jira['status'])],
      ['Tipo', text(issueType)],
      ['Creada', fmtDate(String(jira['created'] || ''))],
      ['Resuelta', fmtDate(String(jira['resolutionDate'] || jira['resolutiondate'] || ''))],
      ['URL', text(model['jiraUrl'] || jira['url'])]
    ])
  );
  chunks.push(heading('1.3 En alcance', 2));
  chunks.push(bullets(lines(analysis['inScope'])));
  chunks.push(heading('1.4 Fuera de alcance', 2));
  chunks.push(bullets(lines(analysis['outScope'])));
  chunks.push(heading('1.5 Endpoints solicitados', 2));
  chunks.push(
    dataTable(
      ['Método', 'Path', 'Descripción'],
      endpoints.map((row) => [text(row['method']), text(row['path']), text(row['description'])])
    )
  );
  chunks.push(heading('1.6 Microservicios previstos', 2));
  chunks.push(
    dataTable(
      ['Microservicio', 'Clasificación', 'Contexto'],
      microservices.map((row) => [text(row['name']), text(row['tag']), text(row['context'])])
    )
  );
  if (children.length) {
    chunks.push(heading('1.7 Historias de la épica', 2));
    chunks.push(
      dataTable(
        ['Clave', 'Resumen', 'Responsable', 'Estado'],
        children.map((row) => [text(row['key']), text(row['summary']), text(row['assignee']), text(row['status'])])
      )
    );
  }
  chunks.push(heading('1.8 Artefactos de referencia', 2));
  chunks.push(
    bullets(
      [
        model['jiraUrl'] ? `Jira: ${text(model['jiraUrl'])}` : '',
        model['figmaUrl'] ? `Figma: ${text(model['figmaUrl'])}` : 'Figma: no entregado',
        ...attachments.map((row) => `${text(row['groupLabel'] || row['group'])}: ${text(row['name'])}`)
      ].filter(Boolean)
    )
  );

  chunks.push(heading('2. Solución', 1));
  chunks.push(paragraph('Propuesta de solución, contraste con el DET, reglas y riesgos.'));
  chunks.push(heading('2.1 Propuesta', 2));
  chunks.push(
    paragraph(text(model['solutionLead'], 'Borrador generado por el portal. Validar con el equipo antes de tomarlo como definitivo.'))
  );
  chunks.push(heading('2.2 Microservicio responsable', 2));
  chunks.push(paragraph(text(model['ownerMs'] || microservices[0]?.['name'])));
  chunks.push(heading('2.3 Endpoints propuestos', 2));
  chunks.push(
    dataTable(
      ['Método', 'Path', 'Microservicio responsable'],
      endpoints.map((row) => [text(row['method']), text(row['path']), text(model['ownerMs'] || microservices[0]?.['name'])])
    )
  );
  chunks.push(heading('2.4 Contraste DET vs propuesta', 2));
  chunks.push(
    dataTable(
      ['Tema', 'DET / arquitectura', 'Propuesta'],
      contrast.map((row) => [text(row['tema']), text(row['det']), text(row['propuesta'])])
    )
  );
  chunks.push(heading('2.5 Reglas de negocio', 2));
  chunks.push(bullets(lines(analysis['rules'])));
  chunks.push(heading('2.6 Riesgos y dependencias', 2));
  chunks.push(bullets(lines(analysis['risks'])));

  chunks.push(heading('3. Diagramas', 1));
  chunks.push(paragraph('Arquitectura y secuencias documentadas. Las imágenes incrustadas son las adjuntas o el render Archify publicado en el portal.'));
  chunks.push(heading('3.1 Microservicios y componentes', 2));
  chunks.push(
    dataTable(
      ['Microservicio', 'Qué hace', 'Uso en la iniciativa'],
      microservices.map((row) => [text(row['name']), text(row['context'], 'Mencionado en el DET.'), `Participa en el flujo de ${doc.key}.`])
    )
  );
  chunks.push(heading('3.2 Imágenes de los diagramas', 2));
  if (images.length) {
    images.forEach((image) => {
      chunks.push(heading(`${image.kind}: ${image.title}`, 3));
      chunks.push(imageDrawing(image));
      if (image.caption) chunks.push(paragraph(image.caption, { color: MUTED, size: 18 }));
    });
  } else if (diagrams.length) {
    chunks.push(paragraph('No se pudieron incrustar las imágenes. Quedan referenciadas abajo.'));
    chunks.push(
      dataTable(
        ['Tipo', 'Nombre', 'Descripción', 'Archivo'],
        diagrams.map((row) => [text(row['kind']), text(row['label']), text(row['description']), text(row['src'])])
      )
    );
  } else {
    chunks.push(paragraph('No hay diagramas publicados.', { color: MUTED }));
  }
  chunks.push(heading('3.3 Pendientes de diagrama', 2));
  chunks.push(bullets(lines(model['pendingDiagrams']), 'No hay diagramas pendientes.'));

  chunks.push(heading('4. Pruebas', 1));
  if (!cases.length) {
    chunks.push(paragraph('Escenarios de prueba no entregados. La sección queda pendiente hasta cargar el catálogo de casos.', { color: MUTED }));
  } else {
    const total = cases.length;
    const ok = cases.filter((row) => /^cumple$/i.test(text(row['result'], ''))).length;
    const partial = cases.filter((row) => /parcial/i.test(text(row['result'], ''))).length;
    const fail = cases.filter((row) => /no cumple/i.test(text(row['result'], ''))).length;
    const pending = cases.filter((row) => /pendiente/i.test(text(row['result'], ''))).length;
    chunks.push(heading('4.1 Resumen de cumplimiento', 2));
    chunks.push(
      kvTable([
        ['Total de casos', String(total)],
        ['Cumplen', String(ok)],
        ['Parciales', String(partial)],
        ['No cumplen', String(fail)],
        ['Pendientes', String(pending)],
        ['Cobertura', `${Math.round((ok / total) * 100)}% (${ok} de ${total})`],
        ['Rama feature', text(model['featureBranchUrl'] || model['featureBranch'])]
      ])
    );
    chunks.push(heading('4.2 Detalle de casos', 2));
    chunks.push(
      dataTable(
        ['ID', 'Caso de prueba', 'Resultado', 'Evidencia'],
        cases.map((row) => [text(row['id']), text(row['title']), text(row['result']), text(row['evidence'])])
      )
    );
  }

  return chunks.join('');
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>
    <w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="360" w:after="160"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="${BLUE}"/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>
    <w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="280" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="${BLUE}"/><w:sz w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="${BLUE}"/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
  </w:style>
</w:styles>`;
}

function numberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;
}

function crc32(data: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function zipStore(files: Array<{ name: string; data: string | Uint8Array }>): Blob {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, eocd];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  const buffer = new ArrayBuffer(merged.byteLength);
  new Uint8Array(buffer).set(merged);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function packImages(images: DiagramImage[]): PackedImage[] {
  return images.map((image, index) => {
    const size = emuSize(image.width, image.height);
    return {
      ...image,
      relId: `rId${6 + index}`,
      fileName: `image${index + 1}.${image.ext === 'jpeg' ? 'jpeg' : 'png'}`,
      docPrId: index + 1,
      cx: size.cx,
      cy: size.cy
    };
  });
}

export async function buildInitiativeDocx(
  doc: AdminDoc,
  session?: WordContext,
  diagramImages: DiagramImage[] = []
): Promise<Blob> {
  const ctx = session || {};
  const model: Dict = { ...asDict(doc.model), jira: mergeJira(asDict(doc.model), ctx.jira) };
  const hydrated: AdminDoc = {
    ...doc,
    model,
    title: text(asDict(model['jira'])['summary'] || doc.title || doc.key)
  };
  const jira = asDict(model['jira']);
  const cases = asList(model['cases']);
  const responsible = text(jira['assignee'] || ctx.displayName);
  const title = text(jira['summary'] || hydrated.title || doc.key);
  const subtitle = text(model['subtitle'] || '', '');
  const status = reviewStatus(model, cases);
  const lead = pickTechLead(ctx);
  const published = ctx.review?.status === 'publicada';
  const approval = published
    ? text(ctx.review?.statusLabel, 'Publicada')
    : 'Pendiente de firma del Tech Lead';
  const approvalDate = published ? fmtDate(ctx.review?.publishedAt || '') : '—';
  const approvalNotes = published
    ? `Aprobado y publicado por ${text(lead.name)}${lead.role ? ` (${lead.role})` : ''}.`
    : '';
  const packed = packImages(diagramImages);
  const imageBlocks = packed.map((image) => heading(`${image.kind}: ${image.title}`, 3) + imageDrawing(image) + (image.caption ? paragraph(image.caption, { color: MUTED, size: 18 }) : '')).join('');
  const body = hydrated.structured
    ? structuredBody(hydrated, packed)
    : [
        htmlSection('1. Iniciativa', doc.sectionsHtml?.['iniciativa'] || ''),
        htmlSection('2. Solución', doc.sectionsHtml?.['solucion'] || ''),
        htmlSection('3. Diagramas', doc.sectionsHtml?.['diagramas'] || '') + imageBlocks,
        htmlSection('4. Pruebas', doc.sectionsHtml?.['pruebas'] || '')
      ].join('');

  const imageRels = packed
    .map((image) => `<Relationship Id="${image.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${image.fileName}"/>`)
    .join('');
  const imageTypes = packed.length
    ? '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'
    : '';

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    ${paragraph('BANCO PICHINCHA', { bold: true, center: true, color: BLUE, size: 28 })}
    ${paragraph('Célula Canales Digitales · Portal MBBK', { center: true, color: MUTED, size: 20 })}
    ${paragraph('INFORME DE DOCUMENTACIÓN TÉCNICA', { bold: true, center: true, color: BLUE, size: 36 })}
    ${paragraph(doc.key, { bold: true, center: true, color: BLUE, size: 32 })}
    ${paragraph(title, { center: true, size: 26 })}
    ${subtitle ? paragraph(subtitle, { center: true, color: MUTED, size: 22 }) : ''}
    ${heading('Control del documento', 1)}
    ${kvTable([
      ['Clave', doc.key],
      ['Título', title],
      ['Responsable', responsible],
      ['Squad', text(ctx.squad, 'Célula Canales Digitales')],
      ['Elaborado por', text(ctx.displayName, responsible)],
      ['Rol del elaborador', text(ctx.role)],
      ['Fecha de revisión', published ? approvalDate : fmtDate()],
      ['Última actualización', fmtDate(doc.updated)],
      ['Estado de revisión', status],
      ['Tech Lead', text(lead.name)],
      ['Aprobación por el Tech Lead', approval]
    ])}
    ${heading('Aprobación por el Tech Lead', 1)}
    ${paragraph('Revisión formal del informe de documentación por el líder técnico de la célula.')}
    ${kvTable([
      ['Tech Lead', text(lead.name)],
      ['Rol', text(lead.role, 'Tech Lead')],
      ...(lead.email ? [['Correo', lead.email] as [string, string]] : []),
      ['Estado de aprobación', approval],
      ['Fecha de aprobación', approvalDate],
      ['Observaciones', text(approvalNotes, '')]
    ])}
    ${paragraph(published && lead.name ? `Firma: ${lead.name}` : 'Firma: ________________________________')}
    ${pageBreak()}
    ${tocBlock()}
    ${pageBreak()}
    ${body}
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId1"/>
      <w:footerReference w:type="default" r:id="rId2"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="340" w:footer="340"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:rPr><w:color w:val="${BLUE}"/><w:sz w:val="16"/></w:rPr>
  <w:t xml:space="preserve">Banco Pichincha · Informe de documentación · ${xml(doc.key)}</w:t></w:r></w:p>
</w:hdr>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="right"/></w:pPr>
    <w:r><w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="16"/></w:rPr><w:t>Página </w:t></w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:updateFields w:val="true"/>
</w:settings>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  ${imageRels}
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageTypes}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Informe ${xml(doc.key)}</dc:title>
  <dc:creator>Portal MBBK</dc:creator>
  <cp:lastModifiedBy>${xml(text(ctx.displayName, 'Portal MBBK'))}</cp:lastModifiedBy>
</cp:coreProperties>`;

  return zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/_rels/document.xml.rels', data: documentRels },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/numbering.xml', data: numberingXml() },
    { name: 'word/settings.xml', data: settingsXml },
    { name: 'word/header1.xml', data: headerXml },
    { name: 'word/footer1.xml', data: footerXml },
    { name: 'docProps/core.xml', data: core },
    ...packed.map((image) => ({ name: `word/media/${image.fileName}`, data: image.bytes }))
  ]);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1500);
}
