-- Onde o produto fica na loja, para quem separa achar sem procurar.
--
-- A lista de separação dizia o nome e a quantidade, e nada sobre o caminho: quem separa dez itens
-- atravessa a loja na ordem em que o cliente digitou, não na ordem das prateleiras. Com o corredor na
-- linha, a mesma lista pode ser lida de ponta a ponta caminhando uma vez só.
--
-- Texto livre e opcional porque cada loja nomeia o próprio espaço ("Corredor 3", "Hortifruti",
-- "Câmara fria"), e a maioria não mapeia nada — a tela só mostra quando houver.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "aisle" varchar(60);
