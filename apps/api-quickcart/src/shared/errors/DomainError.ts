/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Classe base para erros de domínio. Cada módulo estende esta classe para criar
 * seus próprios tipos de erro (ex: CatalogError, OrderError), preservando
 * `instanceof` confiável e contexto extra (`details`) sem comparação de string.
 */

import { AppError } from './AppError.error'

export class DomainError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code: string,
    public readonly domain: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message, statusCode, code)
    this.name = 'DomainError'
  }
}
