/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { useMemo } from 'react'
import { useUser } from '@adatechnology/user-ui'
import { CustomerSettingsPage, CustomersProvider } from '@adatechnology/customers-ui'

import { createQuickCartCustomersApi } from '@/modules/customers/shared/customersApi'
import type { QuickCartRole } from '@/modules/auth/shared/roles.constant'

/** Quais documentos e campos a loja guarda. Só admin escreve; a API recusa o resto com 403. */
export function AdminCustomerSettingsPage() {
  const { user } = useUser()
  const api = useMemo(() => createQuickCartCustomersApi(user?.role as QuickCartRole | undefined), [user?.role])

  return (
    <CustomersProvider api={api}>
      <div className="p-4">
        <h1 className="mb-1 text-xl font-semibold">Configuração do cadastro</h1>
        <p className="mb-4 text-sm text-gray-500">
          O que a loja guarda de cada cliente. A mudança vale para as fichas novas e para as que já existem.
        </p>
        <CustomerSettingsPage />
      </div>
    </CustomersProvider>
  )
}
