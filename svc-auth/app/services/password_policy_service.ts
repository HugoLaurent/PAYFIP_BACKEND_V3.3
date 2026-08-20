import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import UserPasswordHistory from '#models/user_password_history'

const PASSWORD_EXPIRY_DAYS = 90

export class PasswordReusedError extends Error {}

/** Premier login après création du compte, réinitialisation par un admin, ou mot de passe non renouvelé depuis 90 jours. */
export function isPasswordChangeRequired(user: User): boolean {
  if (user.mustChangePassword) return true
  if (!user.passwordChangedAt) return false
  return DateTime.now().diff(user.passwordChangedAt, 'days').days > PASSWORD_EXPIRY_DAYS
}

/**
 * "Ne peut pas réutiliser ses deux derniers mots de passe" — le mot de
 * passe actuel compte comme le plus récent des deux, donc on ne compare
 * qu'à lui et à la dernière entrée de l'historique.
 */
export async function assertPasswordNotReused(user: User, newPlainPassword: string): Promise<void> {
  if (await hash.verify(user.passwordHash, newPlainPassword)) {
    throw new PasswordReusedError()
  }

  const lastRetired = await UserPasswordHistory.query()
    .where('userId', user.id)
    .orderBy('createdAt', 'desc')
    .first()

  if (lastRetired && (await hash.verify(lastRetired.passwordHash, newPlainPassword))) {
    throw new PasswordReusedError()
  }
}

async function recordAndSetPassword(
  user: User,
  newPlainPassword: string,
  mustChangeAfter: boolean
): Promise<void> {
  await UserPasswordHistory.create({ userId: user.id, passwordHash: user.passwordHash })
  user.passwordHash = await hash.make(newPlainPassword)
  user.passwordChangedAt = DateTime.now()
  user.mustChangePassword = mustChangeAfter
  await user.save()
}

/** L'utilisateur change lui-même son mot de passe (connaît déjà l'actuel) — satisfait l'obligation de changement. */
export async function selfChangePassword(user: User, newPlainPassword: string): Promise<void> {
  await assertPasswordNotReused(user, newPlainPassword)
  await recordAndSetPassword(user, newPlainPassword, false)
}

/** Un admin réinitialise le mot de passe de quelqu'un d'autre — celui-ci devra le changer à sa prochaine connexion. */
export async function adminResetPassword(user: User, newPlainPassword: string): Promise<void> {
  await assertPasswordNotReused(user, newPlainPassword)
  await recordAndSetPassword(user, newPlainPassword, true)
}
