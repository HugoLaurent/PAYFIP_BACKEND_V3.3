import { test } from '@japa/runner'
import {
  buildCreerPaiementEnvelope,
  buildRecupererDetailEnvelope,
  escapeXml,
} from '#services/payfip/soap/envelope'

test.group('payfip/soap/envelope', () => {
  test('escapeXml échappe les 5 caractères spéciaux XML', ({ assert }) => {
    assert.equal(escapeXml(`Tom & "Jerry" <it's a 'test'>`), `Tom &amp; &quot;Jerry&quot; &lt;it&apos;s a &apos;test&apos;&gt;`)
  })

  test('buildCreerPaiementEnvelope inclut les 9 champs avec leurs valeurs', ({ assert }) => {
    const xml = buildCreerPaiementEnvelope({
      numcli: '006270',
      exer: 2026,
      reference: 'FACT00000001',
      objectLabel: 'Consultation externe',
      amountCents: 12500,
      payerEmail: 'usager@example.org',
      urlNotif: 'https://gateway.example.org/paiement/payfip/notify',
      urlRedirect: 'https://gateway.example.org/paiement/payfip/return',
      saisie: 'T',
    })

    assert.include(xml, '<numcli>006270</numcli>')
    assert.include(xml, '<exer>2026</exer>')
    assert.include(xml, '<refdet>FACT00000001</refdet>')
    assert.include(xml, '<objet>Consultation externe</objet>')
    assert.include(xml, '<montant>12500</montant>')
    assert.include(xml, '<mel>usager@example.org</mel>')
    assert.include(xml, '<saisie>T</saisie>')
    assert.include(xml, '<urlnotif>https://gateway.example.org/paiement/payfip/notify</urlnotif>')
    assert.include(xml, '<urlredirect>https://gateway.example.org/paiement/payfip/return</urlredirect>')
  })

  test('buildCreerPaiementEnvelope utilise le bon élément racine et le wrapper arg0', ({ assert }) => {
    const xml = buildCreerPaiementEnvelope({
      numcli: '006270',
      exer: 2026,
      reference: 'FACT00000001',
      objectLabel: 'Consultation externe',
      amountCents: 12500,
      payerEmail: 'usager@example.org',
      urlNotif: 'https://gateway.example.org/paiement/payfip/notify',
      urlRedirect: 'https://gateway.example.org/paiement/payfip/return',
      saisie: 'T',
    })

    assert.include(xml, '<tns:creerPaiementSecurise>')
    assert.notInclude(xml, 'creerPaiementSecuriseRequest')
    assert.include(xml, '<arg0>')
    assert.match(xml, /<arg0>\s*<numcli>006270<\/numcli>/)
  })

  test('buildCreerPaiementEnvelope échappe objectLabel et payerEmail', ({ assert }) => {
    const xml = buildCreerPaiementEnvelope({
      numcli: '006270',
      exer: 2026,
      reference: 'FACT00000001',
      objectLabel: 'Facture "Dupont & Fils"',
      amountCents: 100,
      payerEmail: 'usager@example.org',
      urlNotif: 'https://x.test/notify',
      urlRedirect: 'https://x.test/return',
      saisie: 'T',
    })

    assert.include(xml, '<objet>Facture &quot;Dupont &amp; Fils&quot;</objet>')
    assert.notInclude(xml, 'Facture "Dupont & Fils"')
  })

  test('buildRecupererDetailEnvelope ne porte que idOp (O majuscule), dans arg0', ({ assert }) => {
    const xml = buildRecupererDetailEnvelope('81bdf4c0-8edb-11e5-99d5-00000a634c44')
    assert.include(xml, '<idOp>81bdf4c0-8edb-11e5-99d5-00000a634c44</idOp>')
    assert.include(xml, '<tns:recupererDetailPaiementSecurise>')
    assert.notInclude(xml, 'recupererDetailPaiementSecuriseRequest')
    assert.match(xml, /<arg0>\s*<idOp>/)
  })
})
