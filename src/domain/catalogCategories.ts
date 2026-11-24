/**
 * Pure domain helpers for curated storefront category shortcuts:
 * "Os mais pedidos", "Grelhados", "Clássicos da Cozinha", "Acompanhamentos", "Sobremesa", "Bebidas", plus "Todos".
 * Zero React, DOM, or HTTP dependencies (`low_gear` unit-testable).
 */

import { normalizeSearchText } from './delivery';
import type { MenuItem } from './types';

export type PrimaryCatalogSectionId =
  'GRILLED' | 'KITCHEN_CLASSICS' | 'SIDES' | 'DESSERTS' | 'DRINKS';

export type CategoryShortcutId = 'ALL' | 'MOST_ORDERED' | PrimaryCatalogSectionId;

export interface CategoryShortcutDefinition {
  id: CategoryShortcutId;
  label: string;
}

export interface CategoryShortcutWithCount extends CategoryShortcutDefinition {
  count: number;
}

export interface CatalogSectionGroup {
  shortcutId: CategoryShortcutId;
  categoryName: string;
  items: MenuItem[];
}

export const CURATED_CATEGORY_SHORTCUTS: ReadonlyArray<CategoryShortcutDefinition> = [
  { id: 'MOST_ORDERED', label: 'Os mais pedidos' },
  { id: 'GRILLED', label: 'Grelhados' },
  { id: 'KITCHEN_CLASSICS', label: 'Clássicos da Cozinha' },
  { id: 'SIDES', label: 'Acompanhamentos' },
  { id: 'DESSERTS', label: 'Sobremesa' },
  { id: 'DRINKS', label: 'Bebidas' },
];

const SECTION_LABELS: Record<PrimaryCatalogSectionId, string> = {
  GRILLED: 'Grelhados',
  KITCHEN_CLASSICS: 'Clássicos da Cozinha',
  SIDES: 'Acompanhamentos',
  DESSERTS: 'Sobremesa',
  DRINKS: 'Bebidas',
};

const SIDE_KEYWORDS = ['acompanhamento', 'porcao', 'guarnicao', 'side'];
const DESSERT_KEYWORDS = [
  'sobremesa',
  'doce',
  'pudim',
  'brownie',
  'mousse',
  'petit',
  'sorvete',
  'torta',
  'cheesecake',
];
const DRINK_CATEGORY_KEYWORDS = ['bebida', 'refrigerante', 'suco', 'cerveja', 'agua', 'vinho'];
const DRINK_NAME_KEYWORDS = [
  'coca-cola',
  'guarana',
  'refrigerante',
  'suco',
  'agua mineral',
  'cerveja',
];
const CLASSIC_DISH_KEYWORDS = [
  'parmegiana',
  'strogonoff',
  'estrogonofe',
  'empanad',
  'milanesa',
  'picadinho',
  'risoto',
  'massa',
  'fricass',
  'escondidinho',
  'molho madeira',
  'molho gorgonzola',
  'molho mostarda',
  'poivre',
];
const CLASSIC_CATEGORY_KEYWORDS = ['classico', 'especialidade', 'panela', 'empanado', 'milanesa'];
const GRILLED_KEYWORDS = [
  'grelhad',
  'brasa',
  'churrasco',
  'bife',
  'medalhao',
  'picanha',
  'ancho',
  'chorizo',
  't-bone',
  'paillard',
  'contrafile',
  'alcatra',
];

function includesAnyKeyword(text: string, keywords: ReadonlyArray<string>): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * Classifies a backend `MenuItem` into one of the curated storefront catalog sections.
 */
