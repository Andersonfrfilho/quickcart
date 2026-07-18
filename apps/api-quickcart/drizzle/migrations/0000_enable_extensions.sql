-- Extensões necessárias para a busca fuzzy de produtos (spec §3.2): similaridade
-- trigram (pg_trgm) e normalização de acentos (unaccent) usadas nos índices GIN
-- de expressão sobre lower(immutable_unaccent(name)) em categories/products (Fase 2).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() nativo é STABLE (depende de configuração de dicionário em runtime), o que
-- impede seu uso em índices de expressão — precisam de funções IMMUTABLE. Este wrapper
-- fixa o dicionário 'unaccent' explicitamente, tornando o resultado determinístico.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS
$$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
