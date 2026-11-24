/**
 * Pure helper functions for CEP delivery formatting, friendly CEP error presentation,
 * and pre-calculated delivery zones search.
 */

import type { DeliveryZone } from './types';

/**
 * Strips diacritics/accents and normalizes text for neighborhood search (e.g., "Consolação" -> "consolacao").
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Formats raw numeric CEP input into `XXXXX-XXX` (capped at 8 digits).
 */
export function formatCepInput(raw: string): string {
  const digits = raw.replace(/\D+/g, '').slice(0, 8);
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Returns true when the raw CEP string contains exactly 8 numeric digits.
 */
export function isCompleteCep(raw: string): boolean {
  return raw.replace(/\D+/g, '').length === 8;
}

/**
 * Maps backend CEP 422 error codes to customer-friendly pt-BR guidance.
 */
export function getFriendlyCepErrorMessage(errorCode: string, fallbackDetail: string): string {
  switch (errorCode) {
    case 'DeliveryOutOfRangeError':
      return 'Infelizmente este CEP está fora do nosso raio de entrega própria de 5,5 km.';
    case 'CepNotFoundError':
      return 'CEP não encontrado. Verifique os 8 números digitados.';
    case 'InvalidCepError':
      return 'Informe um CEP válido com 8 dígitos (ex.: 03195-000).';
    default:
      return fallbackDetail || 'Não foi possível calcular o frete para este CEP agora.';
  }
}

/**
 * Filters and sorts delivery zones by name (and distance tie-breaker) matching a customer query.
 */
export function filterDeliveryZones(
  zones: ReadonlyArray<DeliveryZone>,
  query: string,
): DeliveryZone[] {
  const normalizedQuery = normalizeSearchText(query);

  const filtered = normalizedQuery
    ? zones.filter((zone) => normalizeSearchText(zone.name).includes(normalizedQuery))
    : [...zones];

  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * Finds a delivery zone by `zone_id` or returns `undefined`.
 */
export function findDeliveryZoneById(
  zones: ReadonlyArray<DeliveryZone>,
  zoneId: string,
): DeliveryZone | undefined {
  return zones.find((zone) => zone.zone_id === zoneId);
}
