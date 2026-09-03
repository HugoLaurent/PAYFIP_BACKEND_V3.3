import { test } from '@japa/runner'
import Invoice from '#models/invoice'
import { mintTestInternalJwt } from '#tests/helpers/internal_auth'
import { runOnTenant } from '#services/tenant_connection_service'
import { encodeInvoiceCode } from '#services/invoice_code_service'

// Doit être un serviceId provisionné dans tenant_databases (voir
// tenant:provision) pour l'environnement où ces tests tournent.
const TEST_SERVICE_ID = 1

function uniqueRef(tag: string): string {
  return `HOSP-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

async function createInvoice(overrides: Partial<Invoice> = {}) {
  return runOnTenant(TEST_SERVICE_ID, () =>
    Invoice.create({
      orgId: 1,
      serviceId: TEST_SERVICE_ID,
      hospitalReference: uniqueRef('own'),
      amountCents: 5000,
      objectLabel: 'Consultation',
      fiscalYear: 2026,
      status: 'draft',
      ...overrides,
    })
  )
}

test.group('InvoicesController#pay — isolation inter-organismes', () => {
  test("un token d'un AUTRE organisme ne peut pas payer la facture, même avec la bonne preuve", async ({
    client,
  }) => {
    const invoice = await createInvoice({ orgId: 1 })
    const attackerToken = await mintTestInternalJwt({ orgId: '2', scope: 'factures' })

    const res = await client
      .post(`/invoices/${encodeInvoiceCode(TEST_SERVICE_ID, invoice.id)}/pay`)
      .header('Authorization', `Bearer ${attackerToken}`)
      .json({
        frontRedirectUrl: 'https://front.invalid.test/return',
        payerEmail: 'usager@test.fr',
        fiscalYear: invoice.fiscalYear,
        amountCents: invoice.amountCents,
      })

    res.assertStatus(404)
    res.assertBodyContains({ error: 'invoice_not_found' })

    await invoice.refresh()
    // La facture ne doit pas avoir été engagée (pas de paymentReference).
    if (invoice.paymentReference) {
      throw new Error('la facture a été modifiée alors que le token appartenait à un autre organisme')
    }
  })

  test("preuve incorrecte (bon organisme) -> 404 identique, pas d'oracle", async ({ client }) => {
    const invoice = await createInvoice({ orgId: 1 })
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'factures' })

    const res = await client
      .post(`/invoices/${encodeInvoiceCode(TEST_SERVICE_ID, invoice.id)}/pay`)
      .header('Authorization', `Bearer ${token}`)
      .json({
        frontRedirectUrl: 'https://front.invalid.test/return',
        payerEmail: 'usager@test.fr',
        fiscalYear: invoice.fiscalYear,
        amountCents: invoice.amountCents + 1,
      })

    res.assertStatus(404)
    res.assertBodyContains({ error: 'invoice_not_found' })
  })
})

test.group('InvoicesController#verify — anti-énumération', () => {
  test('référence inexistante et preuve incorrecte renvoient exactement la même réponse', async ({
    client,
    assert,
  }) => {
    const invoice = await createInvoice({ orgId: 1 })
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'factures' })

    const wrongProof = await client
      .post('/invoices/verify')
      .header('Authorization', `Bearer ${token}`)
      .json({
        hospitalReference: invoice.hospitalReference,
        fiscalYear: invoice.fiscalYear,
        amountCents: invoice.amountCents + 1,
      })

    const unknownRef = await client
      .post('/invoices/verify')
      .header('Authorization', `Bearer ${token}`)
      .json({
        hospitalReference: 'REFERENCE-QUI-N-EXISTE-PAS',
        fiscalYear: invoice.fiscalYear,
        amountCents: invoice.amountCents,
      })

    assert.equal(wrongProof.status(), unknownRef.status())
    assert.deepEqual(wrongProof.body(), unknownRef.body())
    wrongProof.assertStatus(404)
    wrongProof.assertBodyContains({ error: 'invoice_not_found_or_proof_mismatch' })
  })

  test("une facture d'un autre organisme est traitée comme inexistante", async ({ client }) => {
    const invoice = await createInvoice({ orgId: 1 })
    const otherOrgToken = await mintTestInternalJwt({ orgId: '2', scope: 'factures' })

    const res = await client
      .post('/invoices/verify')
      .header('Authorization', `Bearer ${otherOrgToken}`)
      .json({
        hospitalReference: invoice.hospitalReference,
        fiscalYear: invoice.fiscalYear,
        amountCents: invoice.amountCents,
      })

    res.assertStatus(404)
    res.assertBodyContains({ error: 'invoice_not_found_or_proof_mismatch' })
  })
})
