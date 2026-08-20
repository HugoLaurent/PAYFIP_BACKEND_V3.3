import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE scans DROP CONSTRAINT scans_result_check')
    this.schema.raw(
      `ALTER TABLE scans ADD CONSTRAINT scans_result_check CHECK (result = ANY (ARRAY['valid'::text, 'already_consumed'::text, 'invalid_date'::text, 'not_found'::text, 'invalid_signature'::text, 'other'::text, 'reset'::text]))`
    )
  }

  async down() {
    this.schema.raw('ALTER TABLE scans DROP CONSTRAINT scans_result_check')
    this.schema.raw(
      `ALTER TABLE scans ADD CONSTRAINT scans_result_check CHECK (result = ANY (ARRAY['valid'::text, 'already_consumed'::text, 'invalid_date'::text, 'not_found'::text, 'invalid_signature'::text, 'other'::text]))`
    )
  }
}
