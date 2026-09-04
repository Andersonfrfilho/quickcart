/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { useMemo, useState } from 'react'
import { useUser } from '@adatechnology/user-ui'
import { CustomerDetail, CustomerList, CustomersProvider } from '@adatechnology/customers-ui'

import { createQuickCartCustomersApi } from '@/modules/customers/shared/customersApi'
import type { QuickCartRole } from '@/modules/auth/shared/roles.constant'

/**
 * Cadastro de clientes, inteiro do pacote — não há tabela nem formulário escritos aqui.
 *
 * O que o QuickCart põe é o cliente HTTP (que carrega o token) e o papel de quem está olhando. A
 * ficha desenha documentos e campos a partir do catálogo configurado, e por isso a mesma tela serve
 * a uma loja que não guarda CPF e a outra que guarda.
 */
export function AdminCustomersPage() {
  const { user } = useUser()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const api = useMemo(() => createQuickCartCustomersApi(user?.role as QuickCartRole | undefined), [user?.role])

  return (
    <CustomersProvider api={api}>
      <div className="flex flex-col gap-6 p-4 desktop:flex-row">
        <div className="flex-1">
          <h1 className="mb-4 text-xl font-semibold">Clientes</h1>
          <CustomerList onSelect={(customer) => setSelectedId(customer.id)} />
        </div>

        {selectedId ? (
          <aside className="w-full desktop:max-w-md">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setSelectedId(undefined)}
                className="mb-3 text-sm text-gray-500 hover:text-gray-700"
              >
                Fechar
              </button>
              <CustomerDetail customerId={selectedId} />
            </div>
          </aside>
        ) : null}
      </div>
    </CustomersProvider>
  )
}
