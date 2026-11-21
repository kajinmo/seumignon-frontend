/**
 * Pure helper functions for pre-calculated neighborhood delivery zones (zero Maps API cost).
 * Supports accent-insensitive search for the checkout neighborhood selector.
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
