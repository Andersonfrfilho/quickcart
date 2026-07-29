/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Popula o contato "Teste de Mídia" com um arquivo de cada tipo aceito.
 *
 * Faz o mesmo que a ingestão real faria depois do webhook — sobe o binário no storage, referencia o
 * `uploadId` no payload da mensagem e linka o documento na conversa —, só que sem passar pela Meta.
 * Reproduzir esses três passos é o que faz o contato se comportar como um cliente de verdade: a
 * bolha carrega a mídia, o painel de arquivos lista, e a tela de Documentos encontra.
 *
 * Idempotente: a key do objeto e o `waMessageId` derivam do índice, então rodar o seed de novo
 * reaproveita o mesmo objeto e não duplica mensagem.
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'
import { environment } from '@/infra/config/environment'
import { logger } from '@/shared/logger'
import { quickCartObjectStorage } from '@/modules/webhook/infra/whatsapp/metaWhatsAppModule'
import {
  MEDIA_SEED_ITEMS,
  MEDIA_SEED_NAME,
  MEDIA_SEED_NUMBER,
  mediaSeedId,
  type MediaSeedItem,
} from './MediaConversationSeed'

const log = logger.child('MediaConversationSeed')
const SAMPLES_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), 'media-samples')

function storageKeyFor(mediaId: string): string {
  return `meta-whatsapp/${environment.WHATSAPP_COMPANY_ID}/inbound/${mediaId}`
}

/** O payload da Meta para a espécie, com o que a ingestão acrescenta depois de copiar o binário. */
function mediaPayload(
  item: MediaSeedItem,
  mediaId: string,
  uploadId: string,
  sizeBytes: number,
): Record<string, unknown> {
  const media: Record<string, unknown> = { id: mediaId, mime_type: item.mimeType }
  if (item.filename) media['filename'] = item.filename
  if (item.caption) media['caption'] = item.caption

  return {
    [item.kind]: media,
    uploadId,
    sourceMediaId: mediaId,
    mimeType: item.mimeType,
    sizeBytes,
    ...(item.filename ? { filename: item.filename } : {}),
  }
}

export async function seedMediaConversation(metaWhatsApp: MetaWhatsAppModule): Promise<void> {
  if (!quickCartObjectStorage) {
    log.warn('media_seed_skipped', { reason: 'storage_disabled' })
    return
  }

  const companyId = environment.WHATSAPP_COMPANY_ID

  await metaWhatsApp.conversations.log.execute({
    companyId,
    whatsappNumber: MEDIA_SEED_NUMBER,
    startState: 'greeting',
    direction: 'inbound',
    sender: 'customer',
    type: 'text',
    content: 'segue tudo que eu tenho aqui',
    waMessageId: `wamid.seed.media.${MEDIA_SEED_NUMBER}.opener`,
  })

  const session = await metaWhatsApp.conversations.repository.getContext(companyId, MEDIA_SEED_NUMBER)
  if (!session) throw new Error('Sessão do contato de mídia não foi criada')

  for (const [index, item] of MEDIA_SEED_ITEMS.entries()) {
    const mediaId = mediaSeedId(index)
    const buffer = await readFile(join(SAMPLES_DIRECTORY, item.sample))
    const { uploadId } = await quickCartObjectStorage.forModule.upload({
      buffer,
      mimeType: item.mimeType,
      key: storageKeyFor(mediaId),
    })

    const message = await metaWhatsApp.conversations.log.execute({
      companyId,
      whatsappNumber: MEDIA_SEED_NUMBER,
      startState: 'greeting',
      direction: 'inbound',
      sender: 'customer',
      type: item.kind,
      ...(item.caption ? { content: item.caption } : {}),
      payload: mediaPayload(item, mediaId, uploadId, buffer.length),
      waMessageId: `wamid.seed.media.${MEDIA_SEED_NUMBER}.${index}`,
    })

    await metaWhatsApp.conversations.documentRepository.link({
      companyId,
      sessionId: session.id,
      ...(message ? { messageId: message.id } : {}),
      uploadId,
      // Sem nome, o rótulo é o id da mídia — exatamente o que a tela real mostra para foto e áudio.
      filename: item.filename ?? mediaId,
      mimeType: item.mimeType,
      sizeBytes: buffer.length,
      source: 'customer',
    })
  }

  // Fecha com texto: a prévia da inbox mostra o último conteúdo, e mídia não tem texto — terminar
  // num arquivo deixava a linha do contato em branco, com cara de conversa quebrada.
  await metaWhatsApp.conversations.log.execute({
    companyId,
    whatsappNumber: MEDIA_SEED_NUMBER,
    startState: 'greeting',
    direction: 'inbound',
    sender: 'customer',
    type: 'text',
    content: `mandei ${MEDIA_SEED_ITEMS.length} arquivos, um de cada tipo`,
    waMessageId: `wamid.seed.media.${MEDIA_SEED_NUMBER}.closer`,
  })

  await metaWhatsApp.conversations.repository.setState(companyId, MEDIA_SEED_NUMBER, 'greeting', {
    customerName: MEDIA_SEED_NAME,
  })

  log.info('media_seed_completed', { arquivos: MEDIA_SEED_ITEMS.length, numero: MEDIA_SEED_NUMBER })
}
