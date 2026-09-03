
export const ORGANIZATION_STATUSES = ['active', 'suspended', 'deleted'] as const

export const USER_ROLES = ['admin', 'agent'] as const
export const USER_STATUSES = ['active', 'inactive', 'deleted'] as const

export const SERVICE_TYPES = ['billetterie', 'factures', 'inscription'] as const
export const SERVICE_STATUSES = ['draft', 'active', 'archived'] as const
export const SAISIE_MODES = ['T', 'X', 'W'] as const

// Un service métier a une base par appli qui écrit sur son serviceId —
// les 3 SERVICE_TYPES (l'appli citoyenne) plus 'gestion' (svc-gestion,
// qui persiste les PaymentRequest de ce même serviceId séparément — voir
// svc-gestion/app/models/payment_request.ts:sourceService).
export const TENANT_DB_APPS = ['billetterie', 'factures', 'inscription', 'gestion'] as const
export const TENANT_DB_STATUSES = ['provisioning', 'active', 'migrating', 'suspended'] as const
