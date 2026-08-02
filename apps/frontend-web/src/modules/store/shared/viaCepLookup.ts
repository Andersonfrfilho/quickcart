/**
 * Busca rua/bairro/cidade/UF a partir do CEP, para o cliente digitar menos no checkout.
 *
 * ViaCEP é público, sem chave e devolve endereço (mas não coordenada — spec de distância/ETA em
 * .specs/features/delivery-distance/spec.md §4.1). A geocodificação em si é responsabilidade do
 * backend, na Fase 3; aqui só preenche o formulário.
 *
 * CEP que não resolve NÃO trava o cliente: retorna `undefined` e o checkout continua com os campos
 * manuais, vazios para preencher (spec §8 Q1) — nunca com erro bloqueando o fluxo.
 */
export type ViaCepAddress = {
  readonly street: string
  readonly neighborhood: string
  readonly city: string
  readonly state: string
}

type ViaCepResponse = {
  readonly erro?: boolean
  readonly logradouro?: string
  readonly bairro?: string
  readonly localidade?: string
  readonly uf?: string
}

export async function lookupAddressByCep(cep: string): Promise<ViaCepAddress | undefined> {
  const digitsOnly = cep.replace(/\D/g, '')
  if (digitsOnly.length !== 8) return undefined

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digitsOnly}/json/`)
    if (!response.ok) return undefined

    const data = (await response.json()) as ViaCepResponse
    // CEP genérico ou inexistente: ViaCEP responde 200 com `{ erro: true }`, não um status de erro.
    if (data.erro) return undefined

    return {
      street: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return undefined
  }
}
