import { BaseSchema } from '@adonisjs/lucid/schema'

// `trigger` a été créé via table.enum(...) dans
// 1785414824690_create_payment_resolution_attempts_table.ts, contrainte
// CHECK Postgres réelle — il faut l'altérer pour accepter la nouvelle
// valeur 'reconciliation' (balayage périodique des payment_requests
// encore awaiting_payment, voir payment_reconciliation_service.ts : ni
// urlnotif (jamais observé en environnement de test PayFiP à ce jour) ni
// urlredirect (citoyen qui ne revient jamais) ne suffisent à eux seuls).
// Même mécanique que 1793000000000_alter_events_status_check.ts côté
// svc-inscription : le nom exact de la contrainte n'est pas garanti
// stable, on le retrouve dynamiquement via pg_constraint.
export default class extends BaseSchema {
  protected tableName = 'payment_resolution_attempts'

  async up() {
    this.schema.raw(`
      DO $$
      DECLARE
        existing_constraint_name text;
      BEGIN
        SELECT con.conname INTO existing_constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = '${this.tableName}'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%trigger%'
        LIMIT 1;

        IF existing_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${this.tableName}', existing_constraint_name);
        END IF;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT payment_resolution_attempts_trigger_check
          CHECK (trigger IN ('urlnotif', 'urlredirect', 'reconciliation'));
      END $$;
    `)
  }

  async down() {
    this.schema.raw(`
      DO $$
      DECLARE
        existing_constraint_name text;
      BEGIN
        SELECT con.conname INTO existing_constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = '${this.tableName}'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%trigger%'
        LIMIT 1;

        IF existing_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${this.tableName}', existing_constraint_name);
        END IF;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT payment_resolution_attempts_trigger_check
          CHECK (trigger IN ('urlnotif', 'urlredirect'));
      END $$;
    `)
  }
}
