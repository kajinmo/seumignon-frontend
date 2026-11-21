import { describe, expect, it } from 'vitest';
import {
  INITIAL_CHECKOUT_FORM_DRAFT,
  buildCreateOrderRequest,
  stripNonDigits,
  upsertRecentOrderList,
  validateCheckoutForm,
  type CartLineItem,
  type CheckoutFormDraft,
  type DeliveryZone,
  type OrderResponse,
} from '../../src/domain';

const sampleZones: DeliveryZone[] = [
  { zone_id: 'zone_jardins', name: 'Jardins', distance_km: 1.2, fee_cents: 500 },
  { zone_id: 'zone_consolacao', name: 'Consolação', distance_km: 2.8, fee_cents: 800 },
  { zone_id: 'zone_pinheiros', name: 'Pinheiros', distance_km: 4.9, fee_cents: 900 },
];

const validDraft: CheckoutFormDraft = {
  name: 'Maria Silva',
  phone: '(11) 99999-8888',
  email: 'Maria@Example.com ',
  documentNumber: '123.456.789-09',
  zoneId: 'zone_consolacao',
  postalCode: '01304-001',
  streetName: 'Rua Augusta',
  streetNumber: '1500',
  complement: 'Apto 42',
  reference: 'Próximo ao metrô',
  notes: 'Interfone 42',
};

describe('low_gear: checkout form validation, POST /orders payload builder & recent order list', () => {
  it('strips non-numeric formatting characters from phone, CPF, and CEP', () => {
    expect(stripNonDigits('(11) 99999-8888')).toBe('11999998888');
    expect(stripNonDigits('123.456.789-09')).toBe('12345678909');
    expect(stripNonDigits('01304-001')).toBe('01304001');
  });

  it('validates a complete checkout form and flags missing or invalid fields', () => {
    const validResult = validateCheckoutForm(validDraft, sampleZones);
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toEqual({});

    const invalidResult = validateCheckoutForm(INITIAL_CHECKOUT_FORM_DRAFT, sampleZones);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.name).toBeDefined();
    expect(invalidResult.errors.phone).toBeDefined();
    expect(invalidResult.errors.email).toBeDefined();
    expect(invalidResult.errors.documentNumber).toBeDefined();
    expect(invalidResult.errors.zoneId).toBeDefined();
    expect(invalidResult.errors.postalCode).toBeDefined();
    expect(invalidResult.errors.streetName).toBeDefined();
    expect(invalidResult.errors.streetNumber).toBeDefined();
  });

  it('builds the exact CreateOrderRequest contract for POST /orders', () => {
    const cartItems: CartLineItem[] = [
      {
        cart_line_id: 'line_1',
        item_id: 'item_mignon_1',
        name: 'Parmegiana de Mignon',
        size: 'Individual',
        unit_price_cents: 6890,
        quantity: 1,
        choices: [
          {
            group_id: 'included_sides',
            choice_item_id: 'side_arroz',
            name: 'Arroz Branco',
            price_cents: 0,
            quantity: 2,
          },
          {
            group_id: 'included_sides',
            choice_item_id: 'side_fritas',
            name: 'Batata Frita',
            price_cents: 0,
            quantity: 1,
          },
        ],
        notes: 'Carne ao ponto',
      },
    ];

    const payload = buildCreateOrderRequest({
      draft: validDraft,
      cartItems,
    });

    expect(payload).toEqual({
      customer: {
        name: 'Maria Silva',
        phone: '11999998888',
        email: 'maria@example.com',
        document_number: '12345678909',
        customer_id: '',
      },
      delivery_address: {
        zone_id: 'zone_consolacao',
        street_name: 'Rua Augusta',
        street_number: '1500',
        city: 'São Paulo',
        state: 'SP',
        postal_code: '01304001',
        complement: 'Apto 42',
        reference: 'Próximo ao metrô',
        country: 'BR',
      },
      items: [
        {
          item_id: 'item_mignon_1',
          quantity: 1,
          choices: [
            {
              group_id: 'included_sides',
              choice_item_id: 'side_arroz',
              quantity: 2,
              notes: '',
            },
            {
              group_id: 'included_sides',
              choice_item_id: 'side_fritas',
              quantity: 1,
              notes: '',
            },
          ],
          notes: 'Carne ao ponto',
        },
      ],
      notes: 'Interfone 42',
    });
  });

  it('upserts recent orders without duplicates and preserves most recent order first', () => {
    const sampleOrder: OrderResponse = {
      order_id: 'ord_e24dd227043c47b3',
      display_id: '4821',
      status: 'PENDING',
      created_at_iso: '2026-11-21T15:00:00+00:00',
      subtotal_cents: 6890,
      delivery_fee_cents: 800,
      discount_cents: 0,
      total_cents: 7690,
      payment_link_id: 'pl_123',
      checkout_url: 'https://payment-link.pagar.me/pl_123',
      payment_method: '',
      items: [],
      notes: '',
    };

    const list1 = upsertRecentOrderList([], sampleOrder);
    expect(list1).toHaveLength(1);
    expect(list1[0].order_id).toBe('ord_e24dd227043c47b3');

    const updatedOrder: OrderResponse = { ...sampleOrder, status: 'PAID' };
    const list2 = upsertRecentOrderList(list1, updatedOrder);
    expect(list2).toHaveLength(1);
    expect(list2[0].status).toBe('PAID');
  });
});
