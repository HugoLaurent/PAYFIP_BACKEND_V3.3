
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export class OrganizationSchema extends BaseModel {
  static $columns = ['createdAt', 'domain', 'id', 'name', 'status', 'updatedAt'] as const
  $columns = OrganizationSchema.$columns
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column()
  declare domain: string
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare name: string
  @column()
  declare status: string
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

export class ServiceSchema extends BaseModel {
  static $columns = ['createdAt', 'id', 'name', 'numcli', 'orgId', 'saisieMode', 'serviceType', 'slug', 'status', 'updatedAt'] as const
  $columns = ServiceSchema.$columns
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare name: string
  @column()
  declare numcli: string | null
  @column()
  declare orgId: number
  @column()
  declare saisieMode: string
  @column()
  declare serviceType: string
  @column()
  declare slug: string | null
  @column()
  declare status: string
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

export class UserServiceAssignmentSchema extends BaseModel {
  static $columns = ['assignedAt', 'canManageTariffs', 'canScan', 'canSell', 'canToggleService', 'canViewHistory', 'id', 'serviceId', 'userId'] as const
  $columns = UserServiceAssignmentSchema.$columns
  @column.dateTime()
  declare assignedAt: DateTime
  @column()
  declare canManageTariffs: boolean
  @column()
  declare canScan: boolean
  @column()
  declare canSell: boolean
  @column()
  declare canToggleService: boolean
  @column()
  declare canViewHistory: boolean
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare serviceId: number
  @column()
  declare userId: number
}

export class UserSchema extends BaseModel {
  static $columns = ['createdAt', 'email', 'id', 'orgId', 'passwordHash', 'role', 'status', 'updatedAt'] as const
  $columns = UserSchema.$columns
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column()
  declare email: string
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare orgId: number
  @column()
  declare passwordHash: string
  @column()
  declare role: string
  @column()
  declare status: string
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
