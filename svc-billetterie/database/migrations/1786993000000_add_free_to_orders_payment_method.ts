import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT orders_payment_method_check')
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method = ANY (ARRAY['payfip'::text, 'cash'::text, 'card'::text, 'check'::text, 'other'::text, 'free'::text]))`
    )
  }

  async down() {
    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT orders_payment_method_check')
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method = ANY (ARRAY['payfip'::text, 'cash'::text, 'card'::text, 'check'::text, 'other'::text]))`
    )
  }
}
