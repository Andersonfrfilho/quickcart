/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Instância própria do worker, espelhando
 * apps/api-quickcart/src/modules/webhook/infra/storage/objectStorageAdapter.ts — mesma convenção já
 * usada em queues.constant.ts e whatsapp/provider.ts: processos separados não compartilham
 * instância em memória, e cada app lê o próprio ambiente validado.
 *
 * A ponte existe porque o `ObjectStorageInterface` do módulo pede
 * `upload({ buffer, mimeType, key }) -> { uploadId }` e o provider é endereçado por bucket + key
 * com `sha256` e `contentLength` obrigatórios. O `uploadId` é a própria key, então o download não
 * precisa de tabela de tradução.
 */

import { createHash } from 'node:crypto'
import type { ObjectStorageInterface } from '@adatechnology/meta-whatsapp-contracts'
import { createObjectStorageProvider } from '@adatechnology/object-storage-provider'
import { environment } from '@/infra/config/environment'

export function createWorkerObjectStorage(): ObjectStorageInterface {
  const provider = createObjectStorageProvider({
    endpoint: new URL(environment.STORAGE_ENDPOINT),
    region: environment.STORAGE_REGION,
    accessKeyId: environment.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: environment.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: environment.STORAGE_FORCE_PATH_STYLE,
    healthCheckBucket: environment.STORAGE_BUCKET,
    maxObjectSizeBytes: environment.STORAGE_MAX_OBJECT_SIZE_BYTES,
  })

  return {
    async upload({ buffer, mimeType, key }) {
      await provider.put({
        bucket: environment.STORAGE_BUCKET,
        key,
        body: new Uint8Array(buffer),
        contentLength: buffer.length,
        contentType: mimeType,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        // Reentrega do job não sobrescreve: o provider devolve 'replayed' e o objeto original fica.
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
}
