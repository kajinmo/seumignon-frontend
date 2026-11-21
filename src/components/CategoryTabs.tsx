/**
 * Sticky Category Navigation & Search Bar inspired by Foodpanda (`panda3.png`) and Sweetgreen (`sweetgreen2.png`).
 */

import { Search, X } from 'lucide-react';

interface CategoryTabsProps {
  categories: ReadonlyArray<{ name: string; count: number }>;
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}: CategoryTabsProps) {
  return (
    <div className="sticky top-[68px] z-20 border-b border-border bg-canvas shadow-2xs">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar no cardápio..."
            aria-label="Buscar no cardápio"
            className="w-full rounded-full border border-border bg-surface py-1.5 pl-9 pr-8 text-sm text-ink-primary placeholder:text-ink-secondary focus:border-brand-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Horizontal Scrollable Category Pills */}
        <nav
          aria-label="Categorias do Cardápio"
          className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0"
        >
          <button
            type="button"
            onClick={() => onSelectCategory('ALL')}
            aria-pressed={activeCategory === 'ALL'}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              activeCategory === 'ALL'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'border border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink-primary'
            }`}
          >
            Todos ({categories.reduce((acc, c) => acc + c.count, 0)})
          </button>

          {categories.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => onSelectCategory(cat.name)}
                aria-pressed={isActive}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'border border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink-primary'
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
