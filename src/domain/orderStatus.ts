/**
 * Pure domain state machine and presentation metadata for Order Tracking (`/orders/:orderId`).
 * Zero React, DOM, or HTTP dependencies (`low_gear` unit-testable).
 */

import type { OrderStatus } from './types';

export interface OrderStatusPresentation {
  status: OrderStatus;
  badgeLabel: string;
  headline: string;
  description: string;
  activeStep: 1 | 2 | 3;
  isCancelled: boolean;
  shouldPoll: boolean;
  showPaymentCta: boolean;
}

const ORDER_STATUS_MAP: Record<OrderStatus, OrderStatusPresentation> = {
  PENDING: {
    status: 'PENDING',
    badgeLabel: 'Aguardando Pagamento',
    headline: 'Aguardando confirmação do pagamento',
    description:
      'Conclua o pagamento via Pix ou Cartão no link seguro do Pagar.me. Assim que confirmado, seu pedido entra direto na cozinha!',
    activeStep: 1,
    isCancelled: false,
    shouldPoll: true,
    showPaymentCta: true,
  },
  PAID: {
    status: 'PAID',
    badgeLabel: 'Na Cozinha',
    headline: 'Pagamento aprovado! Seu Mignon está na grelha',
    description:
      'Recebemos a confirmação do Pagar.me e a cozinha já está preparando seu prato e seus acompanhamentos.',
    activeStep: 2,
    isCancelled: false,
    shouldPoll: true,
    showPaymentCta: false,
  },
  DISPATCHED: {
    status: 'DISPATCHED',
    badgeLabel: 'Saiu para Entrega',
    headline: 'Seu Mignon saiu para entrega!',
    description: 'Nosso entregador próprio já está a caminho do seu endereço. Prepare a mesa!',
    activeStep: 3,
    isCancelled: false,
    shouldPoll: false,
    showPaymentCta: false,
  },
  CANCELLED: {
    status: 'CANCELLED',
    badgeLabel: 'Pedido Cancelado',
    headline: 'Este pedido foi cancelado',
    description:
      'O pagamento expirou ou o pedido foi cancelado. Você pode voltar ao cardápio e montar um novo pedido a qualquer momento.',
    activeStep: 1,
    isCancelled: true,
    shouldPoll: false,
    showPaymentCta: false,
  },
};

/**
 * Returns localized pt-BR status metadata, timeline progress step, and polling behavior for a given `OrderStatus`.
 */
export function getOrderStatusPresentation(status: OrderStatus): OrderStatusPresentation {
  return ORDER_STATUS_MAP[status];
}

/**
 * Determines whether `/orders/:orderId` should continue polling `GET /orders/{order_id}`.
 * Stops polling on terminal states (`DISPATCHED`, `CANCELLED`) to keep AWS Serverless costs near zero.
 */
export function shouldContinueOrderPolling(status: OrderStatus): boolean {
  return ORDER_STATUS_MAP[status].shouldPoll;
}
