import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { ApiClientError, SeuMignonApiClient } from '../../src/services/api';
import type {
  CreateOrderRequest,
  CustomerProfileResponse,
  DeliveryFeeQuoteResponse,
  MenuResponse,
  OrderResponse,
} from '../../src/domain';

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
  it('calls GET /health, GET /menu, and GET /delivery-fee with normalized baseUrl and handles 422 CEP errors', async () => {
    const sampleQuote: DeliveryFeeQuoteResponse = {
      cep: '03195000',
      distance_km: 0.0,
      fee_cents: 500,
      district: 'Alto da Mooca',
      source: 'local_index',
    };

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
      if (url.includes('/delivery-fee?cep=03195-000')) {
        return new Response(JSON.stringify(sampleQuote), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/delivery-fee?cep=09999-000')) {
        return new Response(
          JSON.stringify({
            error: 'DeliveryOutOfRangeError',
            detail: 'CEP outside 5.5 km cutoff.',
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          },
        );
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

    const quote = await client.getDeliveryFee('03195000');
    expect(quote).toEqual(sampleQuote);

    await expect(client.getDeliveryFee('09999-000')).rejects.toEqual(
      expect.objectContaining<Partial<ApiClientError>>({
        name: 'ApiClientError',
        status: 422,
        errorCode: 'DeliveryOutOfRangeError',
      }),
    );
  });

  it('submits POST /orders (guest and authenticated Bearer access_token) and normalizes errors into ApiClientError', async () => {
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
      user_id: '',
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
        new Response(JSON.stringify({ ...mockOrderResponse, user_id: 'cognito-sub-1' }), {
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
        postal_code: '03195-000',
        street_name: 'Rua Exemplo',
        street_number: '123',
        district: 'Alto da Mooca',
        city: 'São Paulo',
        state: 'SP',
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

    // Guest checkout (no Authorization header)
    const guestOrder = await client.createOrder(samplePayload);
    expect(guestOrder.order_id).toBe('ord_e24dd227043c47b3');
    const firstCallHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(firstCallHeaders.has('Authorization')).toBe(false);

    // Authenticated checkout (Authorization: Bearer <access_token>)
    const authOrder = await client.createOrder(samplePayload, { accessToken: 'acc_token_xyz' });
    expect(authOrder.user_id).toBe('cognito-sub-1');
    const secondCallHeaders = fetchMock.mock.calls[1][1]?.headers as Headers;
    expect(secondCallHeaders.get('Authorization')).toBe('Bearer acc_token_xyz');

    await expect(client.createOrder(samplePayload)).rejects.toEqual(
      expect.objectContaining<Partial<ApiClientError>>({
        name: 'ApiClientError',
        status: 422,
        errorCode: 'ChoiceValidationError',
      }),
    );
  });

  it('calls passwordless Email OTP and /me/* endpoints with Authorization Bearer access_token', async () => {
    const sampleProfile: CustomerProfileResponse = {
      user_id: 'sub_123',
      email: 'cliente@exemplo.com',
      name: 'Maria Silva',
      phone: '11999998888',
      document_number: '12345678909',
      default_address: {
        street_name: 'Rua Exemplo',
        street_number: '123',
        district: 'Alto da Mooca',
        city: 'São Paulo',
        state: 'SP',
        postal_code: '03195-000',
        complement: '',
        reference: '',
        country: 'BR',
      },
    };

    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const authHeader = new Headers(init?.headers).get('Authorization');

      if (url.endsWith('/auth/request-code') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          email: string;
          create_if_missing?: boolean;
        };
        if (body.email === 'naoexiste@exemplo.com' && body.create_if_missing === false) {
          return new Response(
            JSON.stringify({
              error: 'UserNotFoundError',
              detail: 'Customer email is not registered yet.',
            }),
            { status: 404 },
          );
        }
        return new Response(
          JSON.stringify({
            email: body.email,
            challenge_name: 'EMAIL_OTP',
            session: body.create_if_missing ? 'sess_signup' : 'sess_abc',
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/auth/verify-code') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            user_id: 'sub_123',
            email: 'cliente@exemplo.com',
            access_token: 'acc_123',
            id_token: 'id_123',
            refresh_token: 'ref_123',
            expires_in_seconds: 3600,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/me/profile') && init?.method === 'GET') {
        expect(authHeader).toBe('Bearer acc_123');
        return new Response(JSON.stringify(sampleProfile), { status: 200 });
      }
      if (url.endsWith('/me/profile') && init?.method === 'PUT') {
        expect(authHeader).toBe('Bearer acc_123');
        return new Response(JSON.stringify(sampleProfile), { status: 200 });
      }
      if (url.endsWith('/me/orders') && init?.method === 'GET') {
        expect(authHeader).toBe('Bearer acc_123');
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'NotFound', detail: 'Not found' }), {
        status: 404,
      });
    });

    const client = new SeuMignonApiClient({
      baseUrl: 'https://p9joemg5dj.execute-api.us-east-1.amazonaws.com',
      fetchImpl: fetchMock,
    });

    const challenge = await client.requestAuthCode('cliente@exemplo.com');
    expect(challenge.session).toBe('sess_abc');

    await expect(
      client.requestAuthCode('naoexiste@exemplo.com', { createIfMissing: false }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiClientError>>({
        name: 'ApiClientError',
        status: 404,
        errorCode: 'UserNotFoundError',
      }),
    );

    const signupChallenge = await client.requestAuthCode('naoexiste@exemplo.com', {
      createIfMissing: true,
    });
    expect(signupChallenge.session).toBe('sess_signup');

    const tokens = await client.verifyAuthCode({
      email: 'cliente@exemplo.com',
      code: '12345678',
      session: challenge.session,
    });
    expect(tokens.access_token).toBe('acc_123');

    const profile = await client.getMyProfile(tokens.access_token);
    expect(profile.default_address?.district).toBe('Alto da Mooca');

    const saved = await client.updateMyProfile(tokens.access_token, {
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      document_number: profile.document_number,
      default_address: profile.default_address!,
    });
    expect(saved.user_id).toBe('sub_123');

    const myOrders = await client.getMyOrders(tokens.access_token);
    expect(myOrders).toEqual([]);
  });

  it('renders App shell locked to Red Kraft theme without header theme switcher and displays curated category shortcuts', async () => {
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

    expect(document.documentElement.getAttribute('data-theme')).toBe('red-kraft');
    expect(
      screen.queryByRole('group', { name: /Seletor de Tema Visual/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('R$ 68,90')).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /Categorias do Cardápio/i });
    expect(nav).toHaveTextContent('Os mais pedidos');
    expect(nav).toHaveTextContent('Grelhados');
    expect(nav).toHaveTextContent('Clássicos da Cozinha');
    expect(nav).toHaveTextContent('Acompanhamentos');
    expect(nav).toHaveTextContent('Sobremesa');
    expect(nav).toHaveTextContent('Bebidas');

    await user.click(screen.getByRole('button', { name: /Sobremesa/i }));
    expect(screen.getByText(/Ainda não há itens cadastrados em Sobremesa/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ver cardápio completo/i }));
    expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
  });
});
