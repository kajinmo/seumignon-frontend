import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { ApiClientError, SeuMignonApiClient } from '../../src/services/api';
import type { CreateOrderRequest, MenuResponse, OrderResponse } from '../../src/domain';

const mockMenuResponse: MenuResponse = {
  updated_at_iso: '2026-11-21T12:00:00+00:00',
  items: [
    {
      item_id: 'item_mignon_1',
      name: 'Parmegiana de Mignon',
      category: 'Pratos com Mignon',
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
  ],
};

describe('high_gear: SeuMignonApiClient HTTP contracts & Dual-Theme A/B App shell', () => {
  it('calls GET /health and GET /menu with normalized baseUrl and parses contracts', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/menu')) {
        return new Response(JSON.stringify(mockMenuResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'NotFound', detail: 'Not found' }), {
        status: 404,
      });
    });

    const client = new SeuMignonApiClient({
      baseUrl: 'https://p9joemg5dj.execute-api.us-east-1.amazonaws.com/',
      fetchImpl: fetchMock,
    });

    expect(client.getBaseUrl()).toBe('https://p9joemg5dj.execute-api.us-east-1.amazonaws.com');

    const health = await client.getHealth();
    expect(health).toEqual({ status: 'ok', environment: 'prod' });

    const menu = await client.getMenu();
    expect(menu.items[0].price_cents).toBe(6890);
    expect(menu.delivery_zones[0].fee_cents).toBe(500);
  });

  it('submits POST /orders and normalizes backend { error, detail } envelopes into ApiClientError', async () => {
    const mockOrderResponse: OrderResponse = {
      order_id: 'ord_e24dd227043c47b3',
      display_id: '4821',
      status: 'PENDING',
      created_at_iso: '2026-11-21T12:05:00+00:00',
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

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockOrderResponse), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'ChoiceValidationError',
            detail:
              "Group 'Acompanhamentos Inclusos' for 'Parmegiana de Mignon' requires between 3 and 3 selections, got 2.",
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const client = new SeuMignonApiClient({
      baseUrl: 'http://localhost:8000',
      fetchImpl: fetchMock,
    });

    const samplePayload: CreateOrderRequest = {
      customer: {
        name: 'Maria Silva',
        phone: '11999998888',
        email: 'maria@example.com',
        document_number: '12345678909',
      },
      delivery_address: {
        zone_id: 'zone_jardins',
        street_name: 'Rua Augusta',
        street_number: '1500',
        city: 'São Paulo',
        state: 'SP',
        postal_code: '01304001',
      },
      items: [
        {
          item_id: 'item_mignon_1',
          quantity: 1,
          choices: [
            {
              group_id: 'included_sides',
              choice_item_id: 'side_arroz',
              quantity: 3,
            },
          ],
        },
      ],
    };

    const created = await client.createOrder(samplePayload);
    expect(created.order_id).toBe('ord_e24dd227043c47b3');
    expect(created.checkout_url).toBe('https://payment-link.pagar.me/pl_123');

    await expect(client.createOrder(samplePayload)).rejects.toEqual(
      expect.objectContaining<Partial<ApiClientError>>({
        name: 'ApiClientError',
        status: 422,
        errorCode: 'ChoiceValidationError',
      }),
    );
  });

  it('renders App shell and switches live between Theme A (Azul #10388B) and Theme B (Vermelho #CB2031)', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(mockMenuResponse), { status: 200 });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('blue-bistro');

    const redThemeBtn = screen.getByRole('button', { name: /Proposta 2: Vermelho/i });
    await user.click(redThemeBtn);

    expect(document.documentElement.getAttribute('data-theme')).toBe('red-kraft');
    expect(screen.getByText('R$ 68,90')).toBeInTheDocument();
  });
});
