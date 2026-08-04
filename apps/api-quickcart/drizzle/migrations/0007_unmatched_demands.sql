-- Guarda o que os clientes pediram e a loja não tinha.
--
-- Até aqui esse dado nascia e morria numa mensagem ("não encontrei: ovos"). É o único dado que o bot
-- produz para o LOJISTA e não para o cliente, e nenhuma outra fonte tem: não está no histórico de
-- vendas justamente porque a venda não aconteceu.
--
-- Uma linha por pedido de um cliente, não um contador por termo. Contador responde "quantas vezes", que
-- é a pergunta fácil; decidir passar a vender exige saber se são dez pessoas ou uma pessoa dez vezes, e
-- quando foi a última — informação que um contador já jogou fora.

CREATE TABLE IF NOT EXISTS "unmatched_demands" (
  "id" uuid PRIMARY KEY NOT NULL,
  -- Normalizado (minúsculo, sem acento) para agrupar: "Açúcar" e "acucar" são o mesmo pedido, e sem
  -- isso o relatório mostraria três linhas de um item, fazendo o lojista subestimar a demanda maior.
  "term" varchar(120) NOT NULL,
  "raw_term" text NOT NULL,
  "customer_id" uuid,
  "source" varchar(24) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- `set null`, não `cascade`: a demanda continua sendo verdade sobre o catálogo depois de o cliente
-- sair, e apagá-la junto reescreveria o passado da loja.
DO $$
BEGIN
  ALTER TABLE "unmatched_demands"
    ADD CONSTRAINT "unmatched_demands_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- O relatório agrupa por termo e ordena por data; sem índice ele varre a tabela inteira.
CREATE INDEX IF NOT EXISTS "unmatched_demands_term_idx" ON "unmatched_demands" ("term");
CREATE INDEX IF NOT EXISTS "unmatched_demands_created_at_idx" ON "unmatched_demands" ("created_at");
