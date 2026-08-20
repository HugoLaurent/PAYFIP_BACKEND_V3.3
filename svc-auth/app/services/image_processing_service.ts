import sharp from 'sharp'

export interface ProcessedImage {
  data: Buffer
  mimeType: string
}

// SVG reste tel quel — c'est déjà du vectoriel léger, le rastériser via
// sharp ferait perdre la mise à l'échelle sans réel gain de poids.
const SVG_MIME_TYPE = 'image/svg+xml'

/**
 * Logo de service — affiché à 72px dans l'en-tête public, mais jusqu'à
 * ~2x/3x sur un écran haute densité. 400px de large suffit largement, et
 * le PNG conserve la transparence (fond souvent transparent sur un logo).
 */
export async function processLogo(buffer: Buffer, mimeType: string): Promise<ProcessedImage> {
  if (mimeType === SVG_MIME_TYPE) return { data: buffer, mimeType }

  const data = await sharp(buffer)
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()

  return { data, mimeType: 'image/png' }
}

/**
 * Image de couverture — bandeau photo affiché sur ~700px de large max
 * (colonne principale de l'écran Billets desktop). 1200px de large laisse
 * de la marge pour le rétina sans garder une source démesurée. JPEG :
 * c'est une photo, pas besoin de transparence, et ça compresse bien mieux
 * qu'un PNG pour ce type de contenu.
 */
export async function processCoverImage(buffer: Buffer, mimeType: string): Promise<ProcessedImage> {
  if (mimeType === SVG_MIME_TYPE) return { data: buffer, mimeType }

  const data = await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()

  return { data, mimeType: 'image/jpeg' }
}
