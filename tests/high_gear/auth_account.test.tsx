import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { AUTH_SESSION_STORAGE_KEY } from '../../src/contexts/AuthContext';
import type {
  CustomerProfileResponse,
  DeliveryFeeQuoteResponse,
  MenuResponse,
  OrderResponse,
} from '../../src/domain';

const sampleMenu: MenuResponse = {
  updated_at_iso: '2026-11-24T12:00:00+00:00',
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
  delivery_zones: [],
};

const sampleProfile: CustomerProfileResponse = {
  user_id: 'cognito-sub-uuid',
  email: 'cliente@exemplo.com',
  name: 'Carlos Mignon',
  phone: '11988887777',
  document_number: '12345678909',
  default_address: {
    street_name: 'Rua dos Trilhos',
    street_number: '450',
    district: 'Alto da Mooca',
    city: 'São Paulo',
    state: 'SP',
    postal_code: '03195-000',
    complement: 'Casa 2',
    reference: 'Perto da praça',
    country: 'BR',
  },
};

const sampleQuote: DeliveryFeeQuoteResponse = {
  cep: '03195000',
  distance_km: 0.4,
  fee_cents: 500,
  district: 'Alto da Mooca',
  source: 'local_index',
};

const sampleCloudOrders: OrderResponse[] = [
  {
    order_id: 'ord_cloud_1',
    display_id: '4821',
    status: 'PAID',
    created_at_iso: '2026-11-24T12:05:00+00:00',
    subtotal_cents: 6890,
    delivery_fee_cents: 500,
    discount_cents: 0,
    total_cents: 7390,
    payment_link_id: 'pl_1',
    checkout_url: 'https://payment-link.pagar.me/pl_1',
    payment_method: 'pix',
    items: [
      {
        item_id: 'item_mignon_1',
        name: 'Parmegiana de Mignon',
        size: 'Individual',
        unit_price_cents: 6890,
        quantity: 1,
        line_total_cents: 6890,
        choices: [],
        notes: '',
      },
    ],
    notes: '',
    user_id: 'cognito-sub-uuid',
  },
];