export function classifyMenuItemCategory(item: MenuItem): PrimaryCatalogSectionId {
  const category = normalizeSearchText(item.category);
  const name = normalizeSearchText(item.name);
  const description = normalizeSearchText(item.description);
  const combined = `${category} ${name} ${description}`;

  if (includesAnyKeyword(category, SIDE_KEYWORDS)) {
    return 'SIDES';
  }

  if (
    includesAnyKeyword(category, DESSERT_KEYWORDS) ||
    includesAnyKeyword(name, DESSERT_KEYWORDS)
  ) {
    return 'DESSERTS';
  }

  if (
    includesAnyKeyword(category, DRINK_CATEGORY_KEYWORDS) ||
    includesAnyKeyword(name, DRINK_NAME_KEYWORDS)
  ) {
    return 'DRINKS';
  }

  if (
    includesAnyKeyword(category, CLASSIC_CATEGORY_KEYWORDS) ||
    includesAnyKeyword(combined, CLASSIC_DISH_KEYWORDS)
  ) {
    return 'KITCHEN_CLASSICS';
  }

  if (
    includesAnyKeyword(combined, GRILLED_KEYWORDS) ||
    category.includes('carne') ||
    category.includes('mignon') ||
    category.includes('corte')
  ) {
    return 'GRILLED';
  }

  return category.includes('executivo') ? 'KITCHEN_CLASSICS' : 'GRILLED';
}

/**
 * Determines whether a `MenuItem` belongs in the "Os mais pedidos" curated shortcut.
 */
export function isMostOrderedMenuItem(item: MenuItem): boolean {
  const category = normalizeSearchText(item.category);
  if (category.includes('mais pedido') || category.includes('destaque')) {
    return true;
  }
  const section = classifyMenuItemCategory(item);
  return section === 'GRILLED' || section === 'KITCHEN_CLASSICS';
}

/**
 * Returns true if `item` belongs to the given `CategoryShortcutId`.
 */
export function matchesCategoryShortcut(item: MenuItem, shortcutId: CategoryShortcutId): boolean {
  if (shortcutId === 'ALL') {
    return true;
  }
  if (shortcutId === 'MOST_ORDERED') {
    return isMostOrderedMenuItem(item);
  }
  return classifyMenuItemCategory(item) === shortcutId;
}

/**
 * Builds all curated shortcut pills with item counts for the sticky `CategoryTabs` bar.
 */
export function buildCategoryShortcuts(
  items: ReadonlyArray<MenuItem>,
): CategoryShortcutWithCount[] {
  return CURATED_CATEGORY_SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    count: items.filter((item) => matchesCategoryShortcut(item, shortcut.id)).length,
  }));
}

/**
 * Returns the localized pt-BR label for a `CategoryShortcutId`.
 */
export function getCategoryShortcutLabel(shortcutId: CategoryShortcutId): string {
  if (shortcutId === 'ALL') {
    return 'Todos';
  }
  return CURATED_CATEGORY_SHORTCUTS.find((s) => s.id === shortcutId)?.label ?? 'Cardápio';
}

/**
 * Filters and groups catalog items according to the selected curated shortcut and search query.
 */
export function filterAndGroupMenuByShortcut(
  items: ReadonlyArray<MenuItem>,
  activeShortcut: CategoryShortcutId,
  searchQuery: string,
): CatalogSectionGroup[] {
  const normalizedQuery = normalizeSearchText(searchQuery);

  const matchingItems = items.filter((item) => {
    const matchesShortcut = matchesCategoryShortcut(item, activeShortcut);
    const matchesQuery =
      !normalizedQuery ||
      normalizeSearchText(item.name).includes(normalizedQuery) ||
      normalizeSearchText(item.description).includes(normalizedQuery) ||
      normalizeSearchText(item.category).includes(normalizedQuery);
    return matchesShortcut && matchesQuery;
  });

  if (matchingItems.length === 0) {
    return [];
  }

  if (activeShortcut !== 'ALL') {
    return [
      {
        shortcutId: activeShortcut,
        categoryName: getCategoryShortcutLabel(activeShortcut),
        items: matchingItems,
      },
    ];
  }

  const sectionOrder: PrimaryCatalogSectionId[] = [
    'GRILLED',
    'KITCHEN_CLASSICS',
    'SIDES',
    'DESSERTS',
    'DRINKS',
  ];

  const grouped = new Map<PrimaryCatalogSectionId, MenuItem[]>();
  for (const sectionId of sectionOrder) {
    grouped.set(sectionId, []);
  }

  for (const item of matchingItems) {
    const sectionId = classifyMenuItemCategory(item);
    grouped.get(sectionId)?.push(item);
  }

  return sectionOrder
    .filter((sectionId) => (grouped.get(sectionId)?.length ?? 0) > 0)
    .map((sectionId) => ({
      shortcutId: sectionId,
      categoryName: SECTION_LABELS[sectionId],
      items: grouped.get(sectionId) ?? [],
    }));
}
