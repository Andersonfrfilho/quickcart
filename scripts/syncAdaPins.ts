/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Alinha os pins de `@adatechnology/*` com o que está publicado sob a dist-tag `rc`.
 *
 * Existe porque o monorepo de pacotes publica em modo prerelease: cada merge para `main` sobe
 * `rc+1` de todo pacote com changeset pendente. Os pins daqui são exatos de propósito — build
 * reproduzível — e por isso ficam para trás sozinhos.
 *
 * E ficar para trás não avisa. `conversations-ui@rc.20` resolve e instala; só não tem os exports
 * que o código daqui importa, e o app não monta com a raiz vazia e o console limpo. O sintoma não
 * aponta para a causa, então a checagem tem de ser explícita.
 *
 *   bun run scripts/syncAdaPins.ts          # relatório, não escreve nada
 *   bun run scripts/syncAdaPins.ts --write  # aplica
 *
 * Alcance: pega desvio de VERSÃO, e só de dependência já fixada num `-rc.`. Não pega conteúdo novo
 * publicado sob a MESMA versão — que não deveria existir, e quando existe é bump esquecido no
 * monorepo de pacotes, não coisa que o consumidor possa detectar.
 */

const SCOPE = '@adatechnology/'
const MANIFESTS = ['apps/api-quickcart', 'apps/worker-quickcart', 'apps/frontend-web'] as const

type PinChange = {
  readonly manifest: string
  readonly name: string
  readonly from: string
  readonly to: string
}

async function resolveRcVersion(name: string): Promise<string | undefined> {
  const response = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`)
  // 404 aqui significa "nunca publicado" — e é um estado real: pacote criado num branch que ainda
  // não mergeou nunca passou pelo CI. Distinguir de erro de rede importa para o relatório.
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`${name}: registry respondeu ${response.status}`)

  const body = (await response.json()) as { 'dist-tags'?: Record<string, string> }
  return body['dist-tags']?.rc
}

async function main(): Promise<void> {
  const shouldWrite = process.argv.includes('--write')
  const changes: PinChange[] = []
  const missing: string[] = []

  for (const manifest of MANIFESTS) {
    const path = `${manifest}/package.json`
    const file = Bun.file(path)
    if (!(await file.exists())) continue

    const raw = await file.text()
    const parsed = JSON.parse(raw) as { dependencies?: Record<string, string> }
    let updated = raw

    for (const [name, pinned] of Object.entries(parsed.dependencies ?? {})) {
      if (!name.startsWith(SCOPE)) continue
      // Só quem JÁ está num prerelease anda no trem do rc. `fiscal-provider: ^0.2.0` e
      // `object-storage-provider: 0.1.1` estão em versão estável por escolha, e arrastá-los para
      // um rc seria trocar release testada por candidata sem ninguém pedir.
      if (!pinned.includes('-rc.')) continue

      const published = await resolveRcVersion(name)
      if (!published) {
        missing.push(`${name}@${pinned} (${manifest})`)
        continue
      }
      if (published === pinned) continue

      changes.push({ manifest, name, from: pinned, to: published })
      updated = updated.replace(`"${name}": "${pinned}"`, `"${name}": "${published}"`)
    }

    if (shouldWrite && updated !== raw) await Bun.write(path, updated)
  }

  for (const change of changes) {
    console.log(`  ${change.name}  ${change.from} → ${change.to}  (${change.manifest})`)
  }
  for (const entry of missing) {
    console.log(`  AUSENTE DO REGISTRY: ${entry}`)
  }

  if (changes.length === 0 && missing.length === 0) {
    console.log('  pins alinhados com a tag rc')
    return
  }
  if (shouldWrite) {
    console.log('\nRode `bun install` e depois o typecheck: versão nova pode ter mudado assinatura.')
    return
  }
  console.log('\nRelatório apenas. Use --write para aplicar.')
  // Falha para o CI poder usar isto como gate: pin desalinhado é build que não reproduz.
  process.exitCode = 1
}

await main()
