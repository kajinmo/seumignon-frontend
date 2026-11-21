import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { RECENT_ORDERS_STORAGE_KEY } from '../../src/contexts/CartContext';
import type { CreateOrderRequest, MenuResponse, OrderResponse } from '../../src/domain';

const checkoutMenuResponse: MenuResponse = {
  updated_at_iso: '2026-11-21T15:00:00+00:00',
  items: [
    {
      item_id: 'item_mignon_1',
      name: 'Parmegiana de Mignon',
      category: 'Pratos Executivos',
      size: 'Individual',
      price_cents: 6890,
      description: 'Filé mignon empanado com molho artesanal e queijo gratinado.',
      image_url: 'https://example.com/parmegiana.jpg',
      choice_groups: [
        {
          group_id: 'included_sides',
          name: 'Acompanhamentos Inclusos',
          min_choices: 3,
          max_choices: 3,
          items: [
            {
              choice_item_id: 'side_arroz',
              name: 'Arroz Branco',
              price_cents: 0,
              enabled: true,
            },
            {
              choice_item_id: 'side_fritas',
              name: 'Batata Frita',
              price_cents: 0,
              enabled: true,
            },
          ],
        },
      ],
    },
  ],
  delivery_zones: [
    {
      zone_id: 'zone_jardins',
      name: 'Jardins',
      distance_km: 1.2,
      fee_cents: 500,
    },
    {
      zone_id: 'zone_consolacao',
      name: 'Consolação',
      distance_km: 2.8,
      fee_cents: 800,
    },
    {
      zone_id: 'zone_pinheiros',
      name: 'Pinheiros',
      distance_km: 4.9,
      fee_cents: 900,
    },
  ],
};

const mockCreatedOrderResponse: OrderResponse = {
  order_id: 'ord_e24dd227043c47b3',
  display_id: '4821',
  status: 'PENDING',
  created_at_iso: '2026-11-21T15:10:00+00:00',
  subtotal_cents: 6890,
  delivery_fee_cents: 800,
  discount_cents: 0,
  total_cents: 7690,
  payment_link_id: 'pl_pagarme_99',
  checkout_url: 'https://payment-link.pagar.me/pl_pagarme_99',
  payment_method: '',
  items: [],
  notes: 'Interfone 42',
};

