import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Organization from '#models/organization'
import Service from '#models/service'
import UserServiceAssignment from '#models/user_service_assignment'
import { USER_ROLES, USER_STATUSES } from '#database/enums'

export type UserRole = (typeof USER_ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]

export interface AgentPermissions {
  canSell: boolean
  canScan: boolean
  canManageTariffs: boolean
  canViewHistory: boolean
  canToggleService: boolean
}

const FULL_PERMISSIONS: AgentPermissions = {
  canSell: true,
  canScan: true,
  canManageTariffs: true,
  canViewHistory: true,
  canToggleService: true,
}

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare passwordHash: string

  @column()
  declare firstName: string | null

  @column()
  declare lastName: string | null

  @column()
  declare role: UserRole

  @column()
  declare status: UserStatus

  @column.dateTime()
  declare lastLoginAt: DateTime | null

  @column()
  declare mustChangePassword: boolean

  @column.dateTime()
  declare passwordChangedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @hasMany(() => UserServiceAssignment)
  declare assignments: HasMany<typeof UserServiceAssignment>

  async getAccessibleServices(): Promise<Service[]> {
    if (this.role === 'admin') {
      return Service.query().where('orgId', this.orgId).where('status', '!=', 'archived')
    }

    const assignments = await UserServiceAssignment.query().where('userId', this.id)
    const serviceIds = assignments.map((assignment) => assignment.serviceId)
    if (serviceIds.length === 0) return []

    return Service.query().whereIn('id', serviceIds).where('status', '!=', 'archived')
  }

  async servicePermissions(): Promise<Record<number, AgentPermissions>> {
    if (this.role === 'admin') {
      const services = await this.getAccessibleServices()
      return Object.fromEntries(services.map((s) => [s.id, FULL_PERMISSIONS]))
    }

    const assignments = await UserServiceAssignment.query().where('userId', this.id)
    return Object.fromEntries(
      assignments.map((a) => [
        a.serviceId,
        {
          canSell: a.canSell,
          canScan: a.canScan,
          canManageTariffs: a.canManageTariffs,
          canViewHistory: a.canViewHistory,
          canToggleService: a.canToggleService,
        },
      ])
    )
  }
}
