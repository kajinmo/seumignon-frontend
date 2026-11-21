/**
 * Pure integer-centavos arithmetic and BRL formatting helpers.
 * Guardrail: All price math runs in integer centavos; never perform price arithmetic in floating-point reais.
 */

import type { CartLineItem, PricedChoiceSelection } from './types';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Ensures a monetary value or quantity is a finite integer.
 */
export function assertInteger(value: number, label = 'value'): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Expected ${label} to be an integer, received ${String(value)}.`);
  }
}

/**
 * Ensures a monetary amount in centavos is a non-negative integer.
 */
export function assertNonNegativeCents(cents: number, label = 'cents'): void {
  assertInteger(cents, label);
  if (cents < 0) {
    throw new RangeError(`Expected ${label} to be non-negative, received ${String(cents)}.`);
  }
}

/**
 * Formats integer centavos (e.g., 6890) into a localized Brazilian Real string (e.g., "R$ 68,90").
 * Normalizes non-breaking spaces produced by Intl.NumberFormat to standard space for consistent UI assertions.
 */
export function formatCentsToBRL(cents: number): string {
  assertInteger(cents, 'cents');
  return brlFormatter.format(cents / 100).replace(/\u00a0/g, ' ');
}

/**
 * Computes the unit price of a dish plus all selected choice modifiers in integer centavos:
 * item.price_cents + sum(choice.price_cents * choice.quantity)
 */
export function calculateConfiguredUnitCents(
  basePriceCents: number,
  choices: ReadonlyArray<Pick<PricedChoiceSelection, 'price_cents' | 'quantity'>>,
): number {
  assertNonNegativeCents(basePriceCents, 'basePriceCents');

  let modifiersTotalCents = 0;
  for (const choice of choices) {
    assertNonNegativeCents(choice.price_cents, 'choice.price_cents');
    assertInteger(choice.quantity, 'choice.quantity');
    if (choice.quantity < 0) {
      throw new RangeError(
        `Choice quantity cannot be negative, received ${String(choice.quantity)}.`,
      );
    }
    modifiersTotalCents += choice.price_cents * choice.quantity;
  }

  return basePriceCents + modifiersTotalCents;
}

/**
 * Computes the line-item total in integer centavos matching the backend/Saipos formula:
 * (item.price_cents + sum(choice.price_cents * choice.quantity)) * item.quantity
 */
export function calculateLineItemTotalCents(
  basePriceCents: number,
  choices: ReadonlyArray<Pick<PricedChoiceSelection, 'price_cents' | 'quantity'>>,
  itemQuantity: number,
): number {
  assertInteger(itemQuantity, 'itemQuantity');
  if (itemQuantity <= 0) {
    throw new RangeError(`Item quantity must be at least 1, received ${String(itemQuantity)}.`);
  }

  const configuredUnitCents = calculateConfiguredUnitCents(basePriceCents, choices);
  return configuredUnitCents * itemQuantity;
}

/**
 * Computes the cart subtotal in integer centavos across all cart line items.
 */
export function calculateCartSubtotalCents(items: ReadonlyArray<CartLineItem>): number {
  return items.reduce(
    (acc, item) =>
      acc + calculateLineItemTotalCents(item.unit_price_cents, item.choices, item.quantity),
    0,
  );
}

/**
 * Computes the final order total in integer centavos:
 * max(0, subtotal_cents + delivery_fee_cents - discount_cents)
 */
export function calculateOrderTotalCents(params: {
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents?: number;
}): number {
  const { subtotalCents, deliveryFeeCents, discountCents = 0 } = params;
  assertNonNegativeCents(subtotalCents, 'subtotalCents');
  assertNonNegativeCents(deliveryFeeCents, 'deliveryFeeCents');
  assertNonNegativeCents(discountCents, 'discountCents');

  return Math.max(0, subtotalCents + deliveryFeeCents - discountCents);
}