describe('high_gear: Epic E6 Optional Email OTP Login, Profile Autofill, Cloud Orders & 401 Fallback', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('seumignon:welcome-seen:welcome-v1-3-sides', 'true');
  });

  it('completes 2-step Email OTP login with access_token, loads /me/profile + /me/orders, autofills checkout, and allows saving /me/profile', async () => {
    const user = userEvent.setup();
    let capturedProfilePutBody: Record<string, unknown> | null = null;
    let capturedOrderAuthHeader: string | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const authHeader = new Headers(init?.headers).get('Authorization');

      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), { status: 200 });
      }
      if (url.endsWith('/menu')) {
        return new Response(JSON.stringify(sampleMenu), { status: 200 });
      }
      if (url.endsWith('/auth/request-code')) {
        return new Response(
          JSON.stringify({
            email: 'cliente@exemplo.com',
            challenge_name: 'EMAIL_OTP',
            session: 'otp_session_xyz',
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/auth/verify-code')) {
        return new Response(
          JSON.stringify({
            user_id: 'cognito-sub-uuid',
            email: 'cliente@exemplo.com',
            access_token: 'access_tok_valid',
            id_token: 'id_tok_must_not_be_sent',
            refresh_token: 'refresh_tok_1',
            expires_in_seconds: 3600,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/me/profile') && init?.method === 'GET') {
        expect(authHeader).toBe('Bearer access_tok_valid');
        return new Response(JSON.stringify(sampleProfile), { status: 200 });
      }
      if (url.endsWith('/me/profile') && init?.method === 'PUT') {
        expect(authHeader).toBe('Bearer access_tok_valid');
        capturedProfilePutBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify(sampleProfile), { status: 200 });
      }
      if (url.endsWith('/me/orders') && init?.method === 'GET') {
        expect(authHeader).toBe('Bearer access_tok_valid');
        return new Response(JSON.stringify(sampleCloudOrders), { status: 200 });
      }
      if (url.includes('/delivery-fee?cep=03195-000')) {
        return new Response(JSON.stringify(sampleQuote), { status: 200 });
      }
      if (url.endsWith('/orders') && init?.method === 'POST') {
        capturedOrderAuthHeader = authHeader;
        return new Response(JSON.stringify(sampleCloudOrders[0]), { status: 201 });
      }
      return new Response(JSON.stringify({ error: 'NotFound', detail: 'Not found' }), {
        status: 404,
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
    });

    // 1. Open Account Modal and complete Email OTP login
    await user.click(screen.getByTestId('account-modal-trigger'));
    const accountDialog = screen.getByRole('dialog');
    await user.type(within(accountDialog).getByLabelText(/Seu e-mail/i), 'cliente@exemplo.com');
    await user.click(
      within(accountDialog).getByRole('button', { name: /Receber código por e-mail/i }),
    );

    const otpInput = await within(accountDialog).findByLabelText(/Código recebido no e-mail/i);
    await user.type(otpInput, '12345678');
    await user.click(within(accountDialog).getByRole('button', { name: /Validar e entrar/i }));

    // 2. Authenticated state: cloud order history is displayed
    await waitFor(() => {
      expect(within(accountDialog).getByText('Pedido #4821')).toBeInTheDocument();
    });
    expect(within(accountDialog).getByText('Na Cozinha')).toBeInTheDocument();

    // 3. Switch to Profile tab, verify autofill, and save PUT /me/profile
    await user.click(within(accountDialog).getByRole('tab', { name: /Meu Perfil & Endereço/i }));
    expect(within(accountDialog).getByLabelText(/Nome completo/i)).toHaveValue('Carlos Mignon');
    await user.click(
      within(accountDialog).getByRole('button', { name: /Salvar perfil e endereço/i }),
    );

    await waitFor(() => {
      expect(capturedProfilePutBody).not.toBeNull();
    });

    // 4. Close Account Modal, add dish to bag, open Checkout -> verify autofilled profile & Bearer access_token on POST /orders
    await user.click(
      within(accountDialog).getByRole('button', { name: /Fechar janela da conta/i }),
    );
    await user.click(screen.getByText('Parmegiana de Mignon'));
    const dishDialog = screen.getByRole('dialog');
    await user.click(within(dishDialog).getByRole('button', { name: /Adicionar à sacola/i }));

    const cartAside = screen.getByRole('complementary', { name: /Sua Sacola/i });
    await waitFor(() => {
      expect(within(cartAside).getByTestId('cart-delivery-fee')).toHaveTextContent('R$ 5,00');
    });

    await user.click(within(cartAside).getByRole('button', { name: /Finalizar pedido/i }));
    const checkoutDialog = screen.getByRole('dialog');
    expect(within(checkoutDialog).getByLabelText(/Nome completo/i)).toHaveValue('Carlos Mignon');
    expect(within(checkoutDialog).getByLabelText(/Rua \/ Avenida/i)).toHaveValue('Rua dos Trilhos');

    await user.click(
      within(checkoutDialog).getByRole('button', { name: /Ir para pagamento Pagar\.me/i }),
    );
    await waitFor(() => {
      expect(capturedOrderAuthHeader).toBe('Bearer access_tok_valid');
    });
  }, 15_000);

  it('clears expired session on 401 Unauthorized and transparently falls back to Guest Checkout', async () => {
    const user = userEvent.setup();

    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: 'cognito-sub-uuid',
        email: 'cliente@exemplo.com',
        accessToken: 'expired_token',
        idToken: 'id_tok',
        refreshToken: 'ref_tok',
        expiresAtMs: Date.now() + 60_000,
      }),
    );

    let postOrderCalls = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const authHeader = new Headers(init?.headers).get('Authorization');

      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), { status: 200 });
      }
      if (url.endsWith('/menu')) {
        return new Response(JSON.stringify(sampleMenu), { status: 200 });
      }
      if (url.endsWith('/me/profile')) {
        // First startup check succeeds, or returns 401 when expired
        if (authHeader === 'Bearer expired_token') {
          return new Response(JSON.stringify(sampleProfile), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'Unauthorized', detail: 'Expired' }), {
          status: 401,
        });
      }
      if (url.includes('/delivery-fee?cep=03195-000')) {
        return new Response(JSON.stringify(sampleQuote), { status: 200 });
      }
      if (url.endsWith('/orders') && init?.method === 'POST') {
        postOrderCalls += 1;
        if (authHeader) {
          return new Response(JSON.stringify({ error: 'Unauthorized', detail: 'Token expired' }), {
            status: 401,
          });
        }
        return new Response(JSON.stringify({ ...sampleCloudOrders[0], user_id: '' }), {
          status: 201,
        });
      }
      return new Response(JSON.stringify({ error: 'NotFound', detail: 'Not found' }), {
        status: 404,
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Parmegiana de Mignon'));
    const dishDialog = screen.getByRole('dialog');
    await user.click(within(dishDialog).getByRole('button', { name: /Adicionar à sacola/i }));

    const cartAside = screen.getByRole('complementary', { name: /Sua Sacola/i });
    await waitFor(() => {
      expect(within(cartAside).getByTestId('cart-delivery-fee')).toHaveTextContent('R$ 5,00');
    });

    await user.click(within(cartAside).getByRole('button', { name: /Finalizar pedido/i }));
    const checkoutDialog = screen.getByRole('dialog');
    await user.click(
      within(checkoutDialog).getByRole('button', { name: /Ir para pagamento Pagar\.me/i }),
    );

    // First attempt got 401 with Bearer token -> cleared session & retried seamlessly as Guest!
    await waitFor(() => {
      expect(within(checkoutDialog).getByTestId('pagarme-checkout-link')).toBeInTheDocument();
    });
    expect(postOrderCalls).toBe(2);
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('supports upfront sign-up via "Criar minha conta", verifies OTP, immediately persists PUT /me/profile, and autofills checkout', async () => {
    const user = userEvent.setup();
    let capturedSignUpPutBody: Record<string, unknown> | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const authHeader = new Headers(init?.headers).get('Authorization');

      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), { status: 200 });
      }
      if (url.endsWith('/menu')) {
        return new Response(JSON.stringify(sampleMenu), { status: 200 });
      }
      if (url.endsWith('/auth/request-code')) {
        return new Response(
          JSON.stringify({
            email: 'novo@exemplo.com',
            challenge_name: 'EMAIL_OTP',
            session: 'otp_signup_session',
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/auth/verify-code')) {
        return new Response(
          JSON.stringify({
            user_id: 'cognito-new-user',
            email: 'novo@exemplo.com',
            access_token: 'acc_new_user',
            id_token: 'id_new_user',
            refresh_token: 'ref_new_user',
            expires_in_seconds: 3600,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/me/profile') && init?.method === 'PUT') {
        expect(authHeader).toBe('Bearer acc_new_user');
        capturedSignUpPutBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            user_id: 'cognito-new-user',
            ...capturedSignUpPutBody,
          }),
          { status: 200 },
        );
      }
      if (url.includes('/delivery-fee?cep=03195-000')) {
        return new Response(JSON.stringify(sampleQuote), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'NotFound', detail: 'Not found' }), {
        status: 404,
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
    });

    // 1. Open Account Modal and switch to "Criar minha conta"
    await user.click(screen.getByTestId('account-modal-trigger'));
    const accountDialog = screen.getByRole('dialog');
    await user.click(within(accountDialog).getByRole('tab', { name: /Criar minha conta/i }));

    // 2. Fill registration form upfront BEFORE OTP code
    await user.type(within(accountDialog).getByLabelText(/Nome completo/i), 'Ana Souza');
    await user.type(
      within(accountDialog).getByLabelText(/WhatsApp \/ Telefone/i),
      '(11) 97777-6666',
    );
    await user.type(within(accountDialog).getByLabelText(/E-mail/i), 'novo@exemplo.com');
    await user.type(within(accountDialog).getByLabelText(/CPF/i), '123.456.789-09');
    await user.type(within(accountDialog).getByLabelText(/^CEP \*/i), '03195000');
    await user.type(within(accountDialog).getByLabelText(/Bairro/i), 'Alto da Mooca');
    await user.type(within(accountDialog).getByLabelText(/Rua \/ Avenida/i), 'Rua da Mooca');
    await user.type(within(accountDialog).getByLabelText(/^Número \*/i), '900');

    // 3. Request OTP code -> enter code -> automatically creates profile via PUT /me/profile
    await user.click(
      within(accountDialog).getByRole('button', {
        name: /Continuar e validar e-mail com código/i,
      }),
    );

    const otpInput = await within(accountDialog).findByLabelText(/Código recebido no e-mail/i);
    await user.type(otpInput, '87654321');
    await user.click(
      within(accountDialog).getByRole('button', { name: /Confirmar código e concluir cadastro/i }),
    );

    await waitFor(() => {
      expect(capturedSignUpPutBody).not.toBeNull();
    });
    expect(capturedSignUpPutBody).toMatchObject({
      email: 'novo@exemplo.com',
      name: 'Ana Souza',
      phone: '11977776666',
      document_number: '12345678909',
      default_address: {
        postal_code: '03195-000',
        street_name: 'Rua da Mooca',
        street_number: '900',
        district: 'Alto da Mooca',
      },
    });
    expect(await within(accountDialog).findByText(/Cadastro concluído!/i)).toBeInTheDocument();
  }, 15_000);

  it('does NOT send OTP when "Já tenho conta" receives 404 UserNotFoundError and redirects to "Criar minha conta" with email pre-filled', async () => {
    const user = userEvent.setup();
    const requestCodeBodies: Array<{ email: string; create_if_missing?: boolean }> = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), { status: 200 });
      }
      if (url.endsWith('/menu')) {
        return new Response(JSON.stringify(sampleMenu), { status: 200 });
      }
      if (url.endsWith('/auth/request-code') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          email: string;
          create_if_missing?: boolean;
        };
        requestCodeBodies.push(body);
        if (!body.create_if_missing) {
          return new Response(
            JSON.stringify({
              error: 'UserNotFoundError',
              detail: 'E-mail não cadastrado.',
            }),
            { status: 404 },
          );
        }
        return new Response(
          JSON.stringify({
            email: body.email,
            challenge_name: 'EMAIL_OTP',
            session: 'otp_created_after_form',
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: 'NotFound', detail: 'Not found' }), {
        status: 404,
      });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('account-modal-trigger'));
    const accountDialog = screen.getByRole('dialog');
    await user.type(within(accountDialog).getByLabelText(/Seu e-mail/i), 'semcadastro@exemplo.com');
    await user.click(
      within(accountDialog).getByRole('button', { name: /Receber código por e-mail/i }),
    );

    const notice = await within(accountDialog).findByTestId('unregistered-email-notice');
    expect(notice).toHaveTextContent('semcadastro@exemplo.com');
    expect(
      within(accountDialog).queryByLabelText(/Código recebido no e-mail/i),
    ).not.toBeInTheDocument();
    expect(within(accountDialog).getByLabelText(/E-mail \*/i)).toHaveValue(
      'semcadastro@exemplo.com',
    );
    expect(requestCodeBodies[0]).toEqual({
      email: 'semcadastro@exemplo.com',
      create_if_missing: false,
    });
  });
});
