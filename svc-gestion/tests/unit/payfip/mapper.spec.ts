import { test } from '@japa/runner'
import { mapCreerPaiementSuccess, mapRecupererDetailSuccess } from '#services/payfip/soap/mapper'
import { PayfipUnexpectedResponseError } from '#services/payfip/soap/errors'

test.group('payfip/soap/mapper — mapRecupererDetailSuccess', () => {
  test('P (payé CB) -> paid', ({ assert }) => {
    const result = mapRecupererDetailSuccess({ resultrans: 'P', numauto: 'A55A' })
    assert.equal(result.status, 'paid')
    assert.equal(result.resultCode, 'P')
    assert.equal(result.numAuto, 'A55A')
  })

  test('V (payé prélèvement) -> paid', ({ assert }) => {
    assert.equal(mapRecupererDetailSuccess({ resultrans: 'V' }).status, 'paid')
  })

  test('A (abandon) -> failed', ({ assert }) => {
    assert.equal(mapRecupererDetailSuccess({ resultrans: 'A' }).status, 'failed')
  })

  test('R (refus CB) -> failed', ({ assert }) => {
    assert.equal(mapRecupererDetailSuccess({ resultrans: 'R' }).status, 'failed')
  })

  test('Z (refus prélèvement) -> failed', ({ assert }) => {
    assert.equal(mapRecupererDetailSuccess({ resultrans: 'Z' }).status, 'failed')
  })

  test('code non documenté -> unknown (fail-safe, ne finalise jamais à tort)', ({ assert }) => {
    assert.equal(mapRecupererDetailSuccess({ resultrans: 'X' }).status, 'unknown')
  })

  test('numAuto absent -> null', ({ assert }) => {
    assert.isNull(mapRecupererDetailSuccess({ resultrans: 'R' }).numAuto)
  })

  test('raw porte tous les champs bruts', ({ assert }) => {
    const fields = { resultrans: 'P', numcli: '006270' }
    assert.deepEqual(mapRecupererDetailSuccess(fields).raw, fields)
  })
})

test.group('payfip/soap/mapper — mapCreerPaiementSuccess', () => {
  test('accepte idop sous <idop> — forme réelle : <return><idOp>...</idOp></return>, extractTag trouve idOp malgré l\'imbrication', ({ assert }) => {
    assert.equal(mapCreerPaiementSuccess({ idop: 'abc-123' }).idOp, 'abc-123')
  })

  test('accepte idop sous <return> (filet de sécurité, pas la forme réelle observée)', ({ assert }) => {
    assert.equal(mapCreerPaiementSuccess({ idop: null, return: 'abc-123' }).idOp, 'abc-123')
  })

  test('lève PayfipUnexpectedResponseError si aucun idop trouvable', ({ assert }) => {
    assert.throws(() => mapCreerPaiementSuccess({ idop: null }), PayfipUnexpectedResponseError)
  })
})
