-- O elo entre a identidade de LOGIN (users, do user-module) e a identidade de COMPRA (customers,
-- cuja chave é o telefone do WhatsApp). São coisas diferentes: o cliente que só falou pelo WhatsApp
-- tem customer e não tem user; quem se cadastra na loja passa a ter os dois.
--
-- Nulo é o estado normal, não uma exceção: toda linha criada por conversa continua sem user, e é
-- assim que o histórico dela sobrevive — quando essa pessoa se cadastra com o MESMO telefone, o
-- cadastro adota a linha existente em vez de criar outra, e os pedidos antigos vêm junto.
--
-- Único porque um user é uma pessoa: dois customers apontando para o mesmo login fariam
-- "meus pedidos" mostrar metade do histórico, conforme qual linha a consulta escolhesse.
ALTER TABLE "customers" ADD COLUMN "user_id" uuid;

CREATE UNIQUE INDEX "customers_user_id_unique" ON "customers" ("user_id") WHERE "user_id" IS NOT NULL;
