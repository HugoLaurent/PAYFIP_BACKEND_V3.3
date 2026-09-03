import { BaseModel } from '@adonisjs/lucid/orm'
import type {
  ModelAdapterOptions,
  ModelAssignOptions,
  ModelAttributes,
  ModelQueryBuilderContract,
} from '@adonisjs/lucid/types/model'
import { tenantConnectionStorage } from '#services/tenant_connection_service'

/**
 * Base commune aux modèles vivant dans une base par service (Event,
 * Registration, RegistrationDocument, FailedRegistrationMail) : chaque
 * méthode statique de requête/écriture lit la connexion tenant active
 * (AsyncLocalStorage, posée par tenant_connection_service.runOnTenant) et
 * la passe explicitement à Lucid — jamais de mutation de la connexion par
 * défaut globale, qui serait partagée entre requêtes concurrentes de
 * tenants différents.
 *
 * Ne surcharge que les méthodes statiques réellement utilisées dans ce
 * service (query/create/find/findBy/updateOrCreate). Les casts sont
 * nécessaires : TypeScript ne propage pas `this: T` d'une méthode
 * statique à travers un appel `super.xxx()` générique, même si
 * l'implémentation reste correcte au runtime.
 */
export default abstract class TenantBaseModel extends BaseModel {
  private static currentConnection(): string {
    const name = tenantConnectionStorage.getStore()
    if (!name) {
      throw new Error(
        'tenant_connection_not_set: appeler ce modèle depuis tenantConnectionService.runOnTenant()'
      )
    }
    return name
  }

  static query<T extends typeof BaseModel, Result = InstanceType<T>>(
    this: T,
    options?: ModelAdapterOptions
  ): ModelQueryBuilderContract<T, Result> {
    return super.query({
      connection: TenantBaseModel.currentConnection(),
      ...options,
    }) as unknown as ModelQueryBuilderContract<T, Result>
  }

  static create<T extends typeof BaseModel>(
    this: T,
    values: Partial<ModelAttributes<InstanceType<T>>>,
    options?: ModelAssignOptions
  ): Promise<InstanceType<T>> {
    return super.create(values, {
      connection: TenantBaseModel.currentConnection(),
      ...options,
    }) as unknown as Promise<InstanceType<T>>
  }

  static find<T extends typeof BaseModel>(
    this: T,
    value: unknown,
    options?: ModelAdapterOptions
  ): Promise<InstanceType<T> | null> {
    return super.find(value, {
      connection: TenantBaseModel.currentConnection(),
      ...options,
    }) as unknown as Promise<InstanceType<T> | null>
  }

  static findBy<T extends typeof BaseModel>(
    this: T,
    clause: Record<string, unknown>,
    options?: ModelAdapterOptions
  ): Promise<InstanceType<T> | null>
  static findBy<T extends typeof BaseModel>(
    this: T,
    key: string,
    value: unknown,
    options?: ModelAdapterOptions
  ): Promise<InstanceType<T> | null>
  static findBy<T extends typeof BaseModel>(
    this: T,
    keyOrClause: string | Record<string, unknown>,
    valueOrOptions?: unknown,
    maybeOptions?: ModelAdapterOptions
  ): Promise<InstanceType<T> | null> {
    const connection = TenantBaseModel.currentConnection()
    if (typeof keyOrClause === 'string') {
      return super.findBy(keyOrClause, valueOrOptions, {
        connection,
        ...(maybeOptions as ModelAdapterOptions),
      }) as unknown as Promise<InstanceType<T> | null>
    }
    return super.findBy(keyOrClause, {
      connection,
      ...(valueOrOptions as ModelAdapterOptions),
    }) as unknown as Promise<InstanceType<T> | null>
  }

  static updateOrCreate<T extends typeof BaseModel>(
    this: T,
    searchPayload: Partial<ModelAttributes<InstanceType<T>>>,
    updatePayload: Partial<ModelAttributes<InstanceType<T>>>,
    options?: ModelAssignOptions
  ): Promise<InstanceType<T>> {
    return super.updateOrCreate(searchPayload, updatePayload, {
      connection: TenantBaseModel.currentConnection(),
      ...options,
    }) as unknown as Promise<InstanceType<T>>
  }
}
