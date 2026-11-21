import { describe, expect, it } from 'vitest';
import { getOrderStatusPresentation, shouldContinueOrderPolling } from '../../src/domain';

describe('low_gear: order status state machine & polling rules (/orders/:orderId)', () => {
  it('enables polling and payment link recovery CTA strictly when status is PENDING', () => {
    const pending = getOrderStatusPresentation('PENDING');
    expect(pending.activeStep).toBe(1);
    expect(pending.shouldPoll).toBe(true);
    expect(pending.showPaymentCta).toBe(true);
    expect(pending.isCancelled).toBe(false);
    expect(shouldContinueOrderPolling('PENDING')).toBe(true);
  });

  it('continues polling during PAID (kitchen preparation) and hides payment CTA', () => {
    const paid = getOrderStatusPresentation('PAID');
    expect(paid.activeStep).toBe(2);
    expect(paid.shouldPoll).toBe(true);
    expect(paid.showPaymentCta).toBe(false);
    expect(paid.isCancelled).toBe(false);
    expect(shouldContinueOrderPolling('PAID')).toBe(true);
  });

  it('stops polling once order reaches terminal DISPATCHED or CANCELLED state', () => {
    const dispatched = getOrderStatusPresentation('DISPATCHED');
    expect(dispatched.activeStep).toBe(3);
    expect(dispatched.shouldPoll).toBe(false);
    expect(dispatched.showPaymentCta).toBe(false);
    expect(shouldContinueOrderPolling('DISPATCHED')).toBe(false);

    const cancelled = getOrderStatusPresentation('CANCELLED');
    expect(cancelled.isCancelled).toBe(true);
    expect(cancelled.shouldPoll).toBe(false);
    expect(cancelled.showPaymentCta).toBe(false);
    expect(shouldContinueOrderPolling('CANCELLED')).toBe(false);
  });
});
