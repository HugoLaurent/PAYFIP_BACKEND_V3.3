import sharp from 'sharp'

export interface ProcessedDocument {
  data: Buffer
  mimeType: string
}

const PDF_MIME_TYPE = 'application/pdf'
const PDF_SIGNATURE = Buffer.from('%PDF-')

/**
 * Traitement d'un justificatif déposé (parcours C). Contrairement aux
 * logos/couvertures de svc-auth, on ne redimensionne jamais : un
 * justificatif doit rester lisible en pleine résolution pour la revue
 * agent. `sharp().rotate()` sans argument applique uniquement la rotation
 * EXIF (photo prise téléphone à l'envers) — pas de recompression au-delà
 * de ce que `.toBuffer()` impose pour le format de sortie.
 *
 * Pour les images, sharp() doit décoder le buffer pour le traiter — un
 * faux PNG/JPEG plante et est rejeté. Un PDF n'est jamais décodé côté
 * serveur, donc sans ce contrôle explicite, un fichier renommé en .pdf
 * (mimeType déclaré par le client, retenu par Adonis faute de signature
 * binaire reconnue) serait stocké et resservi tel quel — voir pentest
 * 2026-09-01. Renvoie null si la signature ne correspond pas.
 */
export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ProcessedDocument | null> {
  if (mimeType === PDF_MIME_TYPE) {
    if (!buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
      return null
    }
    return { data: buffer, mimeType }
  }

  const data = await sharp(buffer).rotate().toBuffer()
  return { data, mimeType }
}
