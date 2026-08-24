import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import Ticket from '#models/ticket'
import type Order from '#models/order'
import { encodeTicketCode } from '#services/ticket_code_service'
import { fetchServiceStatus, fetchServiceLogo } from '#services/svc_auth_client'

// Palette maquette Claude Design "Billet PDF" — deux aplats pleins
// (marine, corail) + une teinte, jamais de dégradé (pdfkit ne fait que du
// rect()/roundedRect() plat). Le bandeau titre, corail dans la maquette
// d'origine, est passé en marine ici : un seul aplat de marque sur le
// billet, cohérence demandée avec l'entête plutôt que la distinction
// marine/corail du reste du site.
const MARINE = '#223499'
const CORAL_TINT = '#ffebe4'
const CORAL_TINT_TEXT = '#b63613'
const INK = '#121b29'
const INK_SECONDARY = '#4f5661'
const INK_LABEL = '#7b8189'
const HAIRLINE = '#dee1e7'
const PAGE_BG = '#f2f5fb'

interface ServiceIdentity {
  name: string
  orgName: string
  logo: Buffer | null
}

/**
 * Identité visuelle du service (nom, organisme, logo) — un seul appel
 * pour toute une commande (tous les billets d'une commande partagent le
 * même service), jamais un par billet. Dégrade vers un nom générique et
 * les initiales si svc-auth ne répond pas : un billet reste utilisable
 * (QR valide) même si l'identité visuelle échoue à charger.
 */
async function loadServiceIdentity(orgId: number, serviceId: number): Promise<ServiceIdentity> {
  const [status, logo] = await Promise.all([
    fetchServiceStatus(orgId, serviceId).catch(() => null),
    fetchServiceLogo(serviceId),
  ])
  return {
    name: status?.name ?? 'Billetterie',
    orgName: status?.orgName ?? '',
    logo: status?.hasLogo ? logo : null,
  }
}

