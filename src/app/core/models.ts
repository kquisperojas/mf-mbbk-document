export interface HubSession {
  id?: string;
  username: string;
  displayName: string;
  role: string;
  squad: string;
  email: string;
  publicProfile: string;
  loginAt: number;
  expiresAt: number;
}

export interface UserDto {
  id: string;
  githubUsername: string;
  email: string;
  nombre: string;
  rol: string;
  squad: string;
  perfilPublico?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogItem {
  id: string;
  nombre: string;
}

export interface InitiativeRow {
  code: string;
  name: string;
  ms: string;
  status: 'publicada' | 'revision' | 'borrador' | 'desactualizada';
  statusLabel: string;
  version: string;
  date: string;
  owner: string;
  search: string;
  route: string;
}

export interface MsCard {
  name: string;
  blurb: string;
  meta: string;
  tag: string;
  tagClass: string;
  search: string;
  route?: string;
}

export interface CatalogMsRow {
  nombre?: string;
  repo?: string;
  descripcion?: string;
  canal?: string;
  owner?: string;
  ultimaModificacion?: string;
  contactName?: string;
  correo?: string;
  contactEmail?: string;
  email?: string;
  version?: string;
  swaggerUrl?: string;
  repoUrl?: string;
}

export interface CatalogPayload {
  generatedAt?: string | null;
  error?: string;
  experiencia: CatalogMsRow[];
  soporteCanal: CatalogMsRow[];
}

export interface JiraConfig {
  project?: string;
  board?: string;
  boardUrl?: string;
  status?: string;
  configured?: boolean;
  error?: string;
  site?: string;
  user?: { name?: string; email?: string };
  jql?: Record<string, string>;
}

export interface JiraInitiative {
  key: string;
  summary: string;
  url: string;
  assignee: string;
  status: string;
  description: string;
}

export interface DocIndexItem {
  key: string;
  title: string;
  url: string;
  updated: string;
}

export interface GenerateResult {
  key: string;
  title?: string;
  httpUrl?: string;
  fileUrl?: string;
  reportPath?: string;
  backup?: string;
  warnings?: string[];
  summary?: {
    jira?: boolean;
    endpoints?: number;
    microservices?: number;
    diagrams?: number;
    cases?: number;
  };
}

export interface ApiCredential {
  id: string;
  proveedor: string;
  clave: string;
  valor: string;
  descripcion?: string;
  configurado: boolean;
}

export interface AdminDoc {
  key: string;
  title: string;
  url: string;
  updated: string;
  structured: boolean;
  model?: Record<string, unknown>;
  sectionsHtml?: Record<string, string>;
}
