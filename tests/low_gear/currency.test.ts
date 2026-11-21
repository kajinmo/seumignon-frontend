import { describe, expect, it } from 'vitest';
import {
  calculateCartSubtotalCents,
  calculateConfiguredUnitCents,
  calculateLineItemTotalCents,
  calculateOrderTotalCents,
  formatCentsToBRL,
  type CartLineItem,
} from '../../src/domain';

describe('low_gear: integer centavos currency arithmetic & BRL formatting', () => {
  it('formats integer centavos to pt-BR currency string at the presentation boundary', () => {
    expect(formatCentsToBRL(0)).toBe('R$ 0,00');
    expect(formatCentsToBRL(500)).toBe('R$ 5,00');
    expect(formatCentsToBRL(2990)).toBe('R$ 29,90');
    expect(formatCentsToBRL(6890)).toBe('R$ 68,90');
    expect(formatCentsToBRL(12450)).toBe('R$ 124,50');
  });

  it('rejects floating-point numbers to enforce the integer centavos guardrail', () => {
    expect(() => formatCentsToBRL(29.9)).toThrow(TypeError);
    expect(() => calculateConfiguredUnitCents(68.9, [])).toThrow(TypeError);
    expect(() => calculateLineItemTotalCents(6890, [], 1.5)).toThrow(TypeError);
  });

  it('computes line-item total matching backend/Saipos formula: (item.price_cents + sum(choice.price_cents * choice.quantity)) * item.quantity', () => {
    const includedSides = [
      { price_cents: 0, quantity: 2 }, // 2x Arroz Branco (included)
      { price_cents: 0, quantity: 1 }, // 1x Batata Frita (included)
    ];

    // 1x Parmegiana (6890) + 3 included sides (0) = 6890
    expect(calculateLineItemTotalCents(6890, includedSides, 1)).toBe(6890);

    // 2x Parmegiana (6890) with 1 paid modifier (1200 * 2 = 2400) => (6890 + 2400) * 2 = 18580
    const withPaidModifiers = [...includedSides, { price_cents: 1200, quantity: 2 }];
    expect(calculateLineItemTotalCents(6890, withPaidModifiers, 2)).toBe(18580);
  });

  it('computes cart subtotal and final order total in integer centavos', () => {
    const cartItems: CartLineItem[] = [
      {
        cart_line_id: 'line_1',
        item_id: 'item_mignon_1',
        name: 'Parmegiana de Mignon',
        size: 'Individual',
        unit_price_cents: 6890,
        quantity: 2,
        choices: [
          {
            group_id: 'included_sides',
            choice_item_id: 'side_arroz',
            name: 'Arroz Branco',
            price_cents: 0,
            quantity: 3,
          },
        ],
        notes: '',
      },
      {
        cart_line_id: 'line_2',
        item_id: 'extra_fritas',
        name: 'Porção Extra Batata Frita',
        size: 'Porção',
        unit_price_cents: 1800,
        quantity: 1,
        choices: [],
        notes: '',
      },
    ];

    const subtotalCents = calculateCartSubtotalCents(cartItems);
    expect(subtotalCents).toBe(6890 * 2 + 1800); // 15580

    const totalCents = calculateOrderTotalCents({
      subtotalCents,
      deliveryFeeCents: 800,
      discountCents: 500,
    });
    expect(totalCents).toBe(15880);
  });
});
