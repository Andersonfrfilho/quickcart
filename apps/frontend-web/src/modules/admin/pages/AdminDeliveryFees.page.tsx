/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 */

import { useAdminDeliveryFeesPage } from '@/modules/admin/hooks/useAdminDeliveryFeesPage.hook'
import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'

export function AdminDeliveryFeesPage() {
  const {
    isReady,
    isLoading,
    draftTiers,
    rowErrors,
    generalError,
    outOfRangeWarning,
    canAddRow,
    isSaving,
    updateRow,
    addRow,
    removeRow,
    save,
  } = useAdminDeliveryFeesPage()

  if (!isReady) return null

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faixas de entrega</h1>
        <p className="text-muted-foreground">
          Cada linha é "até quantos km" e a taxa cobrada até ali. A primeira faixa começa em 0 km; cada
          faixa seguinte vai até onde a anterior parou.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Até (km)</TableHead>
                  <TableHead>Taxa (R$)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftTiers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Sem faixas — a loja só entrega por retirada.
                    </TableCell>
                  </TableRow>
                )}
                {draftTiers.map((row, index) => {
                  const errors = rowErrors.get(index) ?? []
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-8 w-24"
                          value={row.maxDistanceKmText}
                          onChange={(e) => updateRow(index, { maxDistanceKmText: e.target.value })}
                          aria-label={`Até quantos km, linha ${index + 1}`}
                          aria-invalid={errors.length > 0}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-8 w-24"
                          value={row.feeInReaisText}
                          onChange={(e) => updateRow(index, { feeInReaisText: e.target.value })}
                          aria-label={`Taxa em reais, linha ${index + 1}`}
                          aria-invalid={errors.length > 0}
                        />
                        {errors.length > 0 && (
                          <p className="mt-1 text-xs text-destructive">{errors.join(' ')}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeRow(index)}>
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{outOfRangeWarning}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={!canAddRow} onClick={addRow}>
              Adicionar faixa
            </Button>
            {!canAddRow && (
              <span className="text-xs text-muted-foreground">Máximo de 10 faixas.</span>
            )}
          </div>

          {generalError && <p className="text-sm text-destructive">{generalError}</p>}

          <Button disabled={isSaving} onClick={save}>
            {isSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      )}
    </div>
  )
}
