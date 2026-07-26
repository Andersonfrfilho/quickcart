-- Copia as conversas de public.* para o schema meta_whatsapp, que passou a ser dono da
-- persistência de sessão e mensagem (@adatechnology/meta-whatsapp-module).
--
-- Deliberadamente NÃO destrutiva: as tabelas antigas ficam de pé e intactas. É isso que torna
-- a mudança reversível sem down-migration — se for preciso voltar, basta reimplantar o código
-- anterior, que volta a ler public.*. Um DROP das tabelas antigas fica para uma migration
-- futura, depois de a nova leitura estar confirmada em produção.
--
-- Idempotente: ON CONFLICT DO NOTHING em ambos os inserts, então reexecutar não duplica nem
-- sobrescreve o que já foi gravado pelo tráfego novo.
--
-- Os ids são preservados de propósito: list_imports.session_id e os jobs de STT já enfileirados
-- carregam o id antigo da sessão, e regerá-los deixaria essas referências apontando para o nada.

DO $$
DECLARE
  -- Tenant único do QuickCart. Precisa bater com WHATSAPP_COMPANY_ID (mesmo default em
  -- infra/config/environment.ts). Se esse valor for sobrescrito no ambiente ANTES deste
  -- deploy, as linhas copiadas aqui ficam sob a empresa errada e somem da aplicação.
  single_tenant_company_id uuid := '00000000-0000-4000-8000-000000000001';
BEGIN
  IF to_regclass('public.conversation_sessions') IS NULL THEN
    RAISE NOTICE 'public.conversation_sessions ausente — nada a copiar';
    RETURN;
  END IF;

  INSERT INTO meta_whatsapp.sessions (
    id, company_id, whatsapp_number, current_state, context, mode,
    last_activity, created_at, updated_at
  )
  SELECT
    old_session.id,
    single_tenant_company_id,
    old_session.customer_phone,
    old_session.current_state,
    old_session.context,
    old_session.mode,
    old_session.last_interaction_at,
    old_session.created_at,
    old_session.updated_at
  FROM public.conversation_sessions AS old_session
  ON CONFLICT DO NOTHING;

  IF to_regclass('public.messages') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO meta_whatsapp.messages (
    id, company_id, session_id, whatsapp_number, direction, sender,
    type, content, payload, wa_message_id, status, created_at
  )
  SELECT
    old_message.id,
    single_tenant_company_id,
    old_message.session_id,
    -- O número é desnormalizado na mensagem no schema novo; vem da sessão dona dela.
    old_session.customer_phone,
    old_message.direction,
    -- O QuickCart nunca teve atendimento humano: entrada é cliente, saída é bot.
    CASE WHEN old_message.direction = 'inbound' THEN 'customer' ELSE 'bot' END,
    old_message.type,
    -- `body` virou `content`.
    old_message.body,
    old_message.payload,
    old_message.wa_message_id,
    old_message.status,
    old_message.created_at
  FROM public.messages AS old_message
  -- INNER JOIN: mensagem órfã (sessão apagada) não tem número para desnormalizar e não pode
  -- satisfazer o NOT NULL de whatsapp_number. A FK antiga era ON DELETE CASCADE, então na
  -- prática não existem — o join é a rede de proteção, não um filtro esperado.
  JOIN public.conversation_sessions AS old_session ON old_session.id = old_message.session_id
  ON CONFLICT DO NOTHING;
END $$;
