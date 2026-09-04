/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import type { CustomersApi } from '@adatechnology/customers-ui'

import { apiClient } from '@/shared/api/client'
import { QUICKCART_ROLE } from '@/modules/auth/shared/roles.constant'
import type { QuickCartRole } from '@/modules/auth/shared/roles.constant'

/**
 * O que o pacote sabe fazer é o que este objeto implementa — capacidade por ausência.
 *
 * Quem não tem escopo de escrita recebe um cliente SEM `createCustomer`, e a tela não desenha o
 * botão. Isto não substitui a autorização, que é da API: esconder o botão poupa o operador de um
 * 403, e a API recusa de qualquer jeito se alguém chamar a rota na mão (`web.md` §11).
 */
export function createQuickCartCustomersApi(role: QuickCartRole | undefined): CustomersApi {
  const canWrite = role === QUICKCART_ROLE.ADMIN || role === QUICKCART_ROLE.ATTENDANT
  const canConfigure = role === QUICKCART_ROLE.ADMIN

  const base: CustomersApi = {
    async listCustomers(params) {
      const { data } = await apiClient.get('/v1/customers', { params })
      return data
    },
    async getCustomer(id) {
      const { data } = await apiClient.get(`/v1/customers/${id}`)
      return data.data
    },
    async getSettings() {
      const { data } = await apiClient.get('/v1/customer-settings')
      return data.data
    },
  }

  return {
    ...base,
    ...(canWrite
      ? {
          async createCustomer(input) {
            const { data } = await apiClient.post('/v1/customers', input)
            return data.data
          },
          async updateCustomer(id, input) {
            await apiClient.patch(`/v1/customers/${id}`, input)
          },
          async setDocument(id, document) {
            await apiClient.put(`/v1/customers/${id}/documents`, document)
          },
          async addAddress(id, address) {
            const { data } = await apiClient.post(`/v1/customers/${id}/addresses`, address)
            return data.data
          },
          async updateAddress(id, addressId, address) {
            const { data } = await apiClient.patch(`/v1/customers/${id}/addresses/${addressId}`, address)
            return data.data
          },
          async removeAddress(id, addressId) {
            await apiClient.delete(`/v1/customers/${id}/addresses/${addressId}`)
          },
        }
      : {}),
    ...(canConfigure
      ? {
          async updateSettings(input) {
            const { data } = await apiClient.put('/v1/customer-settings', input)
            return data.data
          },
        }
      : {}),
  }
}
