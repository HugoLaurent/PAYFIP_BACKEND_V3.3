import {
  refreshTenantRegistry,
  startTenantRegistryAutoRefresh,
} from '#services/tenant_registry_client'

// Chargement initial best-effort : si svc-auth est momentanément
// injoignable au boot, le premier appel réel rechargera via
// getTenantConfig() (cache vide) — on ne bloque jamais le démarrage du
// serveur là-dessus.
refreshTenantRegistry().catch(() => {})
startTenantRegistryAutoRefresh()
