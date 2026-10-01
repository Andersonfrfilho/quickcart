import { test, expect } from 'bun:test'
import { ViaCepAddressLookupProvider } from '@/infra/viacep/ViaCepAddressLookupProvider'
import { NominatimGeocodingProvider } from '@/infra/nominatim/NominatimGeocodingProvider'
import { SeedOfflineAddressLookupProvider, SeedOfflineGeocodingProvider } from '@/infra/database/seeds/SeedOfflineAddressProviders'

test('seed usa provedores offline, nao os reais que chamam fetch', async () => {
  const originalFetch = global.fetch
  let fetchCalled = false
  // @ts-expect-error stub hostil: qualquer chamada de rede aqui prova que o provedor real vazou para a seed
  global.fetch = (...args: unknown[]) => { fetchCalled = true; throw new Error('REDE CHAMADA: ' + JSON.stringify(args)) }
  try {
    const addressProvider = new SeedOfflineAddressLookupProvider()
    const geocodeProvider = new SeedOfflineGeocodingProvider()

    const address = await addressProvider.lookupByCep('01310-100')
    expect(address).toBeDefined()
    const geo = await geocodeProvider.geocodeByCep('01310-100')
    expect(geo.kind).toBe('found')

    // Os stubs da seed nunca tocaram `fetch` — é isso que prova que não há rede no caminho da seed.
    expect(fetchCalled).toBe(false)

    // Sanidade: prova que o `fetch` hostil de fato pegaria os provedores REAIS, se eles fossem usados.
    // Ambos engolem o próprio erro (nunca lançam) e devolvem "não achei" — é o `fetchCalled` que denuncia.
    const realAddress = new ViaCepAddressLookupProvider()
    const realGeo = new NominatimGeocodingProvider()
    const realAddressResult = await realAddress.lookupByCep('01310-100')
    const realGeoResult = await realGeo.geocodeByCep('01310-100')
    expect(realAddressResult).toBeUndefined()
    expect(realGeoResult.kind).not.toBe('found')
    expect(fetchCalled).toBe(true)
  } finally {
    global.fetch = originalFetch
  }
})
