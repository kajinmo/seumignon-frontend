/**
 * Pure domain helpers for Checkout validation, payload transformation (`POST /orders`),
 * and recent order tracking persistence (`localStorage` serialization).
 * Zero React, DOM, or HTTP dependencies (`low_gear` unit-testable).
 */

import type {
  CartLineItem,
  CreateOrderRequest,
  DeliveryZone,
  OrderResponse,
  OrderStatus,
} from './types';
import { findDeliveryZoneById } from './delivery';

export interface CheckoutFormDraft {
  name: string;
  phone: string;
  email: string;
  documentNumber: string;
  zoneId: string;
  postalCode: string;
  streetName: string;
  streetNumber: string;
  complement: string;
  reference: string;
  notes: string;
}

export interface CheckoutFieldErrors {
  name?: string;
  phone?: string;
  email?: string;
  documentNumber?: string;
  zoneId?: string;
  postalCode?: string;
  streetName?: string;
  streetNumber?: string;
}

export interface CheckoutValidationResult {
  isValid: boolean;
  errors: CheckoutFieldErrors;
}

export interface StoredRecentOrder {
  order_id: string;
  display_id: string;
  status: OrderStatus;
  created_at_iso: string;
  total_cents: number;
  checkout_url: string;
}

export const INITIAL_CHECKOUT_FORM_DRAFT: CheckoutFormDraft = {
  name: '',
  phone: '',
  email: '',
  documentNumber: '',
  zoneId: '',
  postalCode: '',
  streetName: '',
  streetNumber: '',
  complement: '',
  reference: '',
  notes: '',
};

/**
 * Strips all non-numeric characters from a string (e.g., "(11) 99999-8888" -> "11999998888").
 */
export function stripNonDigits(raw: string): string {
  return raw.replace(/\D+/g, '');
}

/**
 * Validates customer and delivery address fields before enabling/submitting `POST /orders`.
 */
export function validateCheckoutForm(
  draft: CheckoutFormDraft,
  availableZones: ReadonlyArray<DeliveryZone>,
): CheckoutValidationResult {
  const errors: CheckoutFieldErrors = {};

  const trimmedName = draft.name.trim();
  if (trimmedName.length < 3) {
    errors.name = 'Informe seu nome completo.';
  }

  const digitsPhone = stripNonDigits(draft.phone);
  if (digitsPhone.length < 10 || digitsPhone.length > 11) {
    errors.phone = 'Informe um WhatsApp/telefone válido com DDD (10 ou 11 dígitos).';
  }

  const trimmedEmail = draft.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Informe um e-mail válido para receber o comprovante.';
  }

  const digitsDoc = stripNonDigits(draft.documentNumber);
  if (digitsDoc.length !== 11 && digitsDoc.length !== 14) {
    errors.documentNumber = 'Informe um CPF válido (11 dígitos).';
  }

  const matchedZone = findDeliveryZoneById(availableZones, draft.zoneId);
  if (!matchedZone) {
    errors.zoneId = 'Selecione seu bairro de entrega na lista.';
  }

  const digitsCep = stripNonDigits(draft.postalCode);
  if (digitsCep.length !== 8) {
    errors.postalCode = 'Informe um CEP válido com 8 dígitos.';
  }

  if (draft.streetName.trim().length < 2) {
    errors.streetName = 'Informe o nome da rua ou avenida.';
  }

  if (draft.streetNumber.trim().length < 1) {
    errors.streetNumber = 'Informe o número do endereço.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Builds the exact `CreateOrderRequest` payload required by `seumignon-backend` (`POST /orders`).
 */
export function buildCreateOrderRequest(params: {
  draft: CheckoutFormDraft;
  cartItems: ReadonlyArray<CartLineItem>;
}): CreateOrderRequest {
  const { draft, cartItems } = params;

  if (cartItems.length === 0) {
    throw new Error('Cannot build CreateOrderRequest with an empty cart.');
  }

  return {
    customer: {
      name: draft.name.trim(),
      phone: stripNonDigits(draft.phone),
      email: draft.email.trim().toLowerCase(),
      document_number: stripNonDigits(draft.documentNumber),
      customer_id: '',
    },
    delivery_address: {
      zone_id: draft.zoneId.trim(),
      street_name: draft.streetName.trim(),
      street_number: draft.streetNumber.trim(),
      city: 'São Paulo',
      state: 'SP',
      postal_code: stripNonDigits(draft.postalCode),
      complement: draft.complement.trim(),
      reference: draft.reference.trim(),
      country: 'BR',
    },
    items: cartItems.map((line) => ({
      item_id: line.item_id,
      quantity: line.quantity,
      choices: line.choices.map((c) => ({
        group_id: c.group_id,
        choice_item_id: c.choice_item_id,
        quantity: c.quantity,
        notes: c.notes ?? '',
      })),
      notes: line.notes.trim(),
    })),
    notes: draft.notes.trim(),
  };
}

/**
 * Converts an `OrderResponse` into a lightweight `StoredRecentOrder` summary for `localStorage`.
 */
export function toStoredRecentOrder(order: OrderResponse): StoredRecentOrder {
  return {
    order_id: order.order_id,
    display_id: order.display_id,
    status: order.status,
    created_at_iso: order.created_at_iso,
    total_cents: order.total_cents,
    checkout_url: order.checkout_url,
  };
}

/**
 * Prepends or updates a recent order inside the stored list (capped at maxEntries = 10).
 */
export function upsertRecentOrderList(
  existing: ReadonlyArray<StoredRecentOrder>,
  incomingOrder: OrderResponse,
  maxEntries = 10,
): StoredRecentOrder[] {
  const summary = toStoredRecentOrder(incomingOrder);
  const filtered = existing.filter((entry) => entry.order_id !== summary.order_id);
  return [summary, ...filtered].slice(0, maxEntries);
}
