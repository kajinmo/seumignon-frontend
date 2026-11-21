/**
 * Epic E3 Checkout & Pagar.me Payment Link Handoff Modal (`CheckoutModal.tsx`).
 *
 * Guardrails:
 * 1. Zero credit card fields collected in the frontend.
 * 2. Validates customer details (`name`, `phone`, `email`, `document_number`) and delivery address
 *    with pre-calculated neighborhood `zone_id` (`delivery_zones`).
 * 3. Submits `POST /orders` to `seumignon-backend`, saves `order_id` & `checkout_url` in `localStorage`,
 *    and hands off the customer to Pagar.me Hosted Checkout (`checkout_url`) for Pix or Credit Card payment.
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  buildCreateOrderRequest,
  formatCentsToBRL,
  validateCheckoutForm,
  type CheckoutFieldErrors,
  type DeliveryZone,
  type OrderResponse,
} from '../domain';
import { useCart } from '../contexts/CartContext';
import { apiClient, ApiClientError } from '../services/api';
import { NeighborhoodSelector } from './NeighborhoodSelector';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryZones: ReadonlyArray<DeliveryZone>;
  onNavigateToOrderStatus?: (orderId: string) => void;
}

export function CheckoutModal({
  isOpen,
  onClose,
  deliveryZones,
  onNavigateToOrderStatus,
}: CheckoutModalProps) {
  const {
    cartItems,
    selectedZoneId,
    selectedZone,
    subtotalCents,
    deliveryFeeCents,
    totalCents,
    checkoutDraft,
    selectZone,
    updateCheckoutDraft,
    recordCreatedOrder,
  } = useCart();

  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdOrder, setCreatedOrder] = useState<OrderResponse | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFieldErrors({});
      setSubmitError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const effectiveDraft = {
      ...checkoutDraft,
      zoneId: selectedZoneId || checkoutDraft.zoneId,
    };

    const validation = validateCheckoutForm(effectiveDraft, deliveryZones);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = buildCreateOrderRequest({
        draft: effectiveDraft,
        cartItems,
      });
      const response = await apiClient.createOrder(payload);
      setCreatedOrder(response);
      recordCreatedOrder(response);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSubmitError(err.detail);
      } else {
        setSubmitError('Não foi possível registrar seu pedido agora. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCloseAndReset() {
    setCreatedOrder(null);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={() => {
        if (!isSubmitting) {
          handleCloseAndReset();
        }
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary">
              {createdOrder ? 'Pedido Registrado' : 'Entrega Própria & Pagamento Seguro'}
            </span>
            <h2
              id="checkout-modal-title"
              className="font-display text-2xl font-bold uppercase tracking-tight text-ink-primary"
            >
              {createdOrder
                ? `Pedido #${createdOrder.display_id} aguardando pagamento`
                : 'Finalizar Pedido'}
            </h2>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleCloseAndReset}
            aria-label="Fechar checkout"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-subtle text-ink-primary transition hover:bg-canvas"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success / Pagar.me Handoff View after POST /orders returns 201 Created */}
        {createdOrder ? (
          <div className="space-y-5 overflow-y-auto p-6">
            <div className="flex items-start gap-3.5 rounded-2xl border border-status-success/30 bg-status-success/10 p-4">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-status-success" />
              <div>
                <h3 className="text-base font-bold text-ink-primary">
                  Seu pedido #{createdOrder.display_id} foi reservado!
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                  Para a cozinha começar a preparar seu Mignon imediatamente, conclua o pagamento
                  via <strong>Pix</strong> ou <strong>Cartão de Crédito</strong> no ambiente seguro
                  do <strong>Pagar.me</strong>.
                </p>
              </div>
            </div>

            {/* Authoritative Backend Totals Breakdown */}
            <div className="rounded-2xl border border-border bg-subtle/50 p-4 text-sm">
              <div className="flex items-center justify-between text-xs text-ink-secondary">
                <span>Código do pedido</span>
                <span className="font-mono font-bold text-ink-primary">
                  {createdOrder.order_id}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-ink-secondary">Subtotal dos pratos</span>
                <span className="font-semibold text-ink-primary">
                  {formatCentsToBRL(createdOrder.subtotal_cents)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-ink-secondary">Taxa de entrega</span>
                <span className="font-semibold text-ink-primary">
                  {formatCentsToBRL(createdOrder.delivery_fee_cents)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base">
                <span className="font-display font-bold uppercase text-ink-primary">
                  Total a pagar
                </span>
                <span
                  data-testid="created-order-total"
                  className="text-lg font-bold text-brand-primary"
                >
                  {formatCentsToBRL(createdOrder.total_cents)}
                </span>
              </div>
            </div>

            {/* Direct CTA to Hosted Pagar.me Checkout URL */}
            <a
              href={createdOrder.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="pagarme-checkout-link"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-4 text-center text-sm font-bold text-white shadow-lg transition hover:bg-brand-hover"
            >
              <Lock className="h-4 w-4" />
              <span>Pagar agora no Pagar.me (Pix ou Cartão)</span>
              <ExternalLink className="h-4 w-4" />
            </a>

            {onNavigateToOrderStatus && (
              <button
                type="button"
                data-testid="track-created-order-btn"
                onClick={() => {
                  const targetId = createdOrder.order_id;
                  setCreatedOrder(null);
                  onClose();
                  onNavigateToOrderStatus(targetId);
                }}
                className="w-full rounded-xl border-2 border-brand-primary bg-surface py-3 text-xs font-bold text-brand-primary transition hover:bg-brand-primary/10"
              >
                Acompanhar status do pedido #{createdOrder.display_id} ao vivo
              </button>
            )}

            <button
              type="button"
              onClick={handleCloseAndReset}
              className="w-full rounded-xl border border-border bg-subtle py-2.5 text-xs font-bold text-ink-secondary transition hover:text-ink-primary"
            >
              Voltar ao cardápio
            </button>
          </div>
        ) : (
          /* Customer & Delivery Address Form */
          <form
            onSubmit={(e) => void handleSubmitOrder(e)}
            noValidate
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {submitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-status-error/40 bg-status-error/10 p-3.5 text-xs font-semibold text-status-error"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Section 1: Pre-Calculated Neighborhood Delivery Zone */}
              <section aria-label="Bairro de entrega">
                <NeighborhoodSelector
                  zones={deliveryZones}
                  selectedZoneId={selectedZoneId}
                  onSelectZone={selectZone}
                  idPrefix="checkout"
                  errorMessage={fieldErrors.zoneId}
                />
              </section>

              {/* Section 2: Customer Identification */}
              <section aria-label="Seus dados" className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-border pb-1.5">
                  <User className="h-4 w-4 text-brand-primary" />
                  <h3 className="font-display text-base font-bold uppercase tracking-tight text-ink-primary">
                    1. Seus Dados (Para Nota e Contato do Entregador)
                  </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="checkout-name"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      Nome completo *
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      value={checkoutDraft.name}
                      onChange={(e) => updateCheckoutDraft({ name: e.target.value })}
                      placeholder="Ex.: Maria Silva"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                    {fieldErrors.name && (
                      <p className="mt-1 text-xs font-semibold text-status-error">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-phone"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      WhatsApp / Telefone com DDD *
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      value={checkoutDraft.phone}
                      onChange={(e) => updateCheckoutDraft({ phone: e.target.value })}
                      placeholder="Ex.: (11) 99999-8888"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                    {fieldErrors.phone && (
                      <p className="mt-1 text-xs font-semibold text-status-error">
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-email"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      E-mail *
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      value={checkoutDraft.email}
                      onChange={(e) => updateCheckoutDraft({ email: e.target.value })}
                      placeholder="Ex.: maria@email.com"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-xs font-semibold text-status-error">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-document"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      CPF (apenas números) *
                    </label>
                    <input
                      id="checkout-document"
                      type="text"
                      inputMode="numeric"
                      value={checkoutDraft.documentNumber}
                      onChange={(e) => updateCheckoutDraft({ documentNumber: e.target.value })}
                      placeholder="Ex.: 123.456.789-09"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                    {fieldErrors.documentNumber && (
                      <p className="mt-1 text-xs font-semibold text-status-error">
                        {fieldErrors.documentNumber}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Section 3: Delivery Address */}
              <section aria-label="Endereço de entrega" className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-border pb-1.5">
                  <MapPin className="h-4 w-4 text-brand-primary" />
                  <h3 className="font-display text-base font-bold uppercase tracking-tight text-ink-primary">
                    2. Endereço de Entrega (São Paulo - SP)
                  </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="checkout-cep"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      CEP *
                    </label>
                    <input
                      id="checkout-cep"
                      type="text"
                      inputMode="numeric"
                      value={checkoutDraft.postalCode}
                      onChange={(e) => updateCheckoutDraft({ postalCode: e.target.value })}
                      placeholder="Ex.: 01304-001"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                    {fieldErrors.postalCode && (
                      <p className="mt-1 text-xs font-semibold text-status-error">
                        {fieldErrors.postalCode}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="checkout-street"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      Rua / Avenida *
                    </label>
                    <input
                      id="checkout-street"
                      type="text"
                      value={checkoutDraft.streetName}
                      onChange={(e) => updateCheckoutDraft({ streetName: e.target.value })}
                      placeholder="Ex.: Rua Augusta"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                    {fieldErrors.streetName && (
                      <p className="mt-1 text-xs font-semibold text-status-error">
                        {fieldErrors.streetName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-number"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      Número *
                    </label>
                    <input
                      id="checkout-number"
                      type="text"
                      value={checkoutDraft.streetNumber}
                      onChange={(e) => updateCheckoutDraft({ streetNumber: e.target.value })}
                      placeholder="Ex.: 1500"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                    {fieldErrors.streetNumber && (
                      <p className="mt-1 text-xs font-semibold text-status-error">
                        {fieldErrors.streetNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-complement"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      Complemento (Apto / Bloco)
                    </label>
                    <input
                      id="checkout-complement"
                      type="text"
                      value={checkoutDraft.complement}
                      onChange={(e) => updateCheckoutDraft({ complement: e.target.value })}
                      placeholder="Ex.: Apto 42"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-reference"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      Ponto de referência
                    </label>
                    <input
                      id="checkout-reference"
                      type="text"
                      value={checkoutDraft.reference}
                      onChange={(e) => updateCheckoutDraft({ reference: e.target.value })}
                      placeholder="Ex.: Próximo ao metrô"
                      className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="checkout-notes"
                    className="block text-xs font-bold text-ink-primary"
                  >
                    Observações para a entrega (interfone, portaria, etc.)
                  </label>
                  <input
                    id="checkout-notes"
                    type="text"
                    maxLength={200}
                    value={checkoutDraft.notes}
                    onChange={(e) => updateCheckoutDraft({ notes: e.target.value })}
                    placeholder="Ex.: Deixar na portaria / Interfone 42"
                    className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                  />
                </div>
              </section>

              {/* Pagar.me Hosted Security Notice */}
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-subtle/60 p-3 text-xs text-ink-secondary">
                <ShieldCheck className="h-5 w-5 shrink-0 text-brand-primary" />
                <span>
                  Pagamento 100% seguro processado via <strong>Pagar.me</strong> (Pix com aprovação
                  imediata ou Cartão de Crédito). Nenhum dado de cartão é armazenado neste site.
                </span>
              </div>
            </div>

            {/* Sticky Footer with Summary & Submit Button */}
            <footer className="border-t border-border bg-surface px-5 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
                <span>
                  Subtotal:{' '}
                  <strong className="text-ink-primary">{formatCentsToBRL(subtotalCents)}</strong>
                  {' + '}
                  Entrega:{' '}
                  <strong className="text-ink-primary">
                    {selectedZone ? formatCentsToBRL(deliveryFeeCents) : 'Selecione o bairro'}
                  </strong>
                </span>
                <span className="text-sm font-bold text-brand-primary">
                  Total: {formatCentsToBRL(totalCents)}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || cartItems.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Gerando link seguro Pagar.me...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Ir para pagamento Pagar.me ({formatCentsToBRL(totalCents)})</span>
                  </>
                )}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
