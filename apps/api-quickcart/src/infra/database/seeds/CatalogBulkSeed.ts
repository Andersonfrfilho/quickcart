/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Catálogo de porte de mercado, gerado por combinação — linha de produto × marca × variação.
 *
 * Separado do `CatalogSeedProducts` de propósito: aquele é curado, tem grupos ambíguos escolhidos a
 * dedo (3 arrozes, 4 leites) e é o que os testes de busca por trigram usam. Despejar doze mil itens
 * junto mudaria o ranking e quebraria testes que afirmam qual produto vem primeiro — o catálogo de
 * teste e o catálogo de carga têm propósitos diferentes e não devem ser o mesmo.
 *
 * Determinístico: preço e estoque saem de um hash do próprio nome, nunca de `Math.random`. Rodar
 * duas vezes produz exatamente o mesmo catálogo, que é o que torna um bug reproduzível.
 */

export type BulkProduct = {
  readonly categoryKey: string
  readonly name: string
  readonly brand: string
  readonly unit: string
  readonly unitSize: string
  readonly priceInCents: number
  readonly stockQuantity: number
  readonly aliases: readonly string[]
}

type ProductLine = {
  /** Nome base, sem marca nem tamanho: "Arroz Branco Tipo 1". */
  readonly label: string
  readonly unit: string
  /** Preço da menor variação, em centavos. As demais escalam pelo fator da variação. */
  readonly basePriceInCents: number
  /** Termos que a pessoa digita: "arroz", "arroz branco". Viram alias em todo SKU da linha. */
  readonly aliases: readonly string[]
}

type Variant = { readonly size: string; readonly factor: number }

type CategoryRecipe = {
  readonly categoryKey: string
  readonly brands: readonly string[]
  readonly lines: readonly ProductLine[]
}

