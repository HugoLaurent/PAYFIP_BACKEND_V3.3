import {
  refreshTenantRegistry,
  startTenantRegistryAutoRefresh,
} from '#services/tenant_registry_client'

refreshTenantRegistry().catch(() => {})
startTenantRegistryAutoRefresh()
