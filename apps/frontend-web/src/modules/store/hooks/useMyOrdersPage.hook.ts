/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { useQuery } from '@tanstack/react-query'
import { useUser, SESSION_STATUS } from '@adatechnology/user-ui'
import React from 'react'

import { useRouter } from '@/app/router'
import { apiClient } from '@/shared/api/client'
import type { ApiListResponse, Order } from '@/shared/api/api.types'

const SIGN_IN_PATH = '/entrar'
const PER_PAGE = 20

export function useMyOrdersPage() {
  const { navigate } = useRouter()
  const { status } = useUser()
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    if (status === SESSION_STATUS.UNAUTHENTICATED) navigate(SIGN_IN_PATH)
  }, [status, navigate])

  const isAuthenticated = status === SESSION_STATUS.AUTHENTICATED

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', page],
    queryFn: () =>
      apiClient.get('/v1/store/orders', { params: { page, perPage: PER_PAGE } }) as Promise<ApiListResponse<Order>>,
    enabled: isAuthenticated,
  })

  return {
    isAuthenticated,
    isLoading,
    orders: data?.data ?? [],
    pagination: data?.pagination,
    page,
    setPage,
  }
}
