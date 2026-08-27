import sharp from 'sharp'

export interface ProcessedDocument {
  data: Buffer
  mimeType: string
}

const PDF_MIME_TYPE = 'application/pdf'

/**
 * Traitement d'un justificatif déposé (parcours C). Contrairement aux
 * logos/couvertures de svc-auth, on ne redimensionne jamais : un
 * justificatif doit rester lisible en pleine résolution pour la revue
 * agent. `sharp().rotate()` sans argument applique uniquement la rotation
 * EXIF (photo prise téléphone à l'envers) — pas de recompression au-delà
 * de ce que `.toBuffer()` impose pour le format de sortie.
 */
export async function processDocument(buffer: Buffer, mimeType: string): Promise<ProcessedDocument> {
  if (mimeType === PDF_MIME_TYPE) {
    return { data: buffer, mimeType }
  }

  const data = await sharp(buffer).rotate().toBuffer()
  return { data, mimeType }
}
