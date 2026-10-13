const PDF_SIGNATURE = Buffer.from('%PDF-')
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])

/**
 * Contrôle minimal d'une pièce justificative avant de la relayer par email :
 * le type MIME est déclaré par le client, donc on vérifie la signature
 * binaire (un fichier renommé en .pdf serait sinon relayé tel quel — voir
 * pentest 2026-09-01). Aucune transformation : la pièce reste lisible en
 * pleine résolution pour l'agent, et rien n'est stocké (voir
 * sendDocumentsToAgentEmail).
 */
export function hasValidDocumentSignature(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)
    case 'image/png':
      return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    case 'image/jpeg':
      return buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)
    default:
      return false
  }
}
