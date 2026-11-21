import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { MenuResponse, OrderResponse, OrderStatus } from '../../src/domain';

const sampleMenuResponse: MenuResponse = {
  updated_at_iso: '2026-11-21T15:30:00+00:00',
  items: [
    {
      item_id: 'item_mignon_1',
      name: 'Parmegiana de Mignon',
      category: 'Pratos Executivos',
      size: 'Individual',
      price_cents: 6890,
      description: 'Filé mignon empanado com molho artesanal e queijo gratinado.',
      image_url: 'https://example.com/parmegiana.jpg',
      choice_groups: [],
    },
  ],
  delivery_zones: [
    {
      zone_id: 'zone_jardins',
      name: 'Jardins',
      distance_km: 1.2,
      fee_cents: 500,
    },
  ],
};

function buildOrderSnapshot(status: OrderStatus): OrderResponse {
  return {
    order_id: 'ord_e24dd227043c47b3',
    display_id: '4821',
    status,
    created_at_iso: '2026-11-21T15:30:00+00:00',
    subtotal_cents: 6890,
    delivery_fee_cents: 800,
    discount_cents: 0,
    total_cents: 7690,
    payment_link_id: 'pl_pagarme_99',
    checkout_url: 'https://payment-link.pagar.me/pl_pagarme_99',
    payment_method: status === 'PENDING' ? '' : 'pix',
    items: [
      {
        item_id: 'item_mignon_1',
        name: 'Parmegiana de Mignon',
        size: 'Individual',
        unit_price_cents: 6890,
        quantity: 1,
        line_total_cents: 6890,
        choices: [
          {
            choice_item_id: 'side_arroz',
            group_id: 'included_sides',
            name: 'Arroz Branco',
            unit_price_cents: 0,
            quantity: 2,
            notes: '',
          },
          {
            choice_item_id: 'side_fritas',
            group_id: 'included_sides',
            name: 'Batata Frita',
            unit_price_cents: 0,
            quantity: 1,
            notes: '',
          },
        ],
        notes: 'Carne ao ponto',
      },
    ],
    notes: 'Interfone 42',
  };
}

describe('high_gear: Epic E4 OrderStatusPage (/orders/:orderId) live polling & status transitions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('seumignon:welcome-seen:welcome-v1-3-sides', 'true');
    window.history.pushState({}, '', '/orders/ord_e24dd227043c47b3');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('loads /orders/:orderId directly, shows Pagar.me payment recovery link on PENDING, and transitions live to PAID -> DISPATCHED via polling', async () => {
    const user = userEvent.setup();
    const statuses: OrderStatus[] = ['PENDING', 'PAID', 'DISPATCHED'];
    let orderCallCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), {
          status: 200,
        });
      }
      if (url.endsWith('/menu')) {
        return new Response(JSON.stringify(sampleMenuResponse), {
          status: 200,
        });
      }
      if (url.includes('/orders/ord_e24dd227043c47b3')) {
        const currentStatus = statuses[Math.min(orderCallCount, statuses.length - 1)];
        orderCallCount += 1;
        return new Response(JSON.stringify(buildOrderSnapshot(currentStatus)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'NotFound', detail: 'Not found' }), {
        status: 404,
      });
    });

    render(<App orderPollIntervalMs={80} />);

    // 1. Initial state: PENDING with Pagar.me recovery CTA visible
    await waitFor(() => {
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Aguardando Pagamento');
    });
    expect(screen.getByTestId('order-status-payment-link')).toHaveAttribute(
      'href',
      'https://payment-link.pagar.me/pl_pagarme_99',
    );
    expect(screen.getByTestId('order-status-total')).toHaveTextContent('R$ 76,90');
    expect(screen.getByText(/2x Arroz Branco/i)).toBeInTheDocument();

    // 2. Live polling transitions to PAID (kitchen preparation) and hides payment link CTA
    await waitFor(() => {
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Na Cozinha');
    });
    expect(screen.queryByTestId('order-status-payment-link')).not.toBeInTheDocument();

    // 3. Live polling transitions to terminal DISPATCHED state
    await waitFor(() => {
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Saiu para Entrega');
    });
    expect(
      screen.getByRole('heading', { name: /Seu Mignon saiu para entrega!/i }),
    ).toBeInTheDocument();

    // 4. Clicking "Voltar ao cardápio" returns cleanly to "/" catalog route
    await user.click(screen.getByRole('button', { name: /Voltar ao cardápio/i }));
    expect(window.location.pathname).toBe('/');
    await waitFor(() => {
      expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
    });
  });
});
