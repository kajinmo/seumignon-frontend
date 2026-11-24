/**
 * Pure domain helpers for Checkout validation, payload transformation (`POST /orders`),
 * and recent order tracking persistence (`localStorage` serialization).
 * Zero React, DOM, or HTTP dependencies (`low_gear` unit-testable).
 */

import type {
  CartLineItem,
  CreateOrderRequest,
  DeliveryFeeQuoteResponse,
  OrderResponse,
  OrderStatus,
} from './types';
import { formatCepInput } from './delivery';

export interface CheckoutFormDraft {
  name: string;
  phone: string;
  email: string;
  documentNumber: string;
  postalCode: string;
  streetName: string;
  streetNumber: string;
  district: string;
  complement: string;
  reference: string;
  notes: string;
}

export interface CheckoutFieldErrors {
  name?: string;
  phone?: string;
  email?: string;
  documentNumber?: string;
  postalCode?: string;
  streetName?: string;
  streetNumber?: string;
  district?: string;
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
  postalCode: '',
  streetName: '',
  streetNumber: '',
  district: '',
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
 * Formats numeric input progressively into Brazilian CPF mask (`000.000.000-00`),
 * capped at 11 digits.
 */
export function formatCpfInput(raw: string): string {
  const digits = stripNonDigits(raw).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Validates that a customer name contains at least first name and surname
 * (required by Pagar.me Hosted Checkout, max 64 characters).
 */
export function isValidFullName(raw: string): boolean {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (normalized.length < 3 || normalized.length > 64) return false;
  const parts = normalized.split(' ').filter((part) => part.length > 0);
  return parts.length >= 2 && parts[0].length >= 2 && parts[parts.length - 1].length >= 2;
}

/**
 * Validates Brazilian CPF using the official Modulo-11 check digits algorithm,
 * rejecting non-11-digit inputs and repeated-digit sequences (e.g., `111.111.111-11`).
 */
export function isValidCpf(raw: string): boolean {
  const digits = stripNonDigits(raw);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (sliceLength: number): number => {
    let sum = 0;
    for (let i = 0; i < sliceLength; i += 1) {
      sum += Number(digits[i]) * (sliceLength + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calcCheckDigit(9) === Number(digits[9]) && calcCheckDigit(10) === Number(digits[10]);
}

/**
 * Validates email syntax strictly for frontend UX (rejecting spaces, consecutive dots,
 * malformed domain labels, or invalid TLDs like single-letter/numeric extensions).
 */
export function isValidEmail(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  if (normalized.length < 6 || normalized.length > 254) return false;
  if (/\s/.test(normalized) || normalized.includes('..')) return false;

  const parts = normalized.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || local.length > 64 || !domain || domain.length > 253) return false;
  if (!/^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?$/i.test(local)) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;

  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,24}$/i.test(tld)) return false;

  return labels.every(
    (label) =>
      label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
  );
}

/**
 * Validates customer and delivery address fields (including authoritative CEP delivery quote)
 * before enabling/submitting `POST /orders`.
 */
export function validateCheckoutForm(
  draft: CheckoutFormDraft,
  activeQuote?: DeliveryFeeQuoteResponse | null,
): CheckoutValidationResult {
  const errors: CheckoutFieldErrors = {};

  if (!isValidFullName(draft.name)) {
    errors.name = 'Informe seu nome completo (nome e sobrenome).';
  }

  const digitsPhone = stripNonDigits(draft.phone);
  if (digitsPhone.length < 10 || digitsPhone.length > 11) {
    errors.phone = 'Informe um WhatsApp/telefone válido com DDD (10 ou 11 dígitos).';
  }

  if (!isValidEmail(draft.email)) {
    errors.email = 'Informe um e-mail válido para receber o comprovante.';
  }

  if (!isValidCpf(draft.documentNumber)) {
    errors.documentNumber = 'Informe um CPF válido.';
  }

  const digitsCep = stripNonDigits(draft.postalCode);
  if (digitsCep.length !== 8) {
    errors.postalCode = 'Informe um CEP válido com 8 dígitos.';
  } else if (activeQuote !== undefined) {
    const quotedCepDigits = activeQuote ? stripNonDigits(activeQuote.cep) : '';
    if (!activeQuote || quotedCepDigits !== digitsCep) {
      errors.postalCode = 'Confirme um CEP válido dentro da área de entrega (até 5,5 km).';
    }
  }

  if (draft.district.trim().length < 2) {
    errors.district = 'Informe o bairro de entrega.';
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
  customerId?: string;
}): CreateOrderRequest {
  const { draft, cartItems, customerId = '' } = params;

  if (cartItems.length === 0) {
    throw new Error('Cannot build CreateOrderRequest with an empty cart.');
  }

  return {
    customer: {
      name: draft.name.trim(),
      phone: stripNonDigits(draft.phone),
      email: draft.email.trim().toLowerCase(),
      document_number: stripNonDigits(draft.documentNumber),
      customer_id: customerId,
    },
    delivery_address: {
      postal_code: formatCepInput(draft.postalCode),
      street_name: draft.streetName.trim(),
      street_number: draft.streetNumber.trim(),
      district: draft.district.trim(),
      city: 'São Paulo',
      state: 'SP',
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
