-- Extensões necessárias para a busca fuzzy de produtos (spec §3.2): similaridade
-- trigram (pg_trgm) e normalização de acentos (unaccent) usadas nos índices GIN
-- de expressão sobre lower(immutable_unaccent(name)) em categories/products (Fase 2).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() nativo é STABLE (depende de configuração de dicionário em runtime), o que
-- impede seu uso em índices de expressão — precisam de funções IMMUTABLE. Este wrapper
-- fixa o dicionário 'unaccent' explicitamente, tornando o resultado determinístico.
--
-- LANGUAGE plpgsql (não sql): funções SQL são inlineadas pelo planner e seu texto-fonte
-- é reanalisado no momento da inlining — isso faz o cast 'unaccent'::regdictionary ser
-- reavaliado durante o CREATE INDEX (via GIN) e falhar com "text search dictionary
-- unaccent does not exist", mesmo com a extensão já commitada. plpgsql não é inlineado
-- pelo planner, evitando esse reparse e a falha.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS
$$
BEGIN
  RETURN unaccent('unaccent'::regdictionary, $1);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE STRICT;