function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Au plus 2 lignes, la 2e tronquée avec "…" si le texte déborde — le nom
// du service n'a jamais de hauteur garantie au-delà.
function wrapLines(doc: PDFKit.PDFDocument, text: string, width: number, fontSize: number): string[] {
  doc.fontSize(fontSize)
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let i = 0
  while (i < words.length && lines.length < 2) {
    let line = words[i]
    i++
    while (i < words.length && doc.widthOfString(`${line} ${words[i]}`) <= width) {
      line += ` ${words[i]}`
      i++
    }
    lines.push(line)
  }
  if (i < words.length) {
    let last = lines[lines.length - 1]
    while (doc.widthOfString(`${last}…`) > width && last.length > 1) {
      last = last.slice(0, -1).trimEnd()
    }
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

async function drawTicketPage(
  doc: PDFKit.PDFDocument,
  ticket: Ticket,
  order: Order,
  identity: ServiceIdentity,
  ticketIndex: number,
  ticketCount: number
) {
  const orderRef = order.paymentReference ?? String(order.id)
  const ticketNo = ticketCount > 1 ? `${orderRef}-${String(ticketIndex).padStart(2, '0')}` : orderRef

  // Correction d'erreur haute : la pastille logo au centre du QR (26 pt,
  // ~5,8 % de sa surface) reste très en dessous du plafond ~20 % que
  // tolère le niveau H (~30 % de récupération).
  const qrPng = await QRCode.toBuffer(encodeTicketCode(ticket.id), {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: 432,
  })

  // Zone identité (y 0→104) — aplat marine, logo ou initiales du service
  doc.rect(0, 0, 297, 104).fill(MARINE)

  doc.roundedRect(20, 20, 48, 48, 12).fill('#ffffff')
  if (identity.logo) {
    doc.save()
    doc.roundedRect(28, 28, 32, 32, 8).clip()
    doc.image(identity.logo, 28, 28, { width: 32, height: 32 })
    doc.restore()
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor(MARINE)
      .text(deriveInitials(identity.name), 20, 34, { width: 48, align: 'center' })
  }

  const nameLines = wrapLines(doc, identity.name, 197, 15)
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff')
  nameLines.forEach((line, i) => doc.text(line, 80, 24 + i * 17))
  if (identity.orgName) {
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#a9b3e3')
      .text(identity.orgName, 80, 24 + nameLines.length * 17 + 4, { width: 197 })
  }

  // Bandeau titre (y 104→130)
  doc.rect(0, 104, 297, 26).fill(MARINE)
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor('#ffffff')
    .text("BILLET D'ENTRÉE", 0, 113, { width: 297, align: 'center', characterSpacing: 1.7 })

  // Zone info-visite (y 130→225)
  doc.font('Helvetica').fontSize(7).fillColor(INK_LABEL).text('TARIF', 20, 148, { characterSpacing: 0.8 })
  const tariffSize = ticket.tariffType.length > 22 ? 13 : 15
  doc.font('Helvetica-Bold').fontSize(tariffSize).fillColor(INK).text(ticket.tariffType, 20, 160, { width: 145 })

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(INK_LABEL)
    .text('DATE DE VISITE', 20, 191, { characterSpacing: 0.8 })
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(INK)
    .text(ticket.visitDate.setLocale('fr').toFormat('cccc d MMMM yyyy'), 20, 203, { width: 145 })

  doc.roundedRect(185, 144, 92, 60, 10).fill(CORAL_TINT)
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(CORAL_TINT_TEXT)
    .text('PRIX PAYÉ', 185, 162, { width: 92, align: 'center', characterSpacing: 0.8 })
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(CORAL_TINT_TEXT)
    .text(euros(ticket.priceAtPurchaseCents), 185, 176, { width: 92, align: 'center' })

  doc.rect(20, 224, 257, 1).fill(HAIRLINE)

  // Zone QR (y 225→380)
  doc.image(qrPng, 20, 244, { width: 108, height: 108 })

  doc.roundedRect(61, 285, 26, 26, 7).fill('#ffffff')
  if (identity.logo) {
    doc.save()
    doc.roundedRect(64.5, 288.5, 19, 19, 5).clip()
    doc.image(identity.logo, 64.5, 288.5, { width: 19, height: 19 })
    doc.restore()
  } else {
    doc.roundedRect(64.5, 288.5, 19, 19, 5).fill(MARINE)
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#ffffff')
      .text(deriveInitials(identity.name), 64.5, 294, { width: 19, align: 'center' })
  }

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(INK_LABEL)
    .text('N° DE BILLET', 144, 244, { characterSpacing: 0.8 })
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(INK)
    .text(ticketNo, 144, 256, { characterSpacing: 0.3, width: 133 })

  doc.font('Helvetica').fontSize(7).fillColor(INK_LABEL).text('COMMANDE', 144, 288, { characterSpacing: 0.8 })
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(INK_SECONDARY)
    .text(orderRef, 144, 300, { characterSpacing: 0.3, width: 133 })

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK_SECONDARY)
    .text("Présentez ce billet imprimé ou sur votre smartphone à l'entrée.", 144, 330, {
      width: 133,
      lineGap: 4,
    })

  // Pied (y 380→420) — pointillé de découpe, mention légale, AREGIE
  doc.save()
  doc.dash(6, { space: 5 }).moveTo(0, 380).lineTo(297, 380).strokeColor(HAIRLINE).stroke()
  doc.restore()

  doc.rect(0, 381, 297, 39).fill(PAGE_BG)
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(INK_LABEL)
    .text('aregie.fr', 20, 394)
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(MARINE)
    .text('AREGIE', 184, 394, { width: 93, align: 'right' })
}

/**
 * Un PDF par billet, pas un document combiné — un ticket peut être
 * scanné/imprimé indépendamment des autres de la même commande. Le QR
 * encode le même code signé (`encodeTicketCode`) que la saisie manuelle
 * côté scan, donc les deux chemins vérifient exactement la même chose.
 */
export async function generateTicketPdf(ticket: Ticket, order: Order): Promise<Buffer> {
  const identity = await loadServiceIdentity(order.orgId, order.serviceId)
  // Le n° de billet (AR-XXXX-0N) a besoin de connaître le rang du billet
  // dans sa commande, même quand on ne génère que ce seul PDF.
  const siblings = await Ticket.query().where('orderId', order.id).orderBy('id', 'asc')
  const index = siblings.findIndex((t) => t.id === ticket.id)

  const doc = new PDFDocument({ size: 'A6', margin: 0 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  await drawTicketPage(doc, ticket, order, identity, index + 1, siblings.length)

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
  const identity = await loadServiceIdentity(order.orgId, order.serviceId)

  const doc = new PDFDocument({ size: 'A6', margin: 0, autoFirstPage: false })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  for (let i = 0; i < tickets.length; i++) {
    doc.addPage()
    await drawTicketPage(doc, tickets[i], order, identity, i + 1, tickets.length)
  }

  doc.end()
  return done
}