describe('high_gear: Epic E3 Neighborhood Delivery Fee Selector & Pagar.me Hosted Checkout Flow', () => {
  let capturedOrderPayload: CreateOrderRequest | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('seumignon:welcome-seen:welcome-v1-3-sides', 'true');
    capturedOrderPayload = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), {
          status: 200,
        });
      }
      if (url.endsWith('/menu')) {
        return new Response(JSON.stringify(checkoutMenuResponse), {
          status: 200,
        });
      }
      if (url.endsWith('/orders') && init?.method === 'POST') {
        capturedOrderPayload = JSON.parse(String(init.body)) as CreateOrderRequest;
        return new Response(JSON.stringify(mockCreatedOrderResponse), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'NotFound', detail: 'Not found' }), {
        status: 404,
      });
    });
  });

  it('filters neighborhood delivery zones accent-insensitively, updates integer-centavos delivery fee & total live, submits POST /orders, persists order in localStorage, and hands off to Pagar.me checkout_url', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
    });

    // 1. Add Parmegiana de Mignon (R$ 68,90) with 3x Arroz Branco
    await user.click(screen.getByText('Parmegiana de Mignon'));
    const dishDialog = screen.getByRole('dialog');
    const arrozCard = within(dishDialog).getByRole('button', { name: /Adicionar Arroz Branco/i });
    await user.click(arrozCard);
    await user.click(arrozCard);
    await user.click(arrozCard);
    await user.click(within(dishDialog).getByRole('button', { name: /Adicionar à sacola/i }));

    // 2. Verify Cart Subtotal is R$ 68,90 and select neighborhood "Consolação" (R$ 8,00 tier) via accent-insensitive search "consolacao"
    const cartAside = screen.getByRole('complementary', { name: /Sua Sacola/i });
    expect(within(cartAside).getByTestId('cart-subtotal')).toHaveTextContent('R$ 68,90');

    const zoneSearchInput = within(cartAside).getByLabelText(/Buscar bairro de entrega/i);
    await user.type(zoneSearchInput, 'consolacao');

    const consolacaoOption = within(cartAside).getByRole('option', { name: /Consolação/i });
    await user.click(consolacaoOption);

    // 3. Verify Delivery Fee (R$ 8,00) + Subtotal (R$ 68,90) = Total (R$ 76,90) in integer centavos
    expect(within(cartAside).getByTestId('cart-delivery-fee')).toHaveTextContent('R$ 8,00');
    expect(within(cartAside).getByTestId('cart-total')).toHaveTextContent('R$ 76,90');

    // 4. Open Checkout Modal
    await user.click(within(cartAside).getByRole('button', { name: /Finalizar pedido/i }));
    const checkoutDialog = screen.getByRole('dialog');
    expect(
      within(checkoutDialog).getByRole('heading', { name: /Finalizar Pedido/i }),
    ).toBeInTheDocument();

    // 5. Fill customer and address fields
    await user.type(within(checkoutDialog).getByLabelText(/Nome completo/i), 'Maria Silva');
    await user.type(
      within(checkoutDialog).getByLabelText(/WhatsApp \/ Telefone com DDD/i),
      '(11) 99999-8888',
    );
    await user.type(within(checkoutDialog).getByLabelText(/E-mail/i), 'maria@example.com');
    await user.type(within(checkoutDialog).getByLabelText(/CPF/i), '123.456.789-09');
    await user.type(within(checkoutDialog).getByLabelText(/CEP/i), '01304-001');
    await user.type(within(checkoutDialog).getByLabelText(/Rua \/ Avenida/i), 'Rua Augusta');
    await user.type(within(checkoutDialog).getByLabelText(/^Número \*/i), '1500');
    await user.type(within(checkoutDialog).getByLabelText(/Complemento/i), 'Apto 42');
    await user.type(
      within(checkoutDialog).getByLabelText(/Ponto de referência/i),
      'Próximo ao metrô',
    );
    await user.type(
      within(checkoutDialog).getByLabelText(/Observações para a entrega/i),
      'Interfone 42',
    );

    // 6. Submit order to POST /orders
    const submitOrderBtn = within(checkoutDialog).getByRole('button', {
      name: /Ir para pagamento Pagar\.me/i,
    });
    await user.click(submitOrderBtn);

    // 7. Assert exact POST /orders payload sent to seumignon-backend
    await waitFor(() => {
      expect(capturedOrderPayload).not.toBeNull();
    });
    expect(capturedOrderPayload?.delivery_address.zone_id).toBe('zone_consolacao');
    expect(capturedOrderPayload?.customer.document_number).toBe('12345678909');
    expect(capturedOrderPayload?.customer.phone).toBe('11999998888');
    expect(capturedOrderPayload?.items[0].choices).toEqual([
      {
        group_id: 'included_sides',
        choice_item_id: 'side_arroz',
        quantity: 3,
        notes: '',
      },
    ]);

    // 8. Assert Pagar.me Hosted Checkout handoff view and localStorage persistence
    const pagarmeLink = await within(checkoutDialog).findByTestId('pagarme-checkout-link');
    expect(pagarmeLink).toHaveAttribute('href', 'https://payment-link.pagar.me/pl_pagarme_99');
    expect(within(checkoutDialog).getByTestId('created-order-total')).toHaveTextContent('R$ 76,90');

    const storedRecentRaw = window.localStorage.getItem(RECENT_ORDERS_STORAGE_KEY);
    expect(storedRecentRaw).not.toBeNull();
    const storedRecent = JSON.parse(String(storedRecentRaw)) as Array<{
      order_id: string;
      checkout_url: string;
    }>;
    expect(storedRecent[0].order_id).toBe('ord_e24dd227043c47b3');
    expect(storedRecent[0].checkout_url).toBe('https://payment-link.pagar.me/pl_pagarme_99');
  });
});
