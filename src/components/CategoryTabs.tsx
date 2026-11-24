/**
 * Sticky Category Navigation Bar inspired by Foodpanda (`panda3.png`) and Sweetgreen (`sweetgreen2.png`).
 * Displays curated category shortcuts ("Os mais pedidos", "Grelhados", "Clássicos da Cozinha",
 * "Acompanhamentos", "Sobremesa", "Bebidas") plus "Todos" with clean touch scrolling and zero scrollbar clutter.
 */

import type { CategoryShortcutId, CategoryShortcutWithCount } from '../domain';

interface CategoryTabsProps {
  shortcuts: ReadonlyArray<CategoryShortcutWithCount>;
  totalItemsCount: number;
  activeShortcut: CategoryShortcutId;
  onSelectShortcut: (shortcut: CategoryShortcutId) => void;
}

export function CategoryTabs({
  shortcuts,
  totalItemsCount,
  activeShortcut,
  onSelectShortcut,
}: CategoryTabsProps) {
  return (
    <div className="sticky top-[68px] z-20 border-b border-border bg-canvas shadow-2xs">
      <div className="mx-auto max-w-6xl px-4 py-3">
        {/* Clean Curated Category Shortcuts (Wraps cleanly on desktop; smooth hidden-scrollbar swipe on mobile) */}
        <nav
          aria-label="Categorias do Cardápio"
          className="no-scrollbar flex items-center gap-2 overflow-x-auto sm:flex-wrap"
        >
          <button
            type="button"
            onClick={() => onSelectShortcut('ALL')}
            aria-pressed={activeShortcut === 'ALL'}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              activeShortcut === 'ALL'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'border border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink-primary'
            }`}
          >
            Todos ({totalItemsCount})
          </button>

          {shortcuts.map((shortcut) => {
            const isActive = activeShortcut === shortcut.id;
            return (
              <button
                key={shortcut.id}
                type="button"
                onClick={() => onSelectShortcut(shortcut.id)}
                aria-pressed={isActive}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'border border-border bg-surface text-ink-secondary hover:bg-subtle hover:text-ink-primary'
                }`}
              >
                {shortcut.label}
                {shortcut.count > 0 ? ` (${shortcut.count})` : ''}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
