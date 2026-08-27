import { BaseSchema } from '@adonisjs/lucid/schema'

// La colonne source_service a été créée via table.enum(...) dans
// 1785414822601_create_payment_requests_table.ts, ce qui pose une vraie
// contrainte CHECK Postgres (pas juste une validation TS côté enums.ts) —
// il faut donc l'altérer explicitement pour accepter la nouvelle valeur
// 'inscription' (nouveau service svc-inscription).
//
// Le nom exact généré par Knex pour cette contrainte n'est pas garanti
// stable d'un environnement à l'autre (dépend de la version de
// Knex/PG au moment de la création) : on le retrouve dynamiquement via
// pg_constraint plutôt que de le supposer, pour ne pas planter si le nom
// diffère de la convention par défaut `<table>_<column>_check`.
export default class extends BaseSchema {
  protected tableName = 'payment_requests'

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
          AND pg_get_constraintdef(con.oid) LIKE '%source_service%'
        LIMIT 1;

        IF existing_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${this.tableName}', existing_constraint_name);
        END IF;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT payment_requests_source_service_check
          CHECK (source_service IN ('billetterie', 'factures', 'inscription'));
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
          AND pg_get_constraintdef(con.oid) LIKE '%source_service%'
        LIMIT 1;

        IF existing_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${this.tableName}', existing_constraint_name);
        END IF;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT payment_requests_source_service_check
          CHECK (source_service IN ('billetterie', 'factures'));
      END $$;
    `)
  }
}
