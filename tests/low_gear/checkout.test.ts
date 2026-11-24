import { describe, expect, it } from 'vitest';
import {
  INITIAL_CHECKOUT_FORM_DRAFT,
  buildCreateOrderRequest,
  formatCepInput,
  getFriendlyCepErrorMessage,
  isCompleteCep,
  stripNonDigits,
  upsertRecentOrderList,
  validateCheckoutForm,
  type CartLineItem,
  type CheckoutFormDraft,
  type DeliveryFeeQuoteResponse,
  type OrderResponse,
} from '../../src/domain';

const sampleQuote: DeliveryFeeQuoteResponse = {
  cep: '03195000',
  distance_km: 0.0,
  fee_cents: 500,
  district: 'Alto da Mooca',
  source: 'local_index',
};

const validDraft: CheckoutFormDraft = {
  name: 'Maria Silva',
  phone: '(11) 99999-8888',
  email: 'Maria@Example.com ',
  documentNumber: '123.456.789-09',
  postalCode: '03195-000',
  streetName: 'Rua Exemplo',
  streetNumber: '123',
  district: 'Alto da Mooca',
  complement: 'Apto 42',
  reference: 'Próximo ao metrô',
  notes: 'Interfone 42',
};

describe('low_gear: CEP helpers, checkout validation, POST /orders payload builder & recent orders', () => {
  it('strips non-numeric formatting characters and formats CEP as XXXXX-XXX', () => {
    expect(stripNonDigits('(11) 99999-8888')).toBe('11999998888');
    expect(stripNonDigits('123.456.789-09')).toBe('12345678909');
    expect(stripNonDigits('03195-000')).toBe('03195000');

    expect(formatCepInput('03195')).toBe('03195');
    expect(formatCepInput('03195000')).toBe('03195-000');
    expect(formatCepInput('03195-00099')).toBe('03195-000');
    expect(isCompleteCep('03195-000')).toBe(true);
    expect(isCompleteCep('03195-00')).toBe(false);
  });

  it('maps backend 422 CEP error codes into friendly pt-BR messages', () => {
    expect(getFriendlyCepErrorMessage('DeliveryOutOfRangeError', 'Out of range')).toContain(
      '5,5 km',
    );
    expect(getFriendlyCepErrorMessage('CepNotFoundError', 'Not found')).toContain(
      'CEP não encontrado',
    );
    expect(getFriendlyCepErrorMessage('InvalidCepError', 'Invalid')).toContain('8 dígitos');
    expect(getFriendlyCepErrorMessage('UnknownError', 'Detalhe customizado')).toBe(
      'Detalhe customizado',
    );
  });

  it('validates a complete checkout form against authoritative CEP quote and flags missing/mismatched fields', () => {
    const validResult = validateCheckoutForm(validDraft, sampleQuote);
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toEqual({});

    const mismatchedQuoteResult = validateCheckoutForm(validDraft, {
      ...sampleQuote,
      cep: '01304001',
    });
    expect(mismatchedQuoteResult.isValid).toBe(false);
    expect(mismatchedQuoteResult.errors.postalCode).toBeDefined();

    const invalidResult = validateCheckoutForm(INITIAL_CHECKOUT_FORM_DRAFT, null);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.name).toBeDefined();
    expect(invalidResult.errors.phone).toBeDefined();
    expect(invalidResult.errors.email).toBeDefined();
    expect(invalidResult.errors.documentNumber).toBeDefined();
    expect(invalidResult.errors.postalCode).toBeDefined();
    expect(invalidResult.errors.district).toBeDefined();
    expect(invalidResult.errors.streetName).toBeDefined();
    expect(invalidResult.errors.streetNumber).toBeDefined();
  });

  it('builds the exact CreateOrderRequest contract for POST /orders with district and formatted postal_code', () => {
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
      customerId: 'user_abc',
    });

    expect(payload).toEqual({
      customer: {
        name: 'Maria Silva',
        phone: '11999998888',
        email: 'maria@example.com',
        document_number: '12345678909',
        customer_id: 'user_abc',
      },
      delivery_address: {
        postal_code: '03195-000',
        street_name: 'Rua Exemplo',
        street_number: '123',
        district: 'Alto da Mooca',
        city: 'São Paulo',
        state: 'SP',
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
      delivery_fee_cents: 500,
      discount_cents: 0,
      total_cents: 7390,
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
