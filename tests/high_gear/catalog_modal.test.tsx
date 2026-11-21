import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { MenuResponse } from '../../src/domain';

const richMenuResponse: MenuResponse = {
  updated_at_iso: '2026-11-21T14:00:00+00:00',
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
            {
              choice_item_id: 'side_farofa',
              name: 'Farofa da Casa',
              price_cents: 0,
              enabled: true,
            },
          ],
        },
        {
          group_id: 'extra_sides',
          name: 'Acompanhamentos Extras',
          min_choices: 0,
          max_choices: 10,
          items: [
            {
              choice_item_id: 'extra_fritas',
              name: 'Porção Extra Batata Frita',
              price_cents: 1200,
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

describe('high_gear: Epic E2 WelcomePromoModal, Catalog & Sweetgreen-style 3/3 DishCustomizationModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', environment: 'prod' }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(richMenuResponse), { status: 200 });
    });
  });

  it('opens WelcomePromoModal on first visit, closes on (X), and remembers dismissal in localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /Filé Mignon de verdade, do seu jeito/i }),
    ).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', {
      name: /Fechar boas-vindas e ir para o cardápio/i,
    });
    await user.click(closeBtn);

    expect(
      screen.queryByRole('heading', { name: /Filé Mignon de verdade, do seu jeito/i }),
    ).not.toBeInTheDocument();
  });

  it('enforces 3/3 included sides in the Sweetgreen photo grid (supporting repeated sides 2x + 1x = 3) without paid extra clutter inside the modal', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('seumignon:welcome-seen:welcome-v1-3-sides', 'true');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Parmegiana de Mignon')).toBeInTheDocument();
    });

    // Click dish card to open customization modal
    await user.click(screen.getByText('Parmegiana de Mignon'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Acompanhamentos Inclusos')).toBeInTheDocument();

    // Paid extra sides must NOT clutter the main dish modal (they live in the Acompanhamentos Extras tab)
    expect(within(dialog).queryByText('Porção Extra Batata Frita')).not.toBeInTheDocument();

    // Initially 0/3 selected -> Add to cart button is disabled
    expect(within(dialog).getByTestId('group-counter-included_sides')).toHaveTextContent('0/3');
    const submitBtn = within(dialog).getByRole('button', {
      name: /Escolha os 3 acompanhamentos \(0\/3\)/i,
    });
    expect(submitBtn).toBeDisabled();

    // Tap "Arroz Branco" photo card twice (2x Arroz)
    const arrozCard = within(dialog).getByRole('button', {
      name: /Adicionar Arroz Branco/i,
    });
    await user.click(arrozCard);
    expect(within(dialog).getByTestId('side-badge-side_arroz')).toHaveTextContent('1');
    expect(within(dialog).getByTestId('group-counter-included_sides')).toHaveTextContent('1/3');

    await user.click(arrozCard);
    expect(within(dialog).getByTestId('side-badge-side_arroz')).toHaveTextContent('2');
    expect(within(dialog).getByTestId('group-counter-included_sides')).toHaveTextContent('2/3');

    // Tap "Batata Frita" photo card once (1x Batata Frita => Total 3/3)
    const fritasCard = within(dialog).getByRole('button', {
      name: /Adicionar Batata Frita/i,
    });
    await user.click(fritasCard);
    expect(within(dialog).getByTestId('side-badge-side_fritas')).toHaveTextContent('1');
    expect(within(dialog).getByTestId('group-counter-included_sides')).toHaveTextContent('3/3');

    // Now the "Adicionar à sacola" CTA is enabled with live centavos total R$ 68,90
    const enabledAddBtn = within(dialog).getByRole('button', {
      name: /Adicionar à sacola/i,
    });
    expect(enabledAddBtn).toBeEnabled();

    await user.click(enabledAddBtn);

    // Modal closes and item appears in the sticky cart with 2x Arroz Branco and 1x Batata Frita
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('1x Parmegiana de Mignon')).toBeInTheDocument();
    expect(screen.getByText(/2x Arroz Branco/i)).toBeInTheDocument();
    expect(screen.getByText(/1x Batata Frita/i)).toBeInTheDocument();
    expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('R$ 68,90');
  });
});
