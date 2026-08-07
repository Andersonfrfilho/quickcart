# Push sem app nativo

**Push não exige app.** O `@adatechnology/push-provider` monta o bloco `webpush` no mesmo
`messaging().send()` do FCM, e o `DEVICE_PLATFORM` do contrato já aceita `web` ao lado de `ios` e
`android`. O PWA do quickcart (`vite-plugin-pwa`) é destino válido.

## O que muda por plataforma

| Onde | App? | Exigência |
|---|---|---|
| Chrome, Edge, Firefox no desktop | não | service worker + permissão do usuário + chave VAPID |
| Android no navegador | não | idem |
| **iPhone / Safari** | não, mas | só entrega para **PWA instalado** na tela inicial (iOS 16.4+). No Safari aberto pela URL, não chega |
| App nativo | sim | aí o driver Expo ou FCM mobile entra |

A restrição do iOS não é do SDK: é da Apple. Vale saber antes de prometer push a quem usa iPhone —
"instale na tela inicial" precisa fazer parte do fluxo, ou o canal simplesmente não entrega para
metade da base.

## O que falta para ligar

Duas credenciais que não estão no repositório e não devem estar:

1. **Projeto Firebase** com Cloud Messaging habilitado, para obter a service account do lado do
   servidor (`FcmPushProvider`) e a config web do lado do navegador.
2. **Par de chaves VAPID** do projeto, para o `pushManager.subscribe` do service worker.

Com as duas, o caminho é:

- Service worker registra e obtém o token (`getToken` do FCM JS SDK, com a chave VAPID)
- O front chama `POST /v1/notification-devices` com `{ platform: 'web', driver: 'fcm', token }`
- O canal `push` passa a ser planejado pelo fan-out para quem tem device ativo

O módulo já trata a parte que costuma dar errado: token morto volta como `invalid-target` e o device
é **desativado**, em vez de a fila insistir para sempre num aparelho que não existe mais.

## Estado

Não exercitado ponta a ponta. O `push-provider` tem 14 testes, incluindo o bloco `webpush`, mas
nenhum token real e nenhuma notificação chegando num aparelho — então o canal está implementado e
**não provado**. É a única lacuna da Fase 7 que depende de credencial externa.
