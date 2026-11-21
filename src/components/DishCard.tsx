/**
 * Compact horizontal dish card inspired by Foodpanda (`panda3.png`) on the warm cream surface.
 * Strictly capped at 2-line descriptions (no nutritional clutter) with a square 1:1 dish photo and quick '+' button.
 */

import { Plus } from 'lucide-react';
import { formatCentsToBRL, resolveDishImageUrl, type MenuItem } from '../domain';

interface DishCardProps {
  item: MenuItem;
  cartQuantity: number;
  onSelectDish: (item: MenuItem) => void;
}

export function DishCard({ item, cartQuantity, onSelectDish }: DishCardProps) {
  const imageUrl = resolveDishImageUrl(item.name, item.image_url);
  const requiredGroup = item.choice_groups.find((g) => g.min_choices > 0);

  return (
    <article
      onClick={() => onSelectDish(item)}
      className="group relative flex cursor-pointer items-stretch justify-between gap-4 rounded-2xl border border-border bg-surface p-3.5 shadow-2xs transition duration-150 hover:-translate-y-0.5 hover:border-brand-primary/40 hover:bg-subtle/70 hover:shadow-md"
    >
      {/* Left Column: Title, Size Badge, 2-line Description & Integer-Centavos BRL Price */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-bold leading-snug text-ink-primary group-hover:text-brand-primary">
              {item.name}
            </h3>
            {item.size && (
              <span className="rounded-md bg-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
                {item.size}
              </span>
            )}
          </div>

          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-secondary">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-brand-primary">
            {formatCentsToBRL(item.price_cents)}
          </span>
          {requiredGroup && (
            <span className="rounded-full border border-brand-primary/25 bg-brand-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
              +{requiredGroup.max_choices} acomp. inclusos
            </span>
          )}
        </div>
      </div>

      {/* Right Column: Square 1:1 Dish Photo (45° angle) + Quick '+' Action Button */}
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-subtle">
        <img
          src={imageUrl}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectDish(item);
          }}
          aria-label={`Escolher ${item.name}`}
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white shadow-md transition hover:bg-brand-hover"
        >
          {cartQuantity > 0 ? (
            <span className="text-xs font-bold">{cartQuantity}</span>
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
      </div>
    </article>
  );
}
