/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Inclui grupos ambíguos de propósito (3 arrozes, 4 leites, 3 sabões) para exercitar
 * a desambiguação do matcher trigram (ver .specs/features/mvp/tasks.md T2.4).
 */

export type SeedProduct = {
  readonly categoryKey: string
  readonly name: string
  readonly brand?: string
  readonly unit: string
  readonly unitSize?: string
  readonly priceInCents: number
  readonly stockQuantity: number
  readonly aliases: readonly string[]
}

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  // Mercearia
  { categoryKey: 'mercearia', name: 'Arroz Branco Tipo 1 5kg', brand: 'Tio João', unit: 'kg', unitSize: '5kg', priceInCents: 2790, stockQuantity: 40, aliases: ['arroz', 'arroz branco', 'arroz tio joao'] },
  { categoryKey: 'mercearia', name: 'Arroz Branco Tipo 1 5kg', brand: 'Camil', unit: 'kg', unitSize: '5kg', priceInCents: 2690, stockQuantity: 35, aliases: ['arroz', 'arroz branco', 'arroz camil'] },
  { categoryKey: 'mercearia', name: 'Arroz Branco Tipo 1 5kg', brand: 'Prato Fino', unit: 'kg', unitSize: '5kg', priceInCents: 2590, stockQuantity: 30, aliases: ['arroz', 'arroz branco', 'arroz prato fino'] },
  { categoryKey: 'mercearia', name: 'Feijão Carioca 1kg', brand: 'Camil', unit: 'kg', unitSize: '1kg', priceInCents: 899, stockQuantity: 60, aliases: ['feijao', 'feijao carioca'] },
  { categoryKey: 'mercearia', name: 'Açúcar Refinado 1kg', brand: 'União', unit: 'kg', unitSize: '1kg', priceInCents: 549, stockQuantity: 70, aliases: ['acucar', 'acucar uniao', 'acucar refinado'] },
  { categoryKey: 'mercearia', name: 'Óleo de Soja 900ml', brand: 'Soya', unit: 'ml', unitSize: '900ml', priceInCents: 799, stockQuantity: 50, aliases: ['oleo', 'oleo de soja', 'oleo soya'] },
  { categoryKey: 'mercearia', name: 'Macarrão Espaguete 500g', brand: 'Barilla', unit: 'g', unitSize: '500g', priceInCents: 649, stockQuantity: 55, aliases: ['macarrao', 'espaguete', 'macarrao barilla'] },
  { categoryKey: 'mercearia', name: 'Café Torrado e Moído 500g', brand: 'Pilão', unit: 'g', unitSize: '500g', priceInCents: 1299, stockQuantity: 45, aliases: ['cafe', 'cafe pilao', 'cafe torrado e moido'] },

  // Hortifruti
  { categoryKey: 'hortifruti', name: 'Banana Prata', unit: 'kg', priceInCents: 599, stockQuantity: 80, aliases: ['banana', 'banana prata'] },
  { categoryKey: 'hortifruti', name: 'Maçã Gala', unit: 'kg', priceInCents: 799, stockQuantity: 70, aliases: ['maca', 'maca gala'] },
  { categoryKey: 'hortifruti', name: 'Tomate Salada', unit: 'kg', priceInCents: 699, stockQuantity: 65, aliases: ['tomate', 'tomate salada'] },
  { categoryKey: 'hortifruti', name: 'Cebola', unit: 'kg', priceInCents: 499, stockQuantity: 90, aliases: ['cebola'] },
  { categoryKey: 'hortifruti', name: 'Batata Inglesa', unit: 'kg', priceInCents: 549, stockQuantity: 90, aliases: ['batata', 'batata inglesa'] },
  { categoryKey: 'hortifruti', name: 'Alface Crespa', unit: 'un', priceInCents: 349, stockQuantity: 40, aliases: ['alface', 'alface crespa'] },
  { categoryKey: 'hortifruti', name: 'Limão Tahiti', unit: 'kg', priceInCents: 649, stockQuantity: 50, aliases: ['limao', 'limao tahiti'] },
  { categoryKey: 'hortifruti', name: 'Cenoura', unit: 'kg', priceInCents: 449, stockQuantity: 60, aliases: ['cenoura'] },

  // Açougue
  { categoryKey: 'acougue', name: 'Picanha Bovina', unit: 'kg', priceInCents: 5990, stockQuantity: 20, aliases: ['picanha', 'picanha bovina'] },
  { categoryKey: 'acougue', name: 'Contrafilé Bovino', unit: 'kg', priceInCents: 3990, stockQuantity: 25, aliases: ['contrafile', 'contra file'] },
  { categoryKey: 'acougue', name: 'Frango Inteiro', unit: 'kg', priceInCents: 1290, stockQuantity: 40, aliases: ['frango', 'frango inteiro'] },
  { categoryKey: 'acougue', name: 'Coxa e Sobrecoxa de Frango', unit: 'kg', priceInCents: 1190, stockQuantity: 45, aliases: ['coxa', 'sobrecoxa', 'coxa e sobrecoxa'] },
  { categoryKey: 'acougue', name: 'Linguiça Toscana', unit: 'kg', priceInCents: 1890, stockQuantity: 30, aliases: ['linguica', 'linguica toscana'] },
  { categoryKey: 'acougue', name: 'Carne Moída Patinho', unit: 'kg', priceInCents: 2990, stockQuantity: 35, aliases: ['carne moida', 'patinho moido'] },
  { categoryKey: 'acougue', name: 'Bisteca Suína', unit: 'kg', priceInCents: 1690, stockQuantity: 30, aliases: ['bisteca', 'bisteca suina'] },
  { categoryKey: 'acougue', name: 'Costela Bovina', unit: 'kg', priceInCents: 2490, stockQuantity: 25, aliases: ['costela', 'costela bovina'] },

  // Padaria
  { categoryKey: 'padaria', name: 'Pão Francês', unit: 'kg', priceInCents: 1490, stockQuantity: 50, aliases: ['pao frances', 'pao'] },
  { categoryKey: 'padaria', name: 'Pão de Forma Tradicional 500g', brand: 'Pullman', unit: 'g', unitSize: '500g', priceInCents: 799, stockQuantity: 40, aliases: ['pao de forma', 'pao forma pullman'] },
  { categoryKey: 'padaria', name: 'Pão de Forma Integral 500g', brand: 'Wickbold', unit: 'g', unitSize: '500g', priceInCents: 899, stockQuantity: 35, aliases: ['pao de forma integral', 'pao integral'] },
  { categoryKey: 'padaria', name: 'Bisnaguinha 300g', brand: 'Pullman', unit: 'g', unitSize: '300g', priceInCents: 699, stockQuantity: 40, aliases: ['bisnaguinha'] },
  { categoryKey: 'padaria', name: 'Bolo de Fubá', unit: 'un', priceInCents: 1290, stockQuantity: 20, aliases: ['bolo', 'bolo de fuba'] },
  { categoryKey: 'padaria', name: 'Torrada Tradicional 160g', brand: 'Bauducco', unit: 'g', unitSize: '160g', priceInCents: 599, stockQuantity: 45, aliases: ['torrada', 'torrada bauducco'] },
  { categoryKey: 'padaria', name: 'Croissant', unit: 'un', priceInCents: 599, stockQuantity: 30, aliases: ['croissant'] },
  { categoryKey: 'padaria', name: 'Pão Doce', unit: 'kg', priceInCents: 1690, stockQuantity: 25, aliases: ['pao doce'] },

  // Laticínios (grupo ambíguo: 4 leites)
  { categoryKey: 'laticinios', name: 'Leite Integral 1L', brand: 'Italac', unit: 'l', unitSize: '1L', priceInCents: 549, stockQuantity: 100, aliases: ['leite', 'leite integral', 'leite italac'] },
  { categoryKey: 'laticinios', name: 'Leite Integral 1L', brand: 'Piracanjuba', unit: 'l', unitSize: '1L', priceInCents: 559, stockQuantity: 100, aliases: ['leite', 'leite integral', 'leite piracanjuba'] },
  { categoryKey: 'laticinios', name: 'Leite Integral 1L', brand: 'Parmalat', unit: 'l', unitSize: '1L', priceInCents: 569, stockQuantity: 90, aliases: ['leite', 'leite integral', 'leite parmalat'] },
  { categoryKey: 'laticinios', name: 'Leite em Pó Integral 400g', brand: 'Ninho', unit: 'g', unitSize: '400g', priceInCents: 1899, stockQuantity: 40, aliases: ['leite em po', 'leite ninho', 'ninho'] },
  { categoryKey: 'laticinios', name: 'Queijo Mussarela Fatiado 150g', brand: 'Tirolez', unit: 'g', unitSize: '150g', priceInCents: 999, stockQuantity: 50, aliases: ['queijo', 'mussarela', 'queijo mussarela'] },
  { categoryKey: 'laticinios', name: 'Requeijão Cremoso 200g', brand: 'Catupiry', unit: 'g', unitSize: '200g', priceInCents: 899, stockQuantity: 45, aliases: ['requeijao', 'catupiry'] },
  { categoryKey: 'laticinios', name: 'Iogurte Natural 170g', brand: 'Danone', unit: 'g', unitSize: '170g', priceInCents: 399, stockQuantity: 60, aliases: ['iogurte', 'iogurte natural', 'danone'] },
  { categoryKey: 'laticinios', name: 'Manteiga com Sal 200g', brand: 'Aviação', unit: 'g', unitSize: '200g', priceInCents: 999, stockQuantity: 40, aliases: ['manteiga', 'manteiga aviacao'] },

  // Bebidas
  { categoryKey: 'bebidas', name: 'Refrigerante Cola 2L', brand: 'Coca-Cola', unit: 'l', unitSize: '2L', priceInCents: 999, stockQuantity: 60, aliases: ['coca cola', 'refrigerante', 'refrigerante cola'] },
  { categoryKey: 'bebidas', name: 'Refrigerante Guaraná 2L', brand: 'Antarctica', unit: 'l', unitSize: '2L', priceInCents: 849, stockQuantity: 55, aliases: ['guarana', 'refrigerante guarana'] },
  { categoryKey: 'bebidas', name: 'Água Mineral sem Gás 1,5L', brand: 'Crystal', unit: 'l', unitSize: '1,5L', priceInCents: 299, stockQuantity: 100, aliases: ['agua', 'agua mineral'] },
  { categoryKey: 'bebidas', name: 'Suco de Laranja 1L', brand: 'Del Valle', unit: 'l', unitSize: '1L', priceInCents: 799, stockQuantity: 50, aliases: ['suco', 'suco de laranja', 'suco laranja'] },
  { categoryKey: 'bebidas', name: 'Cerveja Pilsen Lata 350ml', brand: 'Skol', unit: 'ml', unitSize: '350ml', priceInCents: 349, stockQuantity: 80, aliases: ['cerveja', 'cerveja skol'] },
  { categoryKey: 'bebidas', name: 'Cerveja Pilsen Lata 350ml', brand: 'Brahma', unit: 'ml', unitSize: '350ml', priceInCents: 349, stockQuantity: 80, aliases: ['cerveja', 'cerveja brahma'] },
  { categoryKey: 'bebidas', name: 'Achocolatado Pronto 200ml', brand: 'Toddynho', unit: 'ml', unitSize: '200ml', priceInCents: 249, stockQuantity: 90, aliases: ['achocolatado', 'toddynho'] },
  { categoryKey: 'bebidas', name: 'Água de Coco 1L', brand: 'Kero Coco', unit: 'l', unitSize: '1L', priceInCents: 899, stockQuantity: 40, aliases: ['agua de coco', 'kero coco'] },

  // Limpeza (grupo ambíguo: 3 sabões)
  { categoryKey: 'limpeza', name: 'Sabão em Pó 1kg', brand: 'Omo', unit: 'kg', unitSize: '1kg', priceInCents: 1299, stockQuantity: 50, aliases: ['sabao', 'sabao em po', 'sabao omo'] },
  { categoryKey: 'limpeza', name: 'Sabão em Pó 1kg', brand: 'Ariel', unit: 'kg', unitSize: '1kg', priceInCents: 1399, stockQuantity: 45, aliases: ['sabao', 'sabao em po', 'sabao ariel'] },
  { categoryKey: 'limpeza', name: 'Sabão em Barra 5x200g', brand: 'Ypê', unit: 'pct', unitSize: '5x200g', priceInCents: 999, stockQuantity: 40, aliases: ['sabao', 'sabao em barra', 'sabao ype'] },
  { categoryKey: 'limpeza', name: 'Detergente Líquido Neutro 500ml', brand: 'Ypê', unit: 'ml', unitSize: '500ml', priceInCents: 249, stockQuantity: 90, aliases: ['detergente', 'detergente ype'] },
  { categoryKey: 'limpeza', name: 'Água Sanitária 1L', brand: 'Qboa', unit: 'l', unitSize: '1L', priceInCents: 399, stockQuantity: 70, aliases: ['agua sanitaria', 'qboa'] },
  { categoryKey: 'limpeza', name: 'Desinfetante Lavanda 1L', brand: 'Pinho Sol', unit: 'l', unitSize: '1L', priceInCents: 699, stockQuantity: 60, aliases: ['desinfetante', 'pinho sol'] },
  { categoryKey: 'limpeza', name: 'Amaciante de Roupas 1L', brand: 'Comfort', unit: 'l', unitSize: '1L', priceInCents: 999, stockQuantity: 50, aliases: ['amaciante', 'comfort'] },
  { categoryKey: 'limpeza', name: 'Esponja de Aço', brand: 'Bombril', unit: 'pct', priceInCents: 449, stockQuantity: 60, aliases: ['esponja de aco', 'bombril'] },

  // Higiene Pessoal
  { categoryKey: 'higiene', name: 'Sabonete em Barra 90g', brand: 'Dove', unit: 'g', unitSize: '90g', priceInCents: 349, stockQuantity: 80, aliases: ['sabonete', 'sabonete dove'] },
  { categoryKey: 'higiene', name: 'Shampoo Hidratação 350ml', brand: 'Seda', unit: 'ml', unitSize: '350ml', priceInCents: 1499, stockQuantity: 50, aliases: ['shampoo', 'shampoo seda'] },
  { categoryKey: 'higiene', name: 'Condicionador Hidratação 350ml', brand: 'Seda', unit: 'ml', unitSize: '350ml', priceInCents: 1499, stockQuantity: 50, aliases: ['condicionador', 'condicionador seda'] },
  { categoryKey: 'higiene', name: 'Creme Dental 90g', brand: 'Colgate', unit: 'g', unitSize: '90g', priceInCents: 549, stockQuantity: 90, aliases: ['creme dental', 'colgate', 'pasta de dente'] },
  { categoryKey: 'higiene', name: 'Papel Higiênico Folha Dupla 12 Rolos', brand: 'Neve', unit: 'pct', unitSize: '12 rolos', priceInCents: 2199, stockQuantity: 40, aliases: ['papel higienico', 'neve'] },
  { categoryKey: 'higiene', name: 'Desodorante Aerosol 150ml', brand: 'Rexona', unit: 'ml', unitSize: '150ml', priceInCents: 1299, stockQuantity: 55, aliases: ['desodorante', 'rexona'] },
  { categoryKey: 'higiene', name: 'Absorvente Higiênico com Abas', brand: 'Sempre Livre', unit: 'pct', priceInCents: 999, stockQuantity: 50, aliases: ['absorvente', 'sempre livre'] },
  { categoryKey: 'higiene', name: 'Fralda Descartável Tamanho M', brand: 'Pampers', unit: 'pct', priceInCents: 3999, stockQuantity: 30, aliases: ['fralda', 'pampers'] },

  // Congelados
  { categoryKey: 'congelados', name: 'Pizza Congelada Mussarela 460g', brand: 'Sadia', unit: 'g', unitSize: '460g', priceInCents: 1499, stockQuantity: 30, aliases: ['pizza', 'pizza sadia', 'pizza mussarela'] },
  { categoryKey: 'congelados', name: 'Batata Palito Congelada 1kg', brand: 'McCain', unit: 'kg', unitSize: '1kg', priceInCents: 1899, stockQuantity: 35, aliases: ['batata frita', 'batata palito', 'mccain'] },
  { categoryKey: 'congelados', name: 'Hambúrguer Bovino Congelado 672g', brand: 'Sadia', unit: 'g', unitSize: '672g', priceInCents: 1699, stockQuantity: 30, aliases: ['hamburguer', 'hamburguer sadia'] },
  { categoryKey: 'congelados', name: 'Lasanha Congelada Bolonhesa 600g', brand: 'Sadia', unit: 'g', unitSize: '600g', priceInCents: 1799, stockQuantity: 25, aliases: ['lasanha', 'lasanha sadia'] },
  { categoryKey: 'congelados', name: 'Nuggets de Frango Congelado 300g', brand: 'Perdigão', unit: 'g', unitSize: '300g', priceInCents: 1299, stockQuantity: 40, aliases: ['nuggets', 'nuggets perdigao'] },
  { categoryKey: 'congelados', name: 'Sorvete de Chocolate 1,5L', brand: 'Kibon', unit: 'l', unitSize: '1,5L', priceInCents: 1999, stockQuantity: 25, aliases: ['sorvete', 'sorvete kibon', 'sorvete chocolate'] },
  { categoryKey: 'congelados', name: 'Polpa de Fruta Congelada Açaí 400g', brand: 'Frutop', unit: 'g', unitSize: '400g', priceInCents: 999, stockQuantity: 40, aliases: ['acai', 'polpa de acai'] },
  { categoryKey: 'congelados', name: 'Legumes Congelados Sortidos 300g', brand: 'Camil', unit: 'g', unitSize: '300g', priceInCents: 899, stockQuantity: 35, aliases: ['legumes congelados', 'legumes sortidos'] },

  // Pet
  { categoryKey: 'pet', name: 'Ração Cães Adultos 15kg', brand: 'Pedigree', unit: 'kg', unitSize: '15kg', priceInCents: 12999, stockQuantity: 15, aliases: ['racao', 'racao cachorro', 'pedigree'] },
  { categoryKey: 'pet', name: 'Ração Gatos Adultos 10kg', brand: 'Whiskas', unit: 'kg', unitSize: '10kg', priceInCents: 9999, stockQuantity: 15, aliases: ['racao gato', 'whiskas'] },
  { categoryKey: 'pet', name: 'Areia Sanitária para Gatos 4kg', brand: 'Pipicat', unit: 'kg', unitSize: '4kg', priceInCents: 2999, stockQuantity: 20, aliases: ['areia sanitaria', 'pipicat', 'areia de gato'] },
  { categoryKey: 'pet', name: 'Petisco para Cães 100g', brand: 'Pedigree', unit: 'g', unitSize: '100g', priceInCents: 899, stockQuantity: 30, aliases: ['petisco', 'petisco cachorro'] },
  { categoryKey: 'pet', name: 'Sachê para Gatos 85g', brand: 'Whiskas', unit: 'g', unitSize: '85g', priceInCents: 249, stockQuantity: 60, aliases: ['sache', 'sache gato'] },
  { categoryKey: 'pet', name: 'Ração Filhotes Cães 3kg', brand: 'Pedigree', unit: 'kg', unitSize: '3kg', priceInCents: 4999, stockQuantity: 20, aliases: ['racao filhote'] },
  { categoryKey: 'pet', name: 'Tapete Higiênico', brand: 'Carrefour', unit: 'pct', priceInCents: 3499, stockQuantity: 25, aliases: ['tapete higienico'] },
  { categoryKey: 'pet', name: 'Brinquedo Mordedor para Cães', unit: 'un', priceInCents: 1999, stockQuantity: 25, aliases: ['brinquedo', 'mordedor'] },
]
