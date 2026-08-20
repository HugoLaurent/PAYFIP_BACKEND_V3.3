import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import type Order from '#models/order'
import type Ticket from '#models/ticket'
import { encodeTicketCode } from '#services/ticket_code_service'
import { logoBuffer } from '#services/aregie_logo'

function euros(cents: number): string {
  return (cents / 100).toFixed(2) + ' €'
}

async function drawTicketPage(doc: PDFKit.PDFDocument, ticket: Ticket, order: Order) {
  const qrPng = await QRCode.toBuffer(encodeTicketCode(ticket.id), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 300,
  })

  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

  doc.image(logoBuffer, doc.page.margins.left, doc.page.margins.top, { width: 90 })

  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text("Billet d'entrée", doc.page.margins.left, doc.page.margins.top + 48)

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#555555')
    .text(`Réf. commande : ${order.paymentReference ?? order.id}`)

  doc.moveDown(0.8)

  doc
    .fontSize(11)
    .fillColor('#000000')
    .font('Helvetica-Bold')
    .text(ticket.tariffType)
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#000000')
    .text(`Date de visite : ${ticket.visitDate.toFormat('dd/MM/yyyy')}`)
    .text(`Tarif payé : ${euros(ticket.priceAtPurchaseCents)}`)

  const qrSize = 170
  const qrX = (doc.page.width - qrSize) / 2
  const qrY = doc.page.height - doc.page.margins.bottom - qrSize - 34
  doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize })

  doc
    .fontSize(8)
    .fillColor('#555555')
    .font('Helvetica')
    .text(`Billet n° ${ticket.id}`, doc.page.margins.left, qrY + qrSize + 8, {
      width: contentWidth,
      align: 'center',
    })
    .text("Présentez ce billet, imprimé ou sur smartphone, à l'entrée.", {
      width: contentWidth,
      align: 'center',
    })
}

/**
 * Un PDF par billet, pas un document combiné — un ticket peut être
 * scanné/imprimé indépendamment des autres de la même commande. Le QR
 * encode le même code signé (`encodeTicketCode`) que la saisie manuelle
 * côté scan, donc les deux chemins vérifient exactement la même chose.
 */
export async function generateTicketPdf(ticket: Ticket, order: Order): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A6', margin: 28 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  await drawTicketPage(doc, ticket, order)

  doc.end()
  return done
}

/**
 * Tous les billets d'une commande en un seul PDF (une page A6 par
 * billet) — juste le confort d'un seul fichier à sauvegarder/imprimer,
 * chaque page reste un billet indépendant avec son propre QR unique
 * (aucun changement de validation par rapport au téléchargement à l'unité).
 */
export async function generateOrderTicketsPdf(tickets: Ticket[], order: Order): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A6', margin: 28, autoFirstPage: false })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  for (const ticket of tickets) {
    doc.addPage()
    await drawTicketPage(doc, ticket, order)
  }

  doc.end()
  return done
}
