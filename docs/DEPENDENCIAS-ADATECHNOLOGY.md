# Dependências `@adatechnology/*`

Os pacotes vêm do monorepo `adatechnology-packages`, publicados no npm pelo CI dele a cada push
para `main`. Aqui os pins são **exatos** de propósito: build reproduzível.

O monorepo publica em **modo prerelease**. Cada merge para `main` lá sobe `rc+1` de todo pacote com
changeset pendente. Os pins daqui, sendo exatos, ficam para trás sozinhos.

```bash
make ada-pins        # confere; falha se algum pin estiver atrás da tag rc
make ada-pins-write  # alinha, depois rode `bun install` e o typecheck
```

## Por que a checagem precisa ser explícita

**Pin atrasado não dá erro de instalação.** `conversations-ui@0.1.0-rc.20` resolve e instala; só não
tem os exports que o código daqui importa. O resultado é a raiz do React vazia, console limpo e
nenhuma pista — o sintoma não aponta para a causa. Descobrir exige importar o módulo à mão no
console do navegador.

O `make ada-pins` transforma isso em uma linha de saída.

## Estado conhecido (2026-08-04)

**`@adatechnology/audio-transcription-provider@0.1.0-rc.0` não existe no registry.** O pacote foi
criado no branch `feat/audio-transcription` do monorepo, que **não mergeou** — então o CI de lá
nunca o viu, e nunca o publicou. Mas o código daqui já o importa
(`modules/webhook/infra/transcription/transcriberAdapter.ts`).

Consequência: **`bun install` falha numa máquina limpa.** Funciona nas máquinas de desenvolvimento
por um symlink manual para `../adatechnology-packages/packages/backend/audio-transcription-provider`
— que não está no repositório e não sobrevive a um clone.

Não há CI neste repositório, então nada mais pega isso.

Resolve quando aquele branch merjar: o CI publicará `0.1.0-rc.1`. Aí `make ada-pins-write` acerta o
pin. Antes disso, o pin `rc.0` continuará 404 mesmo depois da publicação — a versão publicada será
`rc.1`, e `rc.0` nunca vai existir.

Mesma situação, sem o 404, em `conversations-ui` e `meta-whatsapp-contracts`: o branch tem exports
novos (`useScrollToLatestMessage`, `PREVIEW_MEDIA_ID_PREFIX`) sob a **mesma** versão publicada.
Instalar do registry hoje derruba o frontend.

## Desenvolver contra pacote não publicado

Enquanto o pacote não está no registry, aponte para o tarball local — **sem commitar**:

```bash
cd ../adatechnology-packages/packages/backend/<pacote> && pnpm pack --pack-destination /tmp
```

E no `package.json` da raiz, `overrides` para `file:/tmp/<tarball>.tgz`.

Use `pnpm pack`, nunca `npm pack`: o npm deixa `workspace:*` literal no `dependencies` do tarball, e
o install quebra com `EUNSUPPORTEDPROTOCOL`.

Depois de trocar vários pacotes assim, o cache de dependências do Vite fica inconsistente
(`does not provide an export named 'default'` em pacote CJS). Apague `node_modules/.vite`.
