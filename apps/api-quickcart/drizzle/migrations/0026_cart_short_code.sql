-- Código próprio do carrinho (a "compra" antes de virar pedido).
--
-- O carrinho era invisível: até o checkout, cliente e balcão não tinham como se referir à mesma
-- lista. Com o código, "continuar a LC-1042" e "essa é outra compra" viram a mesma frase dos dois
-- lados — e é ele que muda quando o cliente escolhe começar do zero.
--
-- Sequence, e não contador em aplicação, pelo mesmo motivo de `order_short_code_seq`: dois
-- carrinhos abertos ao mesmo tempo precisam de códigos distintos sem lock explícito.
CREATE SEQUENCE IF NOT EXISTS "cart_short_code_seq" START WITH 1000 INCREMENT BY 1;
--> statement-breakpoint

-- varchar(12), e não 8 como em `orders`: carrinho abandonado também consome número, então a
-- sequence anda bem mais rápido que a de pedidos e 'LC-' + 5 dígitos acabaria antes da hora.
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "short_code" varchar(12);
--> statement-breakpoint

-- Carrinho que já existe ganha código agora — inclusive os abertos, que o cliente ainda vai retomar.
UPDATE "carts" SET "short_code" = 'LC-' || nextval('cart_short_code_seq')::text WHERE "short_code" IS NULL;
--> statement-breakpoint

ALTER TABLE "carts" ALTER COLUMN "short_code" SET DEFAULT ('LC-' || nextval('cart_short_code_seq')::text);
--> statement-breakpoint
ALTER TABLE "carts" ALTER COLUMN "short_code" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "carts_short_code_unique" ON "carts" ("short_code");
