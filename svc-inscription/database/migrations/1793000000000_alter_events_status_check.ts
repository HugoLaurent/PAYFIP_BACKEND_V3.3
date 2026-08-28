import { BaseSchema } from '@adonisjs/lucid/schema'

// `status` a été créé via table.enum(...) dans 1788500000000_create_events_table.ts,
// contrainte CHECK Postgres réelle — il faut l'altérer pour accepter la
// nouvelle valeur 'cancelled' (annulation d'évènement par l'agent, voir
// events_controller.ts#cancel). Même mécanique que les migrations ALTER
// déjà écrites pour svc-gestion/svc-auth : le nom exact de la contrainte
// n'est pas garanti stable, on le retrouve dynamiquement via pg_constraint.
export default class extends BaseSchema {
  protected tableName = 'events'

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
          AND pg_get_constraintdef(con.oid) LIKE '%status%'
        LIMIT 1;

        IF existing_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${this.tableName}', existing_constraint_name);
        END IF;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT events_status_check
          CHECK (status IN ('draft', 'published', 'closed', 'archived', 'cancelled'));
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
          AND pg_get_constraintdef(con.oid) LIKE '%status%'
        LIMIT 1;

        IF existing_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${this.tableName}', existing_constraint_name);
        END IF;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT events_status_check
          CHECK (status IN ('draft', 'published', 'closed', 'archived'));
      END $$;
    `)
  }
}
