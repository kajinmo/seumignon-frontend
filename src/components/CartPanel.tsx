/**
 * Cart Summary Panel & Mobile Slide-Over Drawer (`CartPanel.tsx`).
 * Displays configured cart line items with quantity steppers (`+`/`-`),
 * authoritative CEP-based delivery fee quote (`GET /delivery-fee?cep=...`),
 * integer-centavos Subtotal / Delivery Fee / Total breakdown, and Checkout CTA.
 */

import { ArrowRight, ExternalLink, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import {
  calculateLineItemTotalCents,
  formatCentsToBRL,
  type HealthResponse,
  type ThemeId,
} from '../domain';
import { useCart } from '../contexts/CartContext';
import { BoizinhoMascot } from './BoizinhoMascot';
import { CepDeliverySelector } from './CepDeliverySelector';

interface CartPanelProps {
  theme: ThemeId;
  health: HealthResponse | null;
  onProceedToCheckout: () => void;
  onTrackOrder?: (orderId: string) => void;
  onCloseDrawer?: () => void;
  idPrefix?: string;
}

export function CartPanel({
  theme,
  health,
  onProceedToCheckout,
  onTrackOrder,
  onCloseDrawer,
  idPrefix = 'desktop-cart',
}: CartPanelProps) {
  const {
    cartItems,
    totalCartUnits,
    deliveryQuote,
    isQuotingCep,
    cepQuoteError,
    subtotalCents,
    deliveryFeeCents,
    totalCents,
    checkoutDraft,
    recentOrders,
    updateLineQuantity,
    removeLine,
    quoteDeliveryByCep,
    updateCheckoutDraft,
    clearPersonalData,
  } = useCart();

  const hasLocalPersonalData =
    Boolean(checkoutDraft.name || checkoutDraft.postalCode || checkoutDraft.email) ||
    recentOrders.length > 0;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-brand-primary" />
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-ink-primary">
            Sua Sacola
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {totalCartUnits > 0 && (
            <span className="rounded-full bg-brand-primary px-2.5 py-0.5 text-xs font-bold text-white">
              {totalCartUnits} {totalCartUnits === 1 ? 'item' : 'itens'}
            </span>
          )}
          {onCloseDrawer && (
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label="Fechar sacola"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-subtle text-ink-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {cartItems.length === 0 ? (
        /* Touchpoint #3: Empty Bag State featuring the Angry/Impatient Cheeky Bull Mascot */
        <div className="flex flex-col items-center py-6 text-center">
          <BoizinhoMascot theme={theme} variant="angry-empty-bag" className="h-40 w-40" />
          <p className="mt-3 font-display text-base font-bold uppercase text-ink-primary">
            Essa sacola tá muito leve...
          </p>
          <p className="mt-1 max-w-xs text-xs text-ink-secondary">
            Escolha seu corte de filé mignon ao lado e selecione seus 3 acompanhamentos inclusos!
          </p>

          {/* If the customer has a recent order in localStorage, show quick payment/status link */}
          {recentOrders.length > 0 && (
            <div className="mt-5 w-full rounded-xl border border-brand-primary/30 bg-subtle/70 p-3 text-left">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-brand-primary">
                Último pedido registrado (#{recentOrders[0].display_id})
              </span>
              <div className="mt-1 flex items-center justify-between text-xs text-ink-primary">
                <span>Total: {formatCentsToBRL(recentOrders[0].total_cents)}</span>
                <a
                  href={recentOrders[0].checkout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-brand-primary underline"
                >
                  <span>Abrir link Pagar.me</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {onTrackOrder && (
                <button
                  type="button"
                  onClick={() => onTrackOrder(recentOrders[0].order_id)}
                  className="mt-2 w-full rounded-lg bg-brand-primary px-3 py-1.5 text-center text-xs font-bold text-white transition hover:bg-brand-hover"
                >
                  Acompanhar status do pedido #{recentOrders[0].display_id}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Line Items List */}
          <ul className="divide-y divide-border">
            {cartItems.map((line) => {
              const lineTotal = calculateLineItemTotalCents(
                line.unit_price_cents,
                line.choices,
                line.quantity,
              );

              return (
                <li key={line.cart_line_id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="text-sm font-bold text-ink-primary">
                        {line.quantity}x {line.name}
                      </span>
                      {line.size && (
                        <span className="ml-1.5 text-[11px] text-ink-secondary">({line.size})</span>
                      )}
                      {line.choices.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-ink-secondary">
                          {line.choices.map((c) => (
                            <li key={c.choice_item_id}>
                              &bull; {c.quantity}x {c.name}
                            </li>
                          ))}
                        </ul>
                      )}
                      {line.notes && (
                        <p className="mt-1 text-[11px] italic text-ink-secondary">
                          Obs.: {line.notes}
                        </p>
                      )}

                      {/* Quantity Stepper (- / +) */}
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-subtle px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => updateLineQuantity(line.cart_line_id, -1)}
                          aria-label={`Diminuir quantidade de ${line.name}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-ink-primary hover:bg-surface"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold text-ink-primary">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateLineQuantity(line.cart_line_id, 1)}
                          aria-label={`Aumentar quantidade de ${line.name}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-ink-primary hover:bg-surface"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-brand-primary">
                        {formatCentsToBRL(lineTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(line.cart_line_id)}
                        aria-label={`Remover ${line.name} da sacola`}
                        className="text-ink-secondary hover:text-status-error"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Authoritative CEP Delivery Fee Selector */}
          <CepDeliverySelector
            postalCode={checkoutDraft.postalCode}
            deliveryQuote={deliveryQuote}
            isQuoting={isQuotingCep}
            quoteError={cepQuoteError}
            onPostalCodeChange={(postalCode) => updateCheckoutDraft({ postalCode })}
            onQuoteCep={quoteDeliveryByCep}
            idPrefix={idPrefix}
          />

          {/* Integer-Centavos Monetary Breakdown */}
          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink-secondary">Subtotal</span>
              <span data-testid="cart-subtotal" className="font-bold text-ink-primary">
                {formatCentsToBRL(subtotalCents)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium text-ink-secondary">
                Taxa de entrega {deliveryQuote?.district ? `(${deliveryQuote.district})` : ''}
              </span>
              <span data-testid="cart-delivery-fee" className="font-bold text-ink-primary">
                {deliveryQuote ? formatCentsToBRL(deliveryFeeCents) : 'Informe seu CEP'}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2 text-base">
              <span className="font-display font-bold uppercase text-ink-primary">Total</span>
              <span data-testid="cart-total" className="text-lg font-bold text-brand-primary">
                {formatCentsToBRL(totalCents)}
              </span>
            </div>
          </div>

          {/* Primary Checkout CTA */}
          <button
            type="button"
            onClick={onProceedToCheckout}
            className="flex w-full items-center justify-between rounded-xl bg-brand-primary px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-hover"
          >
            <span>Finalizar pedido</span>
            <span className="inline-flex items-center gap-1.5">
              <span>{formatCentsToBRL(totalCents)}</span>
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}

      {/* Subtle API Connection & Privacy Footer */}
      {(health || hasLocalPersonalData) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-ink-secondary">
          {health && (
            <span>Cozinha online ({health.environment}) &bull; Entrega própria até 5,5 km</span>
          )}
          {hasLocalPersonalData && (
            <button
              type="button"
              onClick={clearPersonalData}
              className="font-semibold text-ink-secondary underline hover:text-status-error"
            >
              Limpar meus dados
            </button>
          )}
        </div>
      )}
    </div>
  );
}
