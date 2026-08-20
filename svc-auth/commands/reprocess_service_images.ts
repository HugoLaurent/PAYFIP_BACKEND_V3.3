import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class ReprocessServiceImages extends BaseCommand {
  static commandName = 'images:reprocess'
  static description =
    'Recompresse/redimensionne les logos et images de couverture déjà stockés — one-off pour les fichiers uploadés avant que le pipeline sharp existe'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { default: Service } = await import('#models/service')
    const { processLogo, processCoverImage } = await import('#services/image_processing_service')

    const services = await Service.query().select(
      'id',
      'logoData',
      'logoMimeType',
      'coverImageData',
      'coverImageMimeType'
    )

    let logosReprocessed = 0
    let coversReprocessed = 0

    for (const service of services) {
      let dirty = false

      if (service.logoData && service.logoMimeType) {
        const before = service.logoData.byteLength
        const processed = await processLogo(service.logoData, service.logoMimeType)
        if (processed.data.byteLength < before) {
          service.logoData = processed.data
          service.logoMimeType = processed.mimeType
          dirty = true
          logosReprocessed++
          this.logger.info(`service ${service.id} — logo ${before} -> ${processed.data.byteLength} bytes`)
        }
      }

      if (service.coverImageData && service.coverImageMimeType) {
        const before = service.coverImageData.byteLength
        const processed = await processCoverImage(service.coverImageData, service.coverImageMimeType)
        if (processed.data.byteLength < before) {
          service.coverImageData = processed.data
          service.coverImageMimeType = processed.mimeType
          dirty = true
          coversReprocessed++
          this.logger.info(`service ${service.id} — cover ${before} -> ${processed.data.byteLength} bytes`)
        }
      }

      if (dirty) await service.save()
    }

    this.logger.success(`${logosReprocessed} logo(s) et ${coversReprocessed} couverture(s) recompressé(s)`)
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
