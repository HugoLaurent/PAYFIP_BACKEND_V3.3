import { BaseSchema } from '@adonisjs/lucid/schema'

// `mail_kind` a été créé via table.enum(...) dans
// 1788500004000_create_failed_registration_mails_table.ts — même mécanique
// ALTER que 1793000000000_alter_events_status_check.ts, pour accepter la
// nouvelle valeur 'event_cancelled' (ticket de retry de l'email d'annulation
// d'évènement, voir registration_mail_service.ts#sendEventCancelledEmail).
export default class extends BaseSchema {
  protected tableName = 'failed_registration_mails'

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
          AND pg_get_constraintdef(con.oid) LIKE '%mail_kind%'
        LIMIT 1;

        IF existing_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${this.tableName}', existing_constraint_name);
        END IF;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT failed_registration_mails_mail_kind_check
          CHECK (mail_kind IN ('confirmation', 'payment_request', 'rejection', 'waitlist_offer', 'event_cancelled'));
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
          AND pg_get_constraintdef(con.oid) LIKE '%mail_kind%'
        LIMIT 1;

        IF existing_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '${this.tableName}', existing_constraint_name);
        END IF;

        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT failed_registration_mails_mail_kind_check
          CHECK (mail_kind IN ('confirmation', 'payment_request', 'rejection', 'waitlist_offer'));
      END $$;
    `)
  }
}
