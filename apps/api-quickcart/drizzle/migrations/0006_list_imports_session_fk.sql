-- Reaponta a FK de list_imports para a tabela de sessão que está de fato em uso.
--
-- A 0005 mudou a persistência de sessão para meta_whatsapp.sessions e preservou os ids justamente
-- para não invalidar list_imports.session_id — mas deixou a FK apontando para public.conversation_
-- sessions, que parou de receber linha nova. Efeito: TODA importação de lista falha no insert por
-- violação de chave estrangeira, tanto a que vem do botão "Enviar lista" quanto a de lista ditada.
-- O erro só aparecia no log do servidor, então da parte do cliente a lista simplesmente não
-- acontecia.
--
-- Como os ids foram preservados, reapontar é suficiente: nenhum dado precisa ser reescrito.
--
-- NOT VALID de propósito. A checagem imediata varreria o histórico inteiro, e uma linha antiga que
-- referencie sessão apagada antes de a FK existir derrubaria o deploy por causa de dado que ninguém
-- mais lê. A regra vale para toda linha nova, que é o que importa aqui. Para exigir também do
-- passado, depois de conferir que não há órfã:
--
--   ALTER TABLE public.list_imports VALIDATE CONSTRAINT list_imports_session_id_sessions_id_fk;
--
-- public.conversation_sessions continua de pé e intacta, como a 0005 deixou: o DROP das tabelas
-- antigas é decisão separada, e não a tomo de carona numa correção.

ALTER TABLE public.list_imports
  DROP CONSTRAINT IF EXISTS list_imports_session_id_conversation_sessions_id_fk;

ALTER TABLE public.list_imports
  ADD CONSTRAINT list_imports_session_id_sessions_id_fk
  FOREIGN KEY (session_id) REFERENCES meta_whatsapp.sessions(id) ON DELETE SET NULL NOT VALID;
