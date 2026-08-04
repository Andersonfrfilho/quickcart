/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Contato de seed com um arquivo de cada tipo que a Meta aceita.
 *
 * É contato, e não tela de preview separada: quem precisa ver como um `.xlsx` ou um áudio aparecem
 * abre a conversa na inbox, do mesmo jeito que abriria a de um cliente real — nada de rota especial
 * que só existe em dev e que diverge da tela verdadeira na primeira mudança.
 *
 * Os bytes em `media-samples/` são arquivos mínimos porém legítimos: mídia gerada com ffmpeg e
 * conferida com ffprobe, PDF com xref/startxref/`%%EOF`, pacotes Office como zip com as partes
 * obrigatórias. Placeholder de texto rotulado `application/pdf` faria o leitor recusar o arquivo — e
 * o ponto do contato é justamente poder ABRIR cada tipo.
 */

export const MEDIA_SEED_NUMBER = '5511900000042'
export const MEDIA_SEED_NAME = 'Teste de Mídia'

export type MediaSeedItem = {
  /** Arquivo em `media-samples/`. */
  readonly sample: string
  readonly mimeType: string
  /** Ausente para imagem, áudio, vídeo e sticker: a Meta só manda nome em `document`. */
  readonly filename?: string
  /** Espécie da mídia no payload da Meta — decide como a bolha é desenhada. */
  readonly kind: 'image' | 'video' | 'audio' | 'document' | 'sticker'
  readonly caption?: string
}

export const MEDIA_SEED_ITEMS: readonly MediaSeedItem[] = [
  { sample: 'tiny.pdf', mimeType: 'application/pdf', filename: 'nota-fiscal.pdf', kind: 'document' },
  {
    sample: 'tiny.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename: 'contrato.docx',
    kind: 'document',
  },
  {
    sample: 'tiny.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'pedido.xlsx',
    kind: 'document',
  },
  { sample: 'tiny.txt', mimeType: 'text/plain', filename: 'lista-compras.txt', kind: 'document' },
  { sample: 'tiny.csv', mimeType: 'text/csv', filename: 'planilha.csv', kind: 'document' },
  { sample: 'tiny.zip', mimeType: 'application/zip', filename: 'comprovantes.zip', kind: 'document' },
  { sample: 'tiny.mp3', mimeType: 'audio/mpeg', filename: 'musica-do-anuncio.mp3', kind: 'document' },
  { sample: 'tiny.jpg', mimeType: 'image/jpeg', filename: 'foto-do-recibo.jpg', kind: 'document' },

  // Sem nome de arquivo daqui para baixo — como a Meta entrega. O rótulo na lista vira o id da
  // mídia, e é o mimeType que decide o ícone.
  { sample: 'tiny.png', mimeType: 'image/png', kind: 'image', caption: 'foto da prateleira' },
  { sample: 'tiny.jpg', mimeType: 'image/jpeg', kind: 'image' },
  { sample: 'tiny.webp', mimeType: 'image/webp', kind: 'sticker' },
  { sample: 'tiny.mp4', mimeType: 'video/mp4', kind: 'video' },
  { sample: 'tiny.ogg', mimeType: 'audio/ogg; codecs=opus', kind: 'audio' },
  { sample: 'tiny.m4a', mimeType: 'audio/mp4', kind: 'audio' },
  { sample: 'tiny.aac', mimeType: 'audio/aac', kind: 'audio' },
]

/** Id da mídia na Meta, determinístico: rodar o seed de novo reaproveita o mesmo objeto. */
export function mediaSeedId(index: number): string {
  return `seed-media-${String(index).padStart(2, '0')}`
}
