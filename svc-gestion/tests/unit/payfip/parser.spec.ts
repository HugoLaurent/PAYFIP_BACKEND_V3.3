import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import { extractTag, parseSoapResponse } from '#services/payfip/soap/parser'

function fixture(name: string): string {
  return readFileSync(new URL(`../../fixtures/payfip/${name}`, import.meta.url), 'utf-8')
}

const RECUPERER_DETAIL_FIELDS = [
  'numcli',
  'exer',
  'refdet',
  'objet',
  'montant',
  'mel',
  'saisie',
  'resultrans',
  'numauto',
  'dattrans',
  'heurtrans',
  'idop',
]

test.group('payfip/soap/parser', () => {
  test('extractTag ignore le préfixe de namespace', ({ assert }) => {
    const xml = '<ns2:root xmlns:ns2="urn:x"><idop>abc-123</idop></ns2:root>'
    assert.equal(extractTag(xml, 'idop'), 'abc-123')
  })

  test('extractTag renvoie null si la balise est absente', ({ assert }) => {
    assert.isNull(extractTag('<root><a>1</a></root>', 'idop'))
  })

  test('numcli garde ses zéros non significatifs — jamais de coercition numérique', ({ assert }) => {
    const xml = fixture('recuperer_detail_success_paid_cb.xml')
    const decoded = parseSoapResponse(xml, RECUPERER_DETAIL_FIELDS)
    assert.equal(decoded.kind, 'success')
    assert.strictEqual(decoded.fields.numcli, '006270')
    assert.typeOf(decoded.fields.numcli, 'string')
  })

  test('extrait tous les champs de la réponse réelle (Annexe 6, resultrans=P)', ({ assert }) => {
    const xml = fixture('recuperer_detail_success_paid_cb.xml')
    const decoded = parseSoapResponse(xml, RECUPERER_DETAIL_FIELDS)
    assert.deepEqual(decoded, {
      kind: 'success',
      fields: {
        numcli: '006270',
        exer: '2015',
        refdet: '123456789',
        objet: 'test',
        montant: '1500',
        mel: 'gerard.riviere@dgfip.finances.gouv.fr',
        saisie: 'T',
        resultrans: 'P',
        numauto: 'A55A',
        dattrans: '19112015',
        heurtrans: '1735',
        idop: '81bdf4c0-8edb-11e5-99d5-00000a634c44',
      },
    })
  })

  test('un champ absent (numauto sur un refus) vaut null, pas undefined', ({ assert }) => {
    const xml = fixture('recuperer_detail_success_refus.xml')
    const decoded = parseSoapResponse(xml, RECUPERER_DETAIL_FIELDS)
    assert.equal(decoded.fields.resultrans, 'R')
    assert.isNull(decoded.fields.numauto)
  })

  test('détecte FonctionnelleErreur (P5) sans le confondre avec un succès', ({ assert }) => {
    const xml = fixture('recuperer_detail_fault_p5.xml')
    const decoded = parseSoapResponse(xml, RECUPERER_DETAIL_FIELDS)
    assert.equal(decoded.kind, 'functionalError')
    assert.equal(decoded.fields.code, 'P5')
    assert.equal(decoded.fields.libelle, 'Résultat de la transaction non connu.')
  })

  test('détecte TechDysfonctionnementErreur', ({ assert }) => {
    const xml = fixture('fault_technical_999.xml')
    const decoded = parseSoapResponse(xml, RECUPERER_DETAIL_FIELDS)
    assert.equal(decoded.kind, 'technicalError')
    assert.equal(decoded.fields.code, '999')
  })
})
