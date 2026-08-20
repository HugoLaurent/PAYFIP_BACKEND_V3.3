import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import RealPayfipClient from '#services/payfip/real_client'
import {
  PayfipFunctionalError,
  PayfipTechnicalError,
  PayfipUnreachableError,
} from '#services/payfip/soap/errors'

function fixture(name: string): string {
  return readFileSync(new URL(`../../fixtures/payfip/${name}`, import.meta.url), 'utf-8')
}

/** Remplace globalThis.fetch le temps d'un test, toujours restauré après. */
function mockFetch(handler: () => Promise<Response> | Response) {
  const original = globalThis.fetch
  globalThis.fetch = async () => handler()
  return () => {
    globalThis.fetch = original
  }
}

const SAMPLE_PARAMS = {
  numcli: '006270',
  exer: 2026,
  reference: 'FACT00000001',
  objectLabel: 'Consultation externe',
  amountCents: 12500,
  payerEmail: 'usager@example.org',
  urlNotif: 'https://gateway.example.org/paiement/payfip/notify',
  urlRedirect: 'https://gateway.example.org/paiement/payfip/return',
  saisie: 'T' as const,
}

test.group('RealPayfipClient — saisiePaiement', () => {
  test('succès -> renvoie idOp', async ({ assert }) => {
    const restore = mockFetch(() => new Response(fixture('creer_paiement_success.xml'), { status: 200 }))
    try {
      const client = new RealPayfipClient()
      const result = await client.saisiePaiement(SAMPLE_PARAMS)
      assert.equal(result.idOp, '6475fa10-b338-11e2-a082-001fe256bdfe')
    } finally {
      restore()
    }
  })

  test('FonctionnelleErreur -> lève PayfipFunctionalError', async ({ assert }) => {
    // P5 sur saisiePaiement n'a pas de sens particulier (jamais vu dans la
    // doc pour cette opération) mais sert ici juste de Fault générique.
    const restore = mockFetch(
      () => new Response(fixture('recuperer_detail_fault_p5.xml'), { status: 500 })
    )
    try {
      const client = new RealPayfipClient()
      await assert.rejects(() => client.saisiePaiement(SAMPLE_PARAMS), PayfipFunctionalError)
    } finally {
      restore()
    }
  })

  test('TechDysfonctionnementErreur -> lève PayfipTechnicalError', async ({ assert }) => {
    const restore = mockFetch(() => new Response(fixture('fault_technical_999.xml'), { status: 500 }))
    try {
      const client = new RealPayfipClient()
      await assert.rejects(() => client.saisiePaiement(SAMPLE_PARAMS), PayfipTechnicalError)
    } finally {
      restore()
    }
  })

  test('réseau en échec -> lève PayfipUnreachableError', async ({ assert }) => {
    const restore = mockFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    try {
      const client = new RealPayfipClient()
      await assert.rejects(() => client.saisiePaiement(SAMPLE_PARAMS), PayfipUnreachableError)
    } finally {
      restore()
    }
  })
})

test.group('RealPayfipClient — recupererDetailPaiementSecurise', () => {
  test('paiement payé CB -> status paid', async ({ assert }) => {
    const restore = mockFetch(
      () => new Response(fixture('recuperer_detail_success_paid_cb.xml'), { status: 200 })
    )
    try {
      const client = new RealPayfipClient()
      const result = await client.recupererDetailPaiementSecurise('81bdf4c0-8edb-11e5-99d5-00000a634c44')
      assert.equal(result.status, 'paid')
      assert.equal(result.numAuto, 'A55A')
      assert.equal(result.raw.numcli, '006270')
    } finally {
      restore()
    }
  })

  test('paiement refusé -> status failed', async ({ assert }) => {
    const restore = mockFetch(
      () => new Response(fixture('recuperer_detail_success_refus.xml'), { status: 200 })
    )
    try {
      const client = new RealPayfipClient()
      const result = await client.recupererDetailPaiementSecurise('d2fa2170-b336-11e2-9476-001fe256bdfe')
      assert.equal(result.status, 'failed')
    } finally {
      restore()
    }
  })

  test('P5 "résultat non connu" -> status unknown, ne lève pas', async ({ assert }) => {
    const restore = mockFetch(
      () => new Response(fixture('recuperer_detail_fault_p5.xml'), { status: 500 })
    )
    try {
      const client = new RealPayfipClient()
      const result = await client.recupererDetailPaiementSecurise('un-idop-quelconque')
      assert.equal(result.status, 'unknown')
      assert.equal(result.resultCode, 'P5')
    } finally {
      restore()
    }
  })

  test('TechDysfonctionnementErreur -> lève PayfipTechnicalError, pas un status', async ({ assert }) => {
    const restore = mockFetch(() => new Response(fixture('fault_technical_999.xml'), { status: 500 }))
    try {
      const client = new RealPayfipClient()
      await assert.rejects(
        () => client.recupererDetailPaiementSecurise('un-idop-quelconque'),
        PayfipTechnicalError
      )
    } finally {
      restore()
    }
  })

  test('timeout réseau -> lève PayfipUnreachableError', async ({ assert }) => {
    const restore = mockFetch(() => {
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      throw error
    })
    try {
      const client = new RealPayfipClient()
      await assert.rejects(
        () => client.recupererDetailPaiementSecurise('un-idop-quelconque'),
        PayfipUnreachableError
      )
    } finally {
      restore()
    }
  })
})
