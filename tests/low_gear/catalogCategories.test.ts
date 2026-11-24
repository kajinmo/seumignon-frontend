import { describe, expect, it } from 'vitest';
import {
  buildCategoryShortcuts,
  classifyMenuItemCategory,
  filterAndGroupMenuByShortcut,
  type MenuItem,
} from '../../src/domain';

const sampleCatalog: MenuItem[] = [
  {
    item_id: 'mignon-grelhado',
    name: 'Medalhão de Filé Mignon Grelhado',
    category: 'Pratos Executivos',
    size: 'Individual',
    price_cents: 6990,
    description: 'Corte alto selado na brasa.',
    image_url: '',
    choice_groups: [],
  },
  {
    item_id: 'mignon-parmegiana',
    name: 'Filé Mignon à Parmegiana',
    category: 'Pratos Executivos',
    size: 'M',
    price_cents: 6890,
    description: 'Empanado artesanal gratinado com queijo e molho.',
    image_url: '',
    choice_groups: [],
  },
  {
    item_id: 'strogonoff-mignon',
    name: 'Strogonoff de Filé Mignon',
    category: 'Especialidades',
    size: 'Individual',
    price_cents: 5990,
    description: 'Preparado na panela com creme de leite fresco.',
    image_url: '',
    choice_groups: [],
  },
  {
    item_id: 'frango-empanado',
    name: 'Filé de Frango Empanado',
    category: 'Pratos Executivos',
    size: 'Individual',
    price_cents: 4290,
    description: 'Crocante por fora e suculento por dentro.',
    image_url: '',
    choice_groups: [],
  },
  {
    item_id: 'batata-extra',
    name: 'Porção de Batata Frita',
    category: 'Acompanhamentos Extras',
    size: 'Porção',
    price_cents: 1500,
    description: 'Crocante na hora.',
    image_url: '',
    choice_groups: [],
  },
  {
    item_id: 'pudim-leite',
    name: 'Pudim de Leite Condensado',
    category: 'Sobremesa',
    size: 'Fatia',
    price_cents: 1600,
    description: 'Calda de caramelo artesanal.',
    image_url: '',
    choice_groups: [],
  },
  {
    item_id: 'coca-lata',
    name: 'Coca-Cola Lata 350ml',
    category: 'Bebidas',
    size: '350ml',
    price_cents: 700,
    description: 'Bem gelada.',
    image_url: '',
    choice_groups: [],
  },
];

describe('low_gear: curated storefront category shortcuts classification & grouping', () => {
  it('classifies grilled cuts, pan/breaded classics, sides, desserts, and drinks accurately', () => {
    expect(classifyMenuItemCategory(sampleCatalog[0])).toBe('GRILLED');
    expect(classifyMenuItemCategory(sampleCatalog[1])).toBe('KITCHEN_CLASSICS');
    expect(classifyMenuItemCategory(sampleCatalog[2])).toBe('KITCHEN_CLASSICS');
    expect(classifyMenuItemCategory(sampleCatalog[3])).toBe('KITCHEN_CLASSICS');
    expect(classifyMenuItemCategory(sampleCatalog[4])).toBe('SIDES');
    expect(classifyMenuItemCategory(sampleCatalog[5])).toBe('DESSERTS');
    expect(classifyMenuItemCategory(sampleCatalog[6])).toBe('DRINKS');
  });

  it('builds all 6 curated category shortcuts with accurate counts', () => {
    const shortcuts = buildCategoryShortcuts(sampleCatalog);
    expect(shortcuts.map((s) => s.label)).toEqual([
      'Os mais pedidos',
      'Grelhados',
      'Clássicos da Cozinha',
      'Acompanhamentos',
      'Sobremesa',
      'Bebidas',
    ]);

    const countByLabel = Object.fromEntries(shortcuts.map((s) => [s.label, s.count]));
    expect(countByLabel['Os mais pedidos']).toBe(4);
    expect(countByLabel['Grelhados']).toBe(1);
    expect(countByLabel['Clássicos da Cozinha']).toBe(3);
    expect(countByLabel['Acompanhamentos']).toBe(1);
    expect(countByLabel['Sobremesa']).toBe(1);
    expect(countByLabel['Bebidas']).toBe(1);
  });

  it('groups ALL view by curated section order and filters by specific shortcut + search query', () => {
    const allGroups = filterAndGroupMenuByShortcut(sampleCatalog, 'ALL', '');
    expect(allGroups.map((g) => g.categoryName)).toEqual([
      'Grelhados',
      'Clássicos da Cozinha',
      'Acompanhamentos',
      'Sobremesa',
      'Bebidas',
    ]);

    const classicsOnly = filterAndGroupMenuByShortcut(sampleCatalog, 'KITCHEN_CLASSICS', '');
    expect(classicsOnly).toHaveLength(1);
    expect(classicsOnly[0].categoryName).toBe('Clássicos da Cozinha');
    expect(classicsOnly[0].items.map((i) => i.item_id)).toEqual([
      'mignon-parmegiana',
      'strogonoff-mignon',
      'frango-empanado',
    ]);

    const searchStrogonoff = filterAndGroupMenuByShortcut(sampleCatalog, 'ALL', 'strogonoff');
    expect(searchStrogonoff).toHaveLength(1);
    expect(searchStrogonoff[0].items[0].item_id).toBe('strogonoff-mignon');
  });
});
