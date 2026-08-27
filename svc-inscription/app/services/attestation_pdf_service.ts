import PDFDocument from 'pdfkit'
import type Registration from '#models/registration'
import type Event from '#models/event'
import { fetchServiceStatus, fetchServiceLogo } from '#services/svc_auth_client'

// Même palette que ticket_pdf_service.ts (svc-billetterie) — deux aplats
// pleins (marine, corail) + une teinte, jamais de dégradé.
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

async function loadServiceIdentity(orgId: number, serviceId: number): Promise<ServiceIdentity> {
  const [status, logo] = await Promise.all([
    fetchServiceStatus(orgId, serviceId).catch(() => null),
    fetchServiceLogo(serviceId),
  ])
  return {
    name: status?.name ?? 'Inscription',
    orgName: status?.orgName ?? '',
    logo: status?.hasLogo ? logo : null,
  }
}

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

/**
 * Attestation d'inscription — document distinct du billet PDF de la
 * billetterie (autre outillage métier), mais même technique (pdfkit).
 * Pas de QR/code de scan ici : cette attestation ne sert pas à un contrôle
 * d'accès, seulement de justificatif d'inscription confirmée.
 */
export async function generateRegistrationAttestationPdf(
  registration: Registration,
  event: Event
): Promise<Buffer> {
  const identity = await loadServiceIdentity(registration.orgId, registration.serviceId)

  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  const pageWidth = doc.page.width

  // Bandeau identité (aplat marine)
  doc.rect(0, 0, pageWidth, 130).fill(MARINE)

  doc.roundedRect(48, 32, 66, 66, 14).fill('#ffffff')
  if (identity.logo) {
    doc.save()
    doc.roundedRect(56, 40, 50, 50, 10).clip()
    doc.image(identity.logo, 56, 40, { width: 50, height: 50 })
    doc.restore()
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(26)
      .fillColor(MARINE)
      .text(deriveInitials(identity.name), 48, 55, { width: 66, align: 'center' })
  }

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text(identity.name, 130, 44, {
    width: pageWidth - 178,
  })
  if (identity.orgName) {
    doc.font('Helvetica').fontSize(11).fillColor('#a9b3e3').text(identity.orgName, 130, 70, {
      width: pageWidth - 178,
    })
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor('#a9b3e3')
    .text("ATTESTATION D'INSCRIPTION", 130, 92, { characterSpacing: 1.4 })

  const registrationRef = registration.paymentReference ?? String(registration.id)
  let y = 170

  doc.font('Helvetica').fontSize(8.5).fillColor(INK_LABEL).text('ÉVÈNEMENT', 48, y, {
    characterSpacing: 0.8,
  })
  y += 14
  doc.font('Helvetica-Bold').fontSize(17).fillColor(INK).text(event.title, 48, y, {
    width: pageWidth - 96,
  })
  y += 40

  if (event.eventDate) {
    doc.font('Helvetica').fontSize(8.5).fillColor(INK_LABEL).text('DATE', 48, y, {
      characterSpacing: 0.8,
    })
    y += 14
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(INK)
      .text(event.eventDate.setLocale('fr').toFormat('cccc d MMMM yyyy'), 48, y)
    y += 34
  }

  doc.rect(48, y, pageWidth - 96, 1).fill(HAIRLINE)
  y += 28

  doc.font('Helvetica').fontSize(8.5).fillColor(INK_LABEL).text('INSCRIT', 48, y, {
    characterSpacing: 0.8,
  })
  y += 14
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(INK)
    .text(`${registration.firstName} ${registration.lastName}`, 48, y)
  doc.font('Helvetica').fontSize(10).fillColor(INK_SECONDARY).text(registration.email, 48, y + 18)
  y += 46

  doc.font('Helvetica').fontSize(8.5).fillColor(INK_LABEL).text('NUMÉRO D’INSCRIPTION', 48, y, {
    characterSpacing: 0.8,
  })
  y += 14
  doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(registrationRef, 48, y)
  if (registration.quantity > 1) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(INK_SECONDARY)
      .text(`${registration.quantity} participants`, 48, y + 18)
  }
  y += 46

  const amountBoxWidth = 220
  doc.roundedRect(48, y, amountBoxWidth, 70, 10).fill(CORAL_TINT)
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(CORAL_TINT_TEXT)
    .text('MONTANT', 48, y + 14, { width: amountBoxWidth, align: 'center', characterSpacing: 0.8 })
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(CORAL_TINT_TEXT)
    .text(
      registration.priceCentsAtRegistration === 0
        ? 'Gratuit'
        : euros(registration.priceCentsAtRegistration),
      48,
      y + 32,
      { width: amountBoxWidth, align: 'center' }
    )

  // Pied de page
  const footerY = doc.page.height - 60
  doc.rect(0, footerY, pageWidth, 60).fill(PAGE_BG)
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK_LABEL)
    .text(
      `Attestation générée le ${new Date().toLocaleDateString('fr-FR')} — document délivré à titre de justificatif d'inscription.`,
      48,
      footerY + 22,
      { width: pageWidth - 96 }
    )

  doc.end()
  return done
}
