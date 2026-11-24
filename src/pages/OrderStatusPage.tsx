/**
 * Epic E4 Live Order Status Tracking Page (`OrderStatusPage.tsx` — `/orders/:orderId`).
 *
 * Responsibilities:
 * 1. Polls `GET /orders/{order_id}` automatically while status is `PENDING` or `PAID`, stopping on `DISPATCHED` or `CANCELLED`.
 * 2. Displays the 3-step visual timeline (1. Pagamento -> 2. Na Cozinha -> 3. Saiu para Entrega) or Cancelled alert.
 * 3. Features Touchpoint #4 of the 1930s rubber-hose Cheeky Bull Mascot (`BoizinhoMascot` variant="full").
 * 4. Surfaces the Pagar.me `checkout_url` recovery CTA whenever `status === 'PENDING'`.
 * 5. Syncs the latest polled status back into `CartContext`'s `recentOrders` (`localStorage`).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Lock,
  RefreshCw,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  formatCentsToBRL,
  getOrderStatusPresentation,
  shouldContinueOrderPolling,
  type OrderResponse,
  type ThemeId,
} from '../domain';
import { apiClient, ApiClientError } from '../services/api';
import { BoizinhoMascot } from '../components/BoizinhoMascot';

interface OrderStatusPageProps {
  orderId: string;
  theme: ThemeId;
  onBackToMenu: () => void;
  onOrderUpdated?: (order: OrderResponse) => void;
  onReorder?: (order: OrderResponse) => void;
  pollIntervalMs?: number;
}

export function OrderStatusPage({
  orderId,
  theme,
  onBackToMenu,
  onOrderUpdated,
  onReorder,
  pollIntervalMs = 5000,
}: OrderStatusPageProps) {
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchOrderSnapshot = useCallback(
    async (signal?: AbortSignal, isBackgroundPoll = false) => {
      if (!isBackgroundPoll) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage(null);

      try {
        const response = await apiClient.getOrder(orderId, signal);
        setOrder(response);
        onOrderUpdated?.(response);
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof ApiClientError) {
          setErrorMessage(err.detail);
        } else {
          setErrorMessage('Não foi possível consultar o status do pedido agora.');
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [orderId, onOrderUpdated],
  );

  // Initial load on mount or orderId change
  useEffect(() => {
    const controller = new AbortController();
    void fetchOrderSnapshot(controller.signal, false);
    return () => controller.abort();
  }, [fetchOrderSnapshot]);

  // Automatic polling while order is in a non-terminal status (PENDING or PAID)
  useEffect(() => {
    if (!order || !shouldContinueOrderPolling(order.status)) {
      return;
    }

    const controller = new AbortController();
    const timerId = window.setInterval(() => {
      void fetchOrderSnapshot(controller.signal, true);
    }, pollIntervalMs);

    return () => {
      controller.abort();
      window.clearInterval(timerId);
    };
  }, [order, pollIntervalMs, fetchOrderSnapshot]);

  const presentation = order ? getOrderStatusPresentation(order.status) : null;

  return (
    <section aria-label="Acompanhamento do Pedido" className="mx-auto max-w-3xl px-4 pt-6 pb-16">
      {/* Top Back to Menu Action Bar */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToMenu}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold text-ink-primary shadow-2xs transition hover:bg-subtle"
        >
          <ArrowLeft className="h-4 w-4 text-brand-primary" />
          <span>Voltar ao cardápio</span>
        </button>

        {order && (
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void fetchOrderSnapshot(undefined, true)}
            aria-label="Atualizar status agora"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3.5 py-1.5 text-xs font-semibold text-ink-secondary transition hover:text-ink-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar status'}</span>
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && !order && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-ink-secondary">
          Consultando status do pedido <strong>{orderId}</strong>...
        </div>
      )}

      {/* Error State */}
      {!isLoading && errorMessage && !order && (
        <div
          role="alert"
          className="rounded-2xl border border-status-error/40 bg-surface p-6 text-center"
        >
          <AlertCircle className="mx-auto h-8 w-8 text-status-error" />
          <p className="mt-2 text-sm font-bold text-status-error">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void fetchOrderSnapshot(undefined, false)}
            className="mt-4 rounded-full bg-brand-primary px-5 py-2 text-xs font-bold text-white"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loaded Order Tracking Card */}
      {order && presentation && (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-md">
          {/* Hero Banner with Touchpoint #4: Full-Body Cheeky Bull Mascot */}
          <div className="flex flex-col items-center justify-between gap-4 border-b border-border bg-subtle/60 p-6 sm:flex-row">
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span
                  data-testid="order-status-badge"
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    presentation.isCancelled
                      ? 'bg-status-error text-white'
                      : order.status === 'PENDING'
                        ? 'bg-brand-primary text-white'
                        : 'bg-status-success text-white'
                  }`}
                >
                  {presentation.isCancelled ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : order.status === 'PENDING' ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>{presentation.badgeLabel}</span>
                </span>

                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold text-ink-primary">
                  Pedido #{order.display_id}
                </span>
              </div>

              <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-ink-primary sm:text-3xl">
                {presentation.headline}
              </h1>

              <p className="max-w-lg text-xs leading-relaxed text-ink-secondary">
                {presentation.description}
              </p>

              <p className="text-[11px] font-mono text-ink-secondary">
                ID: {order.order_id}
                {presentation.shouldPoll && ' • Atualização automática ativa'}
              </p>
            </div>

            {/* Touchpoint #4: Full-Body 1930s Rubber-Hose Bull Chef Mascot */}
            <BoizinhoMascot
              theme={theme}
              variant="full-body"
              className="h-32 w-32 shrink-0 rounded-2xl border-2 border-border bg-surface p-1 shadow-sm"
            />
          </div>

          {/* 3-Step Visual Order Progress Timeline (Hidden when CANCELLED) */}
          {!presentation.isCancelled && (
            <div className="border-b border-border px-6 py-5">
              <ol aria-label="Etapas do pedido" className="grid gap-3 sm:grid-cols-3">
                {/* Step 1: Pagamento */}
                <li
                  data-testid="timeline-step-1"
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    presentation.activeStep >= 1
                      ? 'border-brand-primary bg-brand-primary/10 text-ink-primary'
                      : 'border-border bg-subtle/40 text-ink-secondary'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      presentation.activeStep > 1
                        ? 'bg-status-success text-white'
                        : 'bg-brand-primary text-white'
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-xs font-bold">1. Pagamento</span>
                    <span className="text-[11px] text-ink-secondary">
                      {order.status === 'PENDING' ? 'Aguardando Pagar.me' : 'Confirmado'}
                    </span>
                  </div>
                </li>

                {/* Step 2: Na Cozinha */}
                <li
                  data-testid="timeline-step-2"
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    presentation.activeStep >= 2
                      ? 'border-status-success bg-status-success/10 text-ink-primary'
                      : 'border-border bg-subtle/40 text-ink-secondary'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      presentation.activeStep >= 2
                        ? 'bg-status-success text-white'
                        : 'bg-border text-ink-secondary'
                    }`}
                  >
                    <Flame className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-xs font-bold">2. Na Cozinha</span>
                    <span className="text-[11px] text-ink-secondary">
                      {presentation.activeStep >= 2
                        ? 'Preparando na grelha'
                        : 'Aguardando confirmação'}
                    </span>
                  </div>
                </li>

                {/* Step 3: Saiu para Entrega */}
                <li
                  data-testid="timeline-step-3"
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    presentation.activeStep >= 3
                      ? 'border-status-success bg-status-success/10 text-ink-primary'
                      : 'border-border bg-subtle/40 text-ink-secondary'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      presentation.activeStep >= 3
                        ? 'bg-status-success text-white'
                        : 'bg-border text-ink-secondary'
                    }`}
                  >
                    <Truck className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-xs font-bold">3. Entrega Própria</span>
                    <span className="text-[11px] text-ink-secondary">
                      {presentation.activeStep >= 3
                        ? 'A caminho do endereço'
                        : 'Logo após o preparo'}
                    </span>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Payment Link Recovery CTA (Visible strictly when status === 'PENDING' and checkout_url is present) */}
          {presentation.showPaymentCta && order.checkout_url && (
            <div className="border-b border-border bg-brand-primary/5 p-6">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-sm font-bold text-ink-primary">
                    Ainda não concluiu o pagamento no Pagar.me?
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    Clique no botão ao lado para abrir seu link oficial de pagamento (Pix com QR
                    Code ou Cartão de Crédito).
                  </p>
                </div>

                <a
                  href={order.checkout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="order-status-payment-link"
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3.5 text-xs font-bold text-white shadow-md transition hover:bg-brand-hover sm:w-auto"
                >
                  <Lock className="h-4 w-4" />
                  <span>Pagar agora no Pagar.me ({formatCentsToBRL(order.total_cents)})</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Ordered Items & Integer-Centavos Financial Summary */}
          <div className="p-6">
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-ink-primary">
              Resumo do Pedido #{order.display_id}
            </h2>

            {order.items.length > 0 && (
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-subtle/40 px-4">
                {order.items.map((item, idx) => (
                  <li key={`${item.item_id}-${String(idx)}`} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-bold text-ink-primary">
                          {item.quantity}x {item.name}
                        </span>
                        {item.size && (
                          <span className="ml-1.5 text-xs text-ink-secondary">({item.size})</span>
                        )}
                        {item.choices.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-ink-secondary">
                            {item.choices.map((c) => (
                              <li key={`${c.group_id}-${c.choice_item_id}`}>
                                &bull; {c.quantity}x {c.name}
                              </li>
                            ))}
                          </ul>
                        )}
                        {item.notes && (
                          <p className="mt-1 text-[11px] italic text-ink-secondary">
                            Obs.: {item.notes}
                          </p>
                        )}
                      </div>

                      <span className="text-sm font-bold text-ink-primary">
                        {formatCentsToBRL(item.line_total_cents)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {order.notes && (
              <p className="mt-3 rounded-xl border border-border bg-subtle/50 px-3.5 py-2 text-xs text-ink-secondary">
                <strong>Observações da entrega:</strong> {order.notes}
              </p>
            )}

            {/* Authoritative Integer-Centavos Totals */}
            <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary">Subtotal dos itens</span>
                <span
                  data-testid="order-status-subtotal"
                  className="font-semibold text-ink-primary"
                >
                  {formatCentsToBRL(order.subtotal_cents)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-ink-secondary">Taxa de entrega</span>
                <span
                  data-testid="order-status-delivery-fee"
                  className="font-semibold text-ink-primary"
                >
                  {formatCentsToBRL(order.delivery_fee_cents)}
                </span>
              </div>

              {order.discount_cents > 0 && (
                <div className="flex items-center justify-between text-status-success">
                  <span>Desconto</span>
                  <span className="font-semibold">-{formatCentsToBRL(order.discount_cents)}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-2 text-base">
                <span className="font-display font-bold uppercase text-ink-primary">Total</span>
                <span
                  data-testid="order-status-total"
                  className="text-lg font-bold text-brand-primary"
                >
                  {formatCentsToBRL(order.total_cents)}
                </span>
              </div>
            </div>

            {order.items.length > 0 && onReorder && (
              <button
                type="button"
                onClick={() => {
                  onReorder(order);
                  onBackToMenu();
                }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-subtle px-4 py-2.5 text-xs font-bold text-ink-primary transition hover:bg-canvas"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Pedir os mesmos itens novamente</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
