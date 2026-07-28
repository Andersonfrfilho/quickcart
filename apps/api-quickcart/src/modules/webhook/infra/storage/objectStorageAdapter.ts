/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Ponte entre o `ObjectStorageInterface` do meta-whatsapp-module e o
 * `@adatechnology/object-storage-provider`. Os dois não falam a mesma língua: o módulo pede
 * `upload({ buffer, mimeType, key }) -> { uploadId }` e o provider é endereçado por bucket + key
 * com `sha256` e `contentLength` obrigatórios, no espírito de armazenamento por conteúdo.
 *
 * O `uploadId` que o módulo guarda é a própria key — assim o download não precisa de tabela de
 * tradução, e reingestão da mesma mídia cai na mesma key (o provider responde
 * `disposition: 'replayed'` em vez de duplicar o objeto).
 */

import { createHash } from 'node:crypto'
import type { ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import { createObjectStorageProvider, type ObjectStorageProvider } from '@adatechnology/object-storage-provider'
import { environment } from '@/infra/config/environment'

export type QuickCartObjectStorage = {
  readonly forModule: ObjectStorageInterface
  readonly provider: ObjectStorageProvider
}

export function createQuickCartObjectStorage(): QuickCartObjectStorage {
  const provider = createObjectStorageProvider({
    endpoint: new URL(environment.STORAGE_ENDPOINT),
    region: environment.STORAGE_REGION,
    accessKeyId: environment.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: environment.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: environment.STORAGE_FORCE_PATH_STYLE,
    healthCheckBucket: environment.STORAGE_BUCKET,
    maxObjectSizeBytes: environment.STORAGE_MAX_OBJECT_SIZE_BYTES,
  })

  const forModule: ObjectStorageInterface = {
    async upload({ buffer, mimeType, key }) {
      await provider.put({
        bucket: environment.STORAGE_BUCKET,
        key,
        body: new Uint8Array(buffer),
        contentLength: buffer.length,
        contentType: mimeType,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        // Mesma mídia reentregue não sobrescreve: o provider devolve 'replayed' e o objeto
        // original fica intacto.
        mode: 'create-only',
      })

      return { uploadId: key }
    },


    // Idempotente por contrato: apagar o que já não existe não é erro, e o job de retenção repete.
    async delete(uploadId) {
      await provider.delete({ bucket: environment.STORAGE_BUCKET, key: uploadId })
    },

    async getDownloadUrl(uploadId, options) {
      const url = await provider.createSignedDownload({
        bucket: environment.STORAGE_BUCKET,
        key: uploadId,
        expiresInSeconds: options?.expiresInSeconds ?? environment.STORAGE_DOWNLOAD_URL_TTL_SECONDS,
        ...(options?.disposition ? { disposition: options.disposition } : {}),
        ...(options?.filename ? { filename: options.filename } : {}),
      })

      return url.toString()
    },
  }

  return { forModule, provider }
}
