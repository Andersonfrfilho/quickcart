/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Teste manual de mídia. A tela inteira é do SDK — aqui só se escolhe a rota, porque a bancada tem
 * de ser a MESMA em todo projeto que adote o pacote: se cada host montasse a sua, cada um cobriria
 * um subconjunto diferente de tipos e o buraco apareceria em produção.
 */

import '@adatechnology/conversations-ui/styles.css'
import { MediaTypesPreview } from '@adatechnology/conversations-ui/preview'

export function MediaPreviewPage() {
  return <MediaTypesPreview className="min-h-screen bg-background" />
}
