import { InitiativeRow, MsCard } from './models';

export const HUB_INITIATIVES: InitiativeRow[] = [
  {
    code: 'NEG-1678',
    name: 'Estado de Cuenta',
    ms: 'ch-mbbk-customer-agreement-management-v1',
    status: 'publicada',
    statusLabel: 'Publicada',
    version: 'portal 1.0',
    date: '2026-10-15',
    owner: 'Célula Canales Digitales',
    search: 'neg-1678 estado de cuenta ch-mbbk-customer-agreement-management-v1 eecc statement /channel/mbbk/v1.0/customer-agreement',
    route: '/portal/informe/NEG-1678'
  },
  {
    code: 'NEG-1694',
    name: 'Desbloqueo validación APP',
    ms: 'jch-hbbo-customer-management',
    status: 'publicada',
    statusLabel: 'Publicada',
    version: 'portal 1.0',
    date: '2026-10-16',
    owner: 'Célula Canales Digitales',
    search: 'neg-1694 desbloqueo validacion app jch-hbbo-customer-management dni biometria',
    route: '/portal/informe/NEG-1694'
  },
  {
    code: 'DETECTID-API-KEY',
    name: 'DetectID API key / Content-Type',
    ms: 'DetectID (filtro API key)',
    status: 'revision',
    statusLabel: 'En revisión',
    version: 'portal 1.0',
    date: '2026-10-17',
    owner: 'Célula Canales Digitales',
    search: 'detectid-api-key soap x-api-key text/xml',
    route: '/portal/informe/DETECTID-API-KEY'
  }
];

export const HUB_MS_CARDS: MsCard[] = [
  {
    name: 'ch-mbbk-customer-agreement-management-v1',
    blurb: 'Administra acuerdos del cliente y, en NEG-1678, los endpoints de estado de cuenta.',
    meta: 'Jarvis 1.0.1 · NEG-1678',
    tag: 'Vigente',
    tagClass: 'published',
    search: 'ch-mbbk-customer-agreement-management-v1 acuerdos eecc statement jarvis 1.0.1 neg-1678',
    route: '/portal/ms-agreement'
  },
  {
    name: 'jsc-mbbk-user-preference',
    blurb: 'Preferencias de producto (alias / viewType). Reutilizado por NEG-1678.',
    meta: 'Ficha estable pendiente · no se inventa el catálogo',
    tag: 'Referenciado',
    tagClass: 'reuse',
    search: 'jsc-mbbk-user-preference preferencias products-preference neg-1678'
  },
  {
    name: 'ch-mbbk-correspondence',
    blurb: 'Plantilla HTML del estado de cuenta según moneda.',
    meta: 'Ficha estable pendiente · citado en NEG-1678',
    tag: 'Referenciado',
    tagClass: 'reuse',
    search: 'ch-mbbk-correspondence plantilla pdf eecc neg-1678'
  }
];

export const CATALOG_DESCRIPTIONS: Record<string, string> = {
  'bill-payment': 'Pago de servicios y recibos desde banca móvil MBBK.',
  'contact-form': 'Formularios de contacto y solicitudes del cliente en el canal MBBK.',
  correspondence: 'Plantillas HTML de correspondencia; estado de cuenta según moneda.',
  'current-account': 'Consulta y operación de cuentas corrientes del cliente en el canal MBBK.',
  'customer-agreement-management':
    'Administrar consentimientos, autorizaciones y acuerdos del cliente. Incluye documentos y estados de cuenta.',
  'customer-operation': 'Operaciones del cliente sobre productos y servicios del canal MBBK.',
  'data-retrieve': 'Consulta y recuperación de datos del cliente y de productos para el canal MBBK.',
  'deposit-manager': 'Gestión de depósitos a plazo del cliente en el canal MBBK.',
  'identification-management': 'Gestión de identificación y datos de identidad del cliente en el canal MBBK.',
  'preference-security': 'Preferencias de seguridad del cliente: accesos, validaciones y parámetros.',
  'product-management': 'Consulta y gestión de productos del cliente en el canal MBBK.',
  transactions: 'Consulta y registro de transacciones del cliente en el canal MBBK.',
  'virtual-keyboards': 'Teclados virtuales para captura segura de claves y datos en el canal MBBK.',
  'user-preference':
    'Gestiona, administra y obtiene las preferencias, tasa de cambio e información principal y de contacto del usuario y el cliente.'
};

export const ADMIN_ROLE = 'Administrador';

export const FALLBACK_ROLES = ['Software engineer', 'Tech Lead', 'Administrador'];

export const FALLBACK_SQUADS = ['Célula Canales Digitales'];