/** FNV-1a de 32 bits: barato, estável entre execuções e suficiente para dispersar preço e estoque. */
function hashOf(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/** Tira acento e pontuação: o alias é o que a pessoa digita com pressa, sem cedilha nem til. */
function toAlias(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const PRICE_JITTER_RANGE = 0.3
const STOCK_MIN = 5
const STOCK_RANGE = 120

function buildSku(params: {
  readonly recipe: CategoryRecipe
  readonly line: ProductLine
  readonly brand: string
  readonly variant: Variant
}): BulkProduct {
  const name = `${params.line.label} ${params.variant.size}`
  const seed = hashOf(`${name}|${params.brand}`)

  // Duas fatias distintas do mesmo hash: preço e estoque não devem andar juntos.
  const jitter = 1 - PRICE_JITTER_RANGE / 2 + ((seed % 1000) / 1000) * PRICE_JITTER_RANGE
  const priceInCents = Math.max(99, Math.round((params.line.basePriceInCents * params.variant.factor * jitter) / 10) * 10)

  return {
    categoryKey: params.recipe.categoryKey,
    name,
    brand: params.brand,
    unit: params.line.unit,
    unitSize: params.variant.size,
    priceInCents,
    stockQuantity: STOCK_MIN + ((seed >>> 10) % STOCK_RANGE),
    aliases: [
      ...params.line.aliases.map(toAlias),
      toAlias(`${params.line.label} ${params.brand}`),
      toAlias(`${params.line.aliases[0] ?? params.line.label} ${params.brand}`),
    ].filter((alias, index, all) => alias.length > 0 && all.indexOf(alias) === index),
  }
}

/*
 * A variação segue a UNIDADE da linha, não a categoria.
 *
 * Antes o conjunto era por categoria, e laticínios usava mililitro para tudo — saía "Queijo Minas
 * Frescal 300ml", que não existe. Queijo se vende em grama e leite em mililitro, na mesma prateleira.
 */
const VARIANTS_BY_UNIT: Readonly<Record<string, readonly Variant[]>> = {
  g: [
    { size: '200g', factor: 0.45 }, { size: '400g', factor: 0.82 }, { size: '500g', factor: 1 },
    { size: '800g', factor: 1.55 }, { size: '1kg', factor: 1.9 }, { size: '2kg', factor: 3.6 },
    { size: '5kg', factor: 8.4 },
  ],
  kg: [
    { size: '500g', factor: 0.55 }, { size: '1kg', factor: 1 }, { size: '1,5kg', factor: 1.45 },
    { size: '2kg', factor: 1.95 }, { size: '3kg', factor: 2.85 }, { size: '5kg', factor: 4.7 },
    { size: '10kg', factor: 9.2 },
  ],
  ml: [
    { size: '200ml', factor: 0.3 }, { size: '300ml', factor: 0.42 }, { size: '500ml', factor: 0.65 },
    { size: '900ml', factor: 1 }, { size: '1L', factor: 1.12 }, { size: '2L', factor: 2.05 },
    { size: '5L', factor: 4.8 },
  ],
  un: [
    { size: 'unidade', factor: 1 }, { size: 'pacote 4un', factor: 3.7 }, { size: 'pacote 6un', factor: 5.4 },
    { size: 'pacote 8un', factor: 7 }, { size: 'pacote 12un', factor: 10.2 }, { size: 'fardo 18un', factor: 14.8 },
    { size: 'fardo 24un', factor: 19.2 },
  ],
}

function variantsFor(unit: string): readonly Variant[] {
  const variants = VARIANTS_BY_UNIT[unit]
  if (!variants) throw new Error(`Sem variações definidas para a unidade "${unit}"`)
  return variants
}

const CATEGORY_RECIPES: readonly CategoryRecipe[] = [
  {
    categoryKey: 'mercearia',
    brands: ['Tio João', 'Camil', 'Prato Fino', 'Kicaldo', 'Namorado', 'Broto Legal', 'Solito', 'Ruzene', 'Cristal', 'Dona Benta', 'Renata', 'Vitalinha'],
    lines: [
      { label: 'Arroz Branco Tipo 1', unit: 'kg', basePriceInCents: 1490, aliases: ['arroz', 'arroz branco'] },
      { label: 'Arroz Integral', unit: 'kg', basePriceInCents: 1790, aliases: ['arroz integral'] },
      { label: 'Arroz Parboilizado', unit: 'kg', basePriceInCents: 1590, aliases: ['arroz parboilizado'] },
      { label: 'Feijão Carioca', unit: 'kg', basePriceInCents: 999, aliases: ['feijao', 'feijao carioca'] },
      { label: 'Feijão Preto', unit: 'kg', basePriceInCents: 1099, aliases: ['feijao preto'] },
      { label: 'Açúcar Refinado', unit: 'kg', basePriceInCents: 599, aliases: ['acucar', 'acucar refinado'] },
      { label: 'Açúcar Demerara', unit: 'kg', basePriceInCents: 899, aliases: ['acucar demerara'] },
      { label: 'Farinha de Trigo', unit: 'kg', basePriceInCents: 649, aliases: ['farinha', 'farinha de trigo'] },
      { label: 'Farinha de Mandioca', unit: 'kg', basePriceInCents: 749, aliases: ['farinha de mandioca'] },
      { label: 'Macarrão Espaguete', unit: 'g', basePriceInCents: 549, aliases: ['macarrao', 'espaguete'] },
      { label: 'Macarrão Parafuso', unit: 'g', basePriceInCents: 549, aliases: ['macarrao parafuso'] },
      { label: 'Café Torrado e Moído', unit: 'g', basePriceInCents: 1399, aliases: ['cafe', 'cafe moido'] },
      { label: 'Sal Refinado', unit: 'kg', basePriceInCents: 349, aliases: ['sal'] },
      { label: 'Biscoito Recheado', unit: 'g', basePriceInCents: 449, aliases: ['biscoito', 'bolacha'] },
      { label: 'Molho de Tomate', unit: 'g', basePriceInCents: 399, aliases: ['molho de tomate', 'molho'] },
    ],
  },
  {
    categoryKey: 'hortifruti',
    brands: ['Da Feira', 'Horta Viva', 'Campo Verde', 'Fazenda Bela', 'Sítio Novo', 'Colheita', 'Terra Boa', 'Raiz', 'Pomar Sul', 'Vale Fértil', 'Boa Safra', 'Verdejar'],
    lines: [
      { label: 'Banana Prata', unit: 'kg', basePriceInCents: 599, aliases: ['banana'] },
      { label: 'Banana Nanica', unit: 'kg', basePriceInCents: 549, aliases: ['banana nanica'] },
      { label: 'Maçã Gala', unit: 'kg', basePriceInCents: 799, aliases: ['maca', 'maca gala'] },
      { label: 'Maçã Fuji', unit: 'kg', basePriceInCents: 849, aliases: ['maca fuji'] },
      { label: 'Tomate Salada', unit: 'kg', basePriceInCents: 699, aliases: ['tomate'] },
      { label: 'Cebola Branca', unit: 'kg', basePriceInCents: 499, aliases: ['cebola'] },
      { label: 'Batata Inglesa', unit: 'kg', basePriceInCents: 549, aliases: ['batata'] },
      { label: 'Cenoura', unit: 'kg', basePriceInCents: 449, aliases: ['cenoura'] },
      { label: 'Alface Crespa', unit: 'un', basePriceInCents: 349, aliases: ['alface'] },
      { label: 'Limão Tahiti', unit: 'kg', basePriceInCents: 649, aliases: ['limao'] },
      { label: 'Laranja Pera', unit: 'kg', basePriceInCents: 529, aliases: ['laranja'] },
      { label: 'Mamão Formosa', unit: 'kg', basePriceInCents: 699, aliases: ['mamao'] },
      { label: 'Abacaxi Pérola', unit: 'un', basePriceInCents: 899, aliases: ['abacaxi'] },
      { label: 'Manga Palmer', unit: 'kg', basePriceInCents: 749, aliases: ['manga'] },
      { label: 'Melancia', unit: 'kg', basePriceInCents: 399, aliases: ['melancia'] },
    ],
  },
  {
    categoryKey: 'acougue',
    brands: ['Friboi', 'Swift', 'Seara', 'Sadia', 'Perdigão', 'Maturatta', 'Montana', 'Estância', 'Bassi', 'Pampeano', 'Aurora', 'Marfrig'],
    lines: [
      { label: 'Picanha Bovina', unit: 'kg', basePriceInCents: 6990, aliases: ['picanha'] },
      { label: 'Alcatra Bovina', unit: 'kg', basePriceInCents: 4990, aliases: ['alcatra'] },
      { label: 'Coxão Mole', unit: 'kg', basePriceInCents: 4290, aliases: ['coxao mole'] },
      { label: 'Patinho Moído', unit: 'kg', basePriceInCents: 3890, aliases: ['patinho', 'carne moida'] },
      { label: 'Costela Bovina', unit: 'kg', basePriceInCents: 3590, aliases: ['costela'] },
      { label: 'Peito de Frango', unit: 'kg', basePriceInCents: 2290, aliases: ['frango', 'peito de frango'] },
      { label: 'Coxa e Sobrecoxa', unit: 'kg', basePriceInCents: 1690, aliases: ['coxa', 'sobrecoxa'] },
      { label: 'Linguiça Toscana', unit: 'kg', basePriceInCents: 2490, aliases: ['linguica'] },
      { label: 'Bisteca Suína', unit: 'kg', basePriceInCents: 2690, aliases: ['bisteca'] },
      { label: 'Pernil Suíno', unit: 'kg', basePriceInCents: 2390, aliases: ['pernil'] },
      { label: 'Fraldinha Bovina', unit: 'kg', basePriceInCents: 4590, aliases: ['fraldinha'] },
      { label: 'Cupim Bovino', unit: 'kg', basePriceInCents: 4190, aliases: ['cupim'] },
      { label: 'File de Peixe', unit: 'kg', basePriceInCents: 3290, aliases: ['peixe', 'file de peixe'] },
      { label: 'Camarão Limpo', unit: 'kg', basePriceInCents: 7990, aliases: ['camarao'] },
      { label: 'Asa de Frango', unit: 'kg', basePriceInCents: 1890, aliases: ['asa de frango'] },
    ],
  },
  {
    categoryKey: 'padaria',
    brands: ['Pullman', 'Wickbold', 'Panco', 'Seven Boys', 'Plus Vita', 'Nutrella', 'Bauducco', 'Visconti', 'Firenze', 'Marilan', 'Casa Suíça', 'Vovó Maria'],
    lines: [
      { label: 'Pão de Forma Tradicional', unit: 'g', basePriceInCents: 799, aliases: ['pao de forma', 'pao'] },
      { label: 'Pão de Forma Integral', unit: 'g', basePriceInCents: 899, aliases: ['pao integral'] },
      { label: 'Pão de Hambúrguer', unit: 'g', basePriceInCents: 749, aliases: ['pao de hamburguer'] },
      { label: 'Pão de Hot Dog', unit: 'g', basePriceInCents: 699, aliases: ['pao de hot dog'] },
      { label: 'Bisnaguinha', unit: 'g', basePriceInCents: 649, aliases: ['bisnaguinha'] },
      { label: 'Torrada Tradicional', unit: 'g', basePriceInCents: 599, aliases: ['torrada'] },
      { label: 'Bolo de Chocolate', unit: 'g', basePriceInCents: 1099, aliases: ['bolo', 'bolo de chocolate'] },
      { label: 'Bolo de Laranja', unit: 'g', basePriceInCents: 999, aliases: ['bolo de laranja'] },
      { label: 'Rosquinha de Coco', unit: 'g', basePriceInCents: 549, aliases: ['rosquinha'] },
      { label: 'Panetone', unit: 'g', basePriceInCents: 2490, aliases: ['panetone'] },
      { label: 'Croissant', unit: 'g', basePriceInCents: 899, aliases: ['croissant'] },
      { label: 'Sonho Recheado', unit: 'g', basePriceInCents: 649, aliases: ['sonho'] },
      { label: 'Pão Francês', unit: 'kg', basePriceInCents: 1690, aliases: ['pao frances', 'frances'] },
      { label: 'Broa de Milho', unit: 'g', basePriceInCents: 749, aliases: ['broa'] },
      { label: 'Biscoito Amanteigado', unit: 'g', basePriceInCents: 699, aliases: ['biscoito amanteigado'] },
    ],
  },
  {
    categoryKey: 'laticinios',
    brands: ['Itambé', 'Piracanjuba', 'Parmalat', 'Danone', 'Vigor', 'Elegê', 'Tirol', 'Batavo', 'Nestlé', 'Scala', 'Polenghi', 'Jussara'],
    lines: [
      { label: 'Leite Integral', unit: 'ml', basePriceInCents: 549, aliases: ['leite', 'leite integral'] },
      { label: 'Leite Desnatado', unit: 'ml', basePriceInCents: 559, aliases: ['leite desnatado'] },
      { label: 'Leite Semidesnatado', unit: 'ml', basePriceInCents: 555, aliases: ['leite semidesnatado'] },
      { label: 'Leite Sem Lactose', unit: 'ml', basePriceInCents: 699, aliases: ['leite sem lactose'] },
      { label: 'Iogurte Natural', unit: 'ml', basePriceInCents: 499, aliases: ['iogurte'] },
      { label: 'Iogurte de Morango', unit: 'ml', basePriceInCents: 529, aliases: ['iogurte de morango'] },
      { label: 'Bebida Láctea', unit: 'ml', basePriceInCents: 449, aliases: ['bebida lactea'] },
      { label: 'Creme de Leite', unit: 'ml', basePriceInCents: 399, aliases: ['creme de leite'] },
      { label: 'Leite Condensado', unit: 'ml', basePriceInCents: 699, aliases: ['leite condensado'] },
      { label: 'Requeijão Cremoso', unit: 'g', basePriceInCents: 799, aliases: ['requeijao'] },
      { label: 'Queijo Mussarela', unit: 'g', basePriceInCents: 1899, aliases: ['queijo', 'mussarela'] },
      { label: 'Queijo Prato', unit: 'g', basePriceInCents: 1799, aliases: ['queijo prato'] },
      { label: 'Queijo Minas Frescal', unit: 'g', basePriceInCents: 1699, aliases: ['queijo minas'] },
      { label: 'Manteiga com Sal', unit: 'g', basePriceInCents: 1299, aliases: ['manteiga'] },
      { label: 'Margarina Cremosa', unit: 'g', basePriceInCents: 799, aliases: ['margarina'] },
    ],
  },
  {
    categoryKey: 'bebidas',
    brands: ['Coca-Cola', 'Guaraná Antarctica', 'Pepsi', 'Fanta', 'Sprite', 'Del Valle', 'Schweppes', 'Kuat', 'Tial', 'Sukita', 'Prata', 'Crystal'],
    lines: [
      { label: 'Refrigerante Cola', unit: 'ml', basePriceInCents: 699, aliases: ['refrigerante', 'coca', 'cola'] },
      { label: 'Refrigerante Guaraná', unit: 'ml', basePriceInCents: 649, aliases: ['guarana', 'refrigerante'] },
      { label: 'Refrigerante Laranja', unit: 'ml', basePriceInCents: 649, aliases: ['refrigerante laranja'] },
      { label: 'Refrigerante Limão', unit: 'ml', basePriceInCents: 649, aliases: ['refrigerante limao'] },
      { label: 'Suco de Uva Integral', unit: 'ml', basePriceInCents: 899, aliases: ['suco', 'suco de uva'] },
      { label: 'Suco de Laranja', unit: 'ml', basePriceInCents: 799, aliases: ['suco de laranja'] },
      { label: 'Água Mineral sem Gás', unit: 'ml', basePriceInCents: 299, aliases: ['agua', 'agua mineral'] },
      { label: 'Água com Gás', unit: 'ml', basePriceInCents: 349, aliases: ['agua com gas'] },
      { label: 'Água de Coco', unit: 'ml', basePriceInCents: 699, aliases: ['agua de coco'] },
      { label: 'Chá Gelado Limão', unit: 'ml', basePriceInCents: 599, aliases: ['cha gelado', 'cha'] },
      { label: 'Energético', unit: 'ml', basePriceInCents: 1099, aliases: ['energetico'] },
      { label: 'Cerveja Pilsen', unit: 'ml', basePriceInCents: 549, aliases: ['cerveja'] },
      { label: 'Néctar de Pêssego', unit: 'ml', basePriceInCents: 649, aliases: ['nectar', 'pessego'] },
      { label: 'Isotônico', unit: 'ml', basePriceInCents: 799, aliases: ['isotonico'] },
      { label: 'Refresco em Pó', unit: 'g', basePriceInCents: 199, aliases: ['refresco', 'suco em po'] },
    ],
  },
  {
    categoryKey: 'limpeza',
    brands: ['Omo', 'Ariel', 'Ypê', 'Veja', 'Cif', 'Brilhante', 'Mon Bijou', 'Bombril', 'Minuano', 'Limpol', 'Pinho Sol', 'Vanish'],
    lines: [
      { label: 'Sabão em Pó', unit: 'g', basePriceInCents: 1299, aliases: ['sabao em po', 'sabao'] },
      { label: 'Sabão Líquido', unit: 'ml', basePriceInCents: 1599, aliases: ['sabao liquido'] },
      { label: 'Amaciante de Roupas', unit: 'ml', basePriceInCents: 999, aliases: ['amaciante'] },
      { label: 'Detergente Neutro', unit: 'ml', basePriceInCents: 299, aliases: ['detergente'] },
      { label: 'Desinfetante Pinho', unit: 'ml', basePriceInCents: 699, aliases: ['desinfetante'] },
      { label: 'Água Sanitária', unit: 'ml', basePriceInCents: 499, aliases: ['agua sanitaria', 'candida'] },
      { label: 'Limpador Multiuso', unit: 'ml', basePriceInCents: 599, aliases: ['multiuso', 'limpador'] },
      { label: 'Limpa Vidros', unit: 'ml', basePriceInCents: 749, aliases: ['limpa vidros'] },
      { label: 'Lustra Móveis', unit: 'ml', basePriceInCents: 899, aliases: ['lustra moveis'] },
      { label: 'Esponja de Aço', unit: 'un', basePriceInCents: 349, aliases: ['esponja de aco', 'bombril'] },
      { label: 'Esponja Multiuso', unit: 'un', basePriceInCents: 299, aliases: ['esponja'] },
      { label: 'Saco de Lixo', unit: 'un', basePriceInCents: 899, aliases: ['saco de lixo'] },
      { label: 'Papel Toalha', unit: 'un', basePriceInCents: 799, aliases: ['papel toalha'] },
      { label: 'Removedor de Gordura', unit: 'ml', basePriceInCents: 999, aliases: ['removedor de gordura'] },
      { label: 'Alvejante sem Cloro', unit: 'ml', basePriceInCents: 899, aliases: ['alvejante'] },
    ],
  },
  {
    categoryKey: 'higiene',
    brands: ['Colgate', 'Sorriso', 'Dove', 'Rexona', 'Lux', 'Palmolive', 'Seda', 'Nivea', 'Protex', 'Johnson', 'Pantene', 'Close Up'],
    lines: [
      { label: 'Sabonete em Barra', unit: 'g', basePriceInCents: 349, aliases: ['sabonete'] },
      { label: 'Sabonete Líquido', unit: 'ml', basePriceInCents: 999, aliases: ['sabonete liquido'] },
      { label: 'Shampoo Hidratante', unit: 'ml', basePriceInCents: 1299, aliases: ['shampoo'] },
      { label: 'Condicionador Hidratante', unit: 'ml', basePriceInCents: 1349, aliases: ['condicionador'] },
      { label: 'Creme Dental', unit: 'g', basePriceInCents: 599, aliases: ['creme dental', 'pasta de dente'] },
      { label: 'Enxaguante Bucal', unit: 'ml', basePriceInCents: 1199, aliases: ['enxaguante bucal'] },
      { label: 'Desodorante Aerosol', unit: 'ml', basePriceInCents: 1499, aliases: ['desodorante'] },
      { label: 'Desodorante Roll On', unit: 'ml', basePriceInCents: 1299, aliases: ['desodorante roll on'] },
      { label: 'Papel Higiênico', unit: 'un', basePriceInCents: 1699, aliases: ['papel higienico'] },
      { label: 'Absorvente', unit: 'un', basePriceInCents: 999, aliases: ['absorvente'] },
      { label: 'Fralda Descartável', unit: 'un', basePriceInCents: 3499, aliases: ['fralda'] },
      { label: 'Lenço Umedecido', unit: 'un', basePriceInCents: 899, aliases: ['lenco umedecido'] },
      { label: 'Hidratante Corporal', unit: 'ml', basePriceInCents: 1799, aliases: ['hidratante'] },
      { label: 'Escova de Dentes', unit: 'un', basePriceInCents: 799, aliases: ['escova de dentes'] },
      { label: 'Aparelho de Barbear', unit: 'un', basePriceInCents: 1299, aliases: ['barbear', 'gilete'] },
    ],
  },
  {
    categoryKey: 'congelados',
    brands: ['Sadia', 'Perdigão', 'Seara', 'Aurora', 'Pescados Brasil', 'Forno de Minas', 'Da Vovó', 'Gelato', 'Kibon', 'Nestlé', 'Bem Brasil', 'McCain'],
    lines: [
      { label: 'Lasanha à Bolonhesa', unit: 'g', basePriceInCents: 1899, aliases: ['lasanha'] },
      { label: 'Pizza de Mussarela', unit: 'g', basePriceInCents: 1699, aliases: ['pizza'] },
      { label: 'Pizza de Calabresa', unit: 'g', basePriceInCents: 1749, aliases: ['pizza de calabresa'] },
      { label: 'Nuggets de Frango', unit: 'g', basePriceInCents: 1499, aliases: ['nuggets'] },
      { label: 'Hambúrguer Bovino', unit: 'g', basePriceInCents: 1599, aliases: ['hamburguer'] },
      { label: 'Batata Palito Congelada', unit: 'g', basePriceInCents: 1299, aliases: ['batata frita', 'batata palito'] },
      { label: 'Pão de Queijo', unit: 'g', basePriceInCents: 1399, aliases: ['pao de queijo'] },
      { label: 'Ervilha Congelada', unit: 'g', basePriceInCents: 799, aliases: ['ervilha'] },
      { label: 'Brócolis Congelado', unit: 'g', basePriceInCents: 899, aliases: ['brocolis'] },
      { label: 'Sorvete de Creme', unit: 'ml', basePriceInCents: 1899, aliases: ['sorvete'] },
      { label: 'Sorvete de Chocolate', unit: 'ml', basePriceInCents: 1949, aliases: ['sorvete de chocolate'] },
      { label: 'Açaí Polpa', unit: 'g', basePriceInCents: 1299, aliases: ['acai'] },
      { label: 'Peixe Empanado', unit: 'g', basePriceInCents: 1799, aliases: ['peixe empanado'] },
      { label: 'Escondidinho de Carne', unit: 'g', basePriceInCents: 1999, aliases: ['escondidinho'] },
      { label: 'Torta de Frango', unit: 'g', basePriceInCents: 1699, aliases: ['torta de frango'] },
    ],
  },
  {
    categoryKey: 'pet',
    brands: ['Pedigree', 'Whiskas', 'Golden', 'Premier', 'Dog Chow', 'Cat Chow', 'Purina', 'Formula Natural', 'Royal Canin', 'Magnus', 'Biofresh', 'Special Dog'],
    lines: [
      { label: 'Ração para Cães Adultos', unit: 'kg', basePriceInCents: 2990, aliases: ['racao', 'racao cachorro'] },
      { label: 'Ração para Cães Filhotes', unit: 'kg', basePriceInCents: 3290, aliases: ['racao filhote'] },
      { label: 'Ração para Gatos Adultos', unit: 'kg', basePriceInCents: 3190, aliases: ['racao gato'] },
      { label: 'Ração para Gatos Castrados', unit: 'kg', basePriceInCents: 3590, aliases: ['racao gato castrado'] },
      { label: 'Sachê para Cães', unit: 'g', basePriceInCents: 399, aliases: ['sache cachorro'] },
      { label: 'Sachê para Gatos', unit: 'g', basePriceInCents: 399, aliases: ['sache gato'] },
      { label: 'Petisco Bifinho', unit: 'g', basePriceInCents: 899, aliases: ['petisco', 'bifinho'] },
      { label: 'Areia Sanitária', unit: 'kg', basePriceInCents: 1499, aliases: ['areia de gato', 'areia'] },
      { label: 'Tapete Higiênico', unit: 'un', basePriceInCents: 3499, aliases: ['tapete higienico'] },
      { label: 'Shampoo para Pets', unit: 'ml', basePriceInCents: 1999, aliases: ['shampoo pet'] },
      { label: 'Osso Mordedor', unit: 'un', basePriceInCents: 1299, aliases: ['osso', 'mordedor'] },
      { label: 'Coleira Antipulgas', unit: 'un', basePriceInCents: 4999, aliases: ['coleira', 'antipulgas'] },
      { label: 'Ração Úmida Premium', unit: 'g', basePriceInCents: 699, aliases: ['racao umida'] },
      { label: 'Suplemento Pet', unit: 'g', basePriceInCents: 2999, aliases: ['suplemento pet'] },
      { label: 'Brinquedo Bolinha', unit: 'un', basePriceInCents: 999, aliases: ['brinquedo pet', 'bolinha'] },
    ],
  },
]

export function buildBulkCatalog(recipes: readonly CategoryRecipe[] = CATEGORY_RECIPES): readonly BulkProduct[] {
  const products: BulkProduct[] = []
  for (const recipe of recipes) {
    for (const line of recipe.lines) {
      for (const brand of recipe.brands) {
        for (const variant of variantsFor(line.unit)) {
          products.push(buildSku({ recipe, line, brand, variant }))
        }
      }
    }
  }
  return products
}
