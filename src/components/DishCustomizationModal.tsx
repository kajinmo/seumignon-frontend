/**
 * Focused Dish Customization Modal combining Foodpanda's agile modal container (`panda4.png`)
 * with Sweetgreen's visual side-dish photo cards and central circular quantity counters (`sweetgreen3.png` & `sweetgreen4.png`).
 *
 * Epic E0 Guardrails:
 * 1. Displays ONLY the required included sides (`min_choices: 3, max_choices: 3`) in a 3-column (mobile) / 4-column (desktop) photo grid.
 * 2. Paid extra sides are NOT stacked inside this modal to keep the meal assembly experience uncluttered.
 * 3. Customers can repeat the same side (e.g., 2x Arroz + 1x Batata Frita = 3/3).
 * 4. "Adicionar à sacola" CTA unlocks strictly when `min_choices <= sum <= max_choices` is satisfied.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import {
  calculateLineItemTotalCents,
  canIncrementChoiceInGroup,
  formatCentsToBRL,
  resolveDishImageUrl,
  resolveSideChoiceImageUrl,
  validateChoiceGroup,
  type ChoiceGroup,
  type MenuItem,
  type PricedChoiceSelection,
  type SelectedChoiceInput,
} from '../domain';

interface DishCustomizationModalProps {
  dish: MenuItem | null;
  onClose: () => void;
  onConfirmAddToCart: (params: {
    dish: MenuItem;
    quantity: number;
    choices: PricedChoiceSelection[];
    notes: string;
  }) => void;
}

export function DishCustomizationModal({
  dish,
  onClose,
  onConfirmAddToCart,
}: DishCustomizationModalProps) {
  const [quantitiesByChoiceId, setQuantitiesByChoiceId] = useState<Record<string, number>>({});
  const [dishQuantity, setDishQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  // Reset state whenever a new dish opens
  useEffect(() => {
    setQuantitiesByChoiceId({});
    setDishQuantity(1);
    setNotes('');
  }, [dish?.item_id]);

  useEffect(() => {
    if (!dish) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dish, onClose]);

  // Filter strictly to required choice groups (e.g., included_sides 3/3) so paid extras do not clutter the modal
  const requiredGroups: ChoiceGroup[] = useMemo(() => {
    if (!dish) return [];
    return dish.choice_groups.filter((g) => g.min_choices > 0);
  }, [dish]);

  const activeSelections: SelectedChoiceInput[] = useMemo(() => {
    const list: SelectedChoiceInput[] = [];
    for (const group of requiredGroups) {
      for (const option of group.items) {
        const qty = quantitiesByChoiceId[option.choice_item_id] ?? 0;
        if (qty > 0) {
          list.push({
            group_id: group.group_id,
            choice_item_id: option.choice_item_id,
            quantity: qty,
          });
        }
      }
    }
    return list;
  }, [requiredGroups, quantitiesByChoiceId]);

  const pricedSelections: PricedChoiceSelection[] = useMemo(() => {
    const list: PricedChoiceSelection[] = [];
    for (const group of requiredGroups) {
      for (const option of group.items) {
        const qty = quantitiesByChoiceId[option.choice_item_id] ?? 0;
        if (qty > 0) {
          list.push({
            group_id: group.group_id,
            choice_item_id: option.choice_item_id,
            name: option.name,
            price_cents: option.price_cents,
            quantity: qty,
          });
        }
      }
    }
    return list;
  }, [requiredGroups, quantitiesByChoiceId]);

  const groupValidations = useMemo(
    () => requiredGroups.map((group) => validateChoiceGroup(group, activeSelections)),
    [requiredGroups, activeSelections],
  );

  const isAllRequiredValid = useMemo(
    () => groupValidations.every((v) => v.isValid),
    [groupValidations],
  );

  if (!dish) {
    return null;
  }

  const lineTotalCents = calculateLineItemTotalCents(
    dish.price_cents,
    pricedSelections,
    dishQuantity,
  );

  function incrementChoice(group: ChoiceGroup, choiceItemId: string) {
    if (!canIncrementChoiceInGroup(group, choiceItemId, activeSelections)) {
      return;
    }
    setQuantitiesByChoiceId((prev) => ({
      ...prev,
      [choiceItemId]: (prev[choiceItemId] ?? 0) + 1,
    }));
  }

  function decrementChoice(choiceItemId: string) {
    setQuantitiesByChoiceId((prev) => {
      const current = prev[choiceItemId] ?? 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[choiceItemId];
        return next;
      }
      return {
        ...prev,
        [choiceItemId]: current - 1,
      };
    });
  }

  function handleSubmit() {
    if (!dish || !isAllRequiredValid) return;
    onConfirmAddToCart({
      dish,
      quantity: dishQuantity,
      choices: pricedSelections,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dish-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Top Dish Hero Image (45° angle) */}
          <div className="relative h-48 w-full bg-subtle sm:h-56">
            <img
              src={resolveDishImageUrl(dish.name, dish.image_url)}
              alt={dish.name}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela do prato"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface/95 text-ink-primary shadow-md transition hover:bg-subtle"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Dish Header Details */}
          <div className="border-b border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="dish-modal-title"
                  className="font-display text-2xl font-bold uppercase tracking-tight text-ink-primary"
                >
                  {dish.name}
                </h2>
                {dish.size && (
                  <span className="mt-0.5 inline-block text-xs font-semibold text-ink-secondary">
                    Tamanho: {dish.size}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-lg font-bold text-brand-primary">
                {formatCentsToBRL(dish.price_cents)}
              </span>
            </div>
            {dish.description && (
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{dish.description}</p>
            )}
          </div>

          {/* Sweetgreen-Inspired 3x4 Visual Photo Grid for the 3 Included Sides */}
          {requiredGroups.map((group, idx) => {
            const validation = groupValidations[idx];
            const isComplete = validation.isValid;

            return (
              <section key={group.group_id} className="border-b border-border p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold uppercase tracking-tight text-ink-primary">
                      {group.name}
                    </h3>
                    <p className="text-xs text-ink-secondary">
                      Toque nas fotos para escolher {group.max_choices} acompanhamentos inclusos
                      (pode repetir!).
                    </p>
                  </div>

                  {/* Live 0/3 -> 3/3 Counter Pill */}
                  <span
                    data-testid={`group-counter-${group.group_id}`}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition ${
                      isComplete
                        ? 'bg-status-success text-white'
                        : 'bg-brand-primary/15 text-brand-primary'
                    }`}
                  >
                    {isComplete && <Check className="h-3.5 w-3.5" />}
                    {validation.selectedCount}/{group.max_choices}
                  </span>
                </div>

                {/* 3 columns on mobile, 4 columns on desktop (Sweetgreen style) */}
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {group.items
                    .filter((option) => option.enabled)
                    .map((option) => {
                      const selectedQty = quantitiesByChoiceId[option.choice_item_id] ?? 0;
                      const canAddMore = canIncrementChoiceInGroup(
                        group,
                        option.choice_item_id,
                        activeSelections,
                      );
                      const photoUrl = resolveSideChoiceImageUrl(option.name, option.image_url);

                      return (
                        <div
                          key={option.choice_item_id}
                          className="flex flex-col items-center text-center"
                        >
                          {/* Clickable Square Photo Card with Central Circular Quantity Counter */}
                          <div
                            role="button"
                            tabIndex={0}
                            aria-label={`Adicionar ${option.name} (${String(selectedQty)} selecionado)`}
                            onClick={() => {
                              if (canAddMore) {
                                incrementChoice(group, option.choice_item_id);
                              } else if (selectedQty > 0) {
                                decrementChoice(option.choice_item_id);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (canAddMore) {
                                  incrementChoice(group, option.choice_item_id);
                                } else if (selectedQty > 0) {
                                  decrementChoice(option.choice_item_id);
                                }
                              }
                            }}
                            className={`group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border-2 transition ${
                              selectedQty > 0
                                ? 'border-brand-primary ring-2 ring-brand-primary/30'
                                : canAddMore
                                  ? 'border-border hover:border-brand-primary/50'
                                  : 'cursor-not-allowed border-border opacity-55'
                            }`}
                          >
                            <img
                              src={photoUrl}
                              alt={option.name}
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                            />

                            {/* Sweetgreen-style center quantity badge when selected */}
                            {selectedQty > 0 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                <span
                                  data-testid={`side-badge-${option.choice_item_id}`}
                                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand-primary font-display text-base font-bold text-white shadow-lg"
                                >
                                  {selectedQty}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Side Dish Name */}
                          <span className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight text-ink-primary">
                            {option.name}
                          </span>

                          {/* Quick - / + Stepper Controls when at least 1 is selected */}
                          {selectedQty > 0 && (
                            <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-border bg-subtle px-2 py-0.5">
                              <button
                                type="button"
                                onClick={() => decrementChoice(option.choice_item_id)}
                                aria-label={`Diminuir ${option.name}`}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-ink-primary hover:bg-surface"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-xs font-bold text-brand-primary">
                                {selectedQty}x
                              </span>
                              <button
                                type="button"
                                disabled={!canAddMore}
                                onClick={() => incrementChoice(group, option.choice_item_id)}
                                aria-label={`Aumentar ${option.name}`}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-ink-primary hover:bg-surface disabled:opacity-35"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </section>
            );
          })}

          {/* Optional Kitchen Notes (e.g., "Carne ao ponto") */}
          <section className="p-5">
            <label
              htmlFor="dish-kitchen-notes"
              className="block text-xs font-bold uppercase tracking-wider text-ink-secondary"
            >
              Observações para a cozinha (opcional)
            </label>
            <input
              id="dish-kitchen-notes"
              type="text"
              maxLength={140}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: Carne ao ponto para mal passada, sem cebola..."
              className="mt-1.5 w-full rounded-xl border border-border bg-subtle/50 px-3.5 py-2.5 text-sm text-ink-primary placeholder:text-ink-secondary focus:border-brand-primary focus:bg-surface focus:outline-none"
            />
          </section>
        </div>

        {/* Sticky Bottom Bar with Dish Quantity Stepper & Live Centavos CTA */}
        <footer className="border-t border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            {/* Dish Quantity Stepper */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-subtle px-2.5 py-2">
              <button
                type="button"
                disabled={dishQuantity <= 1}
                onClick={() => setDishQuantity((q) => Math.max(1, q - 1))}
                aria-label="Diminuir quantidade do prato"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-ink-primary shadow-2xs disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span
                data-testid="modal-dish-quantity"
                className="min-w-[1.5rem] text-center text-sm font-bold text-ink-primary"
              >
                {dishQuantity}
              </span>
              <button
                type="button"
                onClick={() => setDishQuantity((q) => q + 1)}
                aria-label="Aumentar quantidade do prato"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-ink-primary shadow-2xs"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Primary Add-to-Cart Button */}
            <button
              type="button"
              disabled={!isAllRequiredValid}
              onClick={handleSubmit}
              className="flex flex-1 items-center justify-between rounded-xl bg-brand-primary px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-ink-secondary disabled:shadow-none"
            >
              <span>
                {isAllRequiredValid
                  ? 'Adicionar à sacola'
                  : `Escolha os ${String(groupValidations[0]?.maxChoices ?? 3)} acompanhamentos (${String(groupValidations[0]?.selectedCount ?? 0)}/${String(groupValidations[0]?.maxChoices ?? 3)})`}
              </span>
              <span>{formatCentsToBRL(lineTotalCents)}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
