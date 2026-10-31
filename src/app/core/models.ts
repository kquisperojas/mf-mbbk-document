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

export interface TeamMemberDto {
  id: string;
  orden: number;
  nombre: string;
  rol: string;
  correo?: string | null;
  numero?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  assigneeEmail?: string;
  status: string;
  description: string;
  issueType?: string;
  created?: string;
  resolutionDate?: string;
  reporter?: string;
  children?: JiraInitiative[];
}

export type DocLifecycleStatus = 'borrador' | 'revision' | 'publicada' | 'desactualizada';

export interface DocIndexItem {
  key: string;
  title: string;
  subtitle?: string;
  url: string;
  updated: string;
  status?: DocLifecycleStatus;
  statusLabel?: string;
  hasReport?: boolean;
  isDraft?: boolean;
  missing?: string[];
  publishedAt?: string | null;
  publishedBy?: string | null;
}

export interface GenerateResult {
  key: string;
  title?: string;
  httpUrl?: string;
  fileUrl?: string;
  reportPath?: string;
  backup?: string;
  warnings?: string[];
  status?: DocLifecycleStatus;
  statusLabel?: string;
  missing?: string[];
  summary?: {
    jira?: boolean;
    endpoints?: number;
    microservices?: number;
    diagrams?: number;
    cases?: number;
  };
}

export interface DocDraft {
  key: string;
  link?: string;
  figmaUrl?: string;
  featureBranch?: string;
  files?: Record<string, Array<{ name: string; size: number }>>;
  savedAt?: string;
  status?: DocLifecycleStatus;
  statusLabel?: string;
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

export interface DocReviewComment {
  id: string;
  author: string;
  username: string;
  role: string;
  kind?: 'lead' | 'owner';
  text: string;
  createdAt: string;
  updatedAt?: string;
  usuarioId?: string;
  rolId?: string;
}

export interface DocReview {
  key: string;
  status: DocLifecycleStatus;
  statusLabel?: string;
  publishedAt?: string | null;
  publishedBy?: string | null;
  approvedByRole?: string | null;
  missing?: string[];
  comments: DocReviewComment[];
}
