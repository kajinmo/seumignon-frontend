/**
 * Pre-calculated Neighborhood Delivery Fee Selector (`NeighborhoodSelector.tsx`).
 * Epic E3 Guardrail: Zero Google Maps API cost. Uses the backend's `delivery_zones` tiers
 * (`<= 1.5 km`: R$ 5,00, `<= 3.5 km`: R$ 8,00, `<= 5.5 km`: R$ 9,00) with accent-insensitive filtering.
 */

import { useMemo, useState } from 'react';
import { Check, MapPin, Search, X } from 'lucide-react';
import { filterDeliveryZones, formatCentsToBRL, type DeliveryZone } from '../domain';

interface NeighborhoodSelectorProps {
  zones: ReadonlyArray<DeliveryZone>;
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
  idPrefix?: string;
  errorMessage?: string;
}

export function NeighborhoodSelector({
  zones,
  selectedZoneId,
  onSelectZone,
  idPrefix = 'bag',
  errorMessage,
}: NeighborhoodSelectorProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isListExpanded, setIsListExpanded] = useState<boolean>(false);

  const selectedZone = useMemo(
    () => zones.find((z) => z.zone_id === selectedZoneId),
    [zones, selectedZoneId],
  );

  const filteredZones = useMemo(
    () => filterDeliveryZones(zones, searchQuery),
    [zones, searchQuery],
  );

  const searchInputId = `${idPrefix}-neighborhood-search`;

  return (
    <div className="rounded-xl border border-border bg-subtle/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={searchInputId}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-primary"
        >
          <MapPin className="h-3.5 w-3.5 text-brand-primary" />
          <span>Bairro de Entrega (até 5,5 km)</span>
        </label>

        {selectedZone && (
          <span
            data-testid={`${idPrefix}-selected-zone-fee`}
            className="rounded-full bg-brand-primary/15 px-2.5 py-0.5 text-xs font-bold text-brand-primary"
          >
            Taxa: {formatCentsToBRL(selectedZone.fee_cents)}
          </span>
        )}
      </div>

      {/* Selected Neighborhood Summary Card (with quick "Trocar bairro" button) */}
      {selectedZone && !isListExpanded ? (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-brand-primary/40 bg-surface px-3 py-2">
          <div>
            <span className="block text-sm font-bold text-ink-primary">{selectedZone.name}</span>
            <span className="text-[11px] text-ink-secondary">
              Distância aprox.: {selectedZone.distance_km.toFixed(1).replace('.', ',')} km &bull;{' '}
              {formatCentsToBRL(selectedZone.fee_cents)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsListExpanded(true)}
            className="rounded-full border border-border bg-subtle px-2.5 py-1 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-white"
          >
            Trocar bairro
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {/* Search Input */}
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-secondary"
            />
            <input
              id={searchInputId}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite seu bairro (ex.: Jardins, Consolação)..."
              aria-label="Buscar bairro de entrega"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-8 text-xs text-ink-primary placeholder:text-ink-secondary focus:border-brand-primary focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca de bairro"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-secondary hover:text-ink-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Scrollable Neighborhood Options List */}
          <div
            role="listbox"
            aria-label="Bairros atendidos pelo Seu Mignon"
            className="max-h-44 space-y-1 overflow-y-auto pr-1"
          >
            {filteredZones.length === 0 ? (
              <p className="py-2 text-center text-xs text-ink-secondary">
                Nenhum bairro encontrado para &ldquo;{searchQuery}&rdquo; dentro do raio de 5,5 km.
              </p>
            ) : (
              filteredZones.map((zone) => {
                const isSelected = zone.zone_id === selectedZoneId;
                return (
                  <button
                    key={zone.zone_id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectZone(zone.zone_id);
                      setIsListExpanded(false);
                      setSearchQuery('');
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-border bg-surface text-ink-primary hover:border-brand-primary/40 hover:bg-subtle'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                      <div>
                        <span className="font-bold">{zone.name}</span>
                        <span
                          className={`ml-1.5 text-[11px] ${
                            isSelected ? 'text-white/85' : 'text-ink-secondary'
                          }`}
                        >
                          ({zone.distance_km.toFixed(1).replace('.', ',')} km)
                        </span>
                      </div>
                    </div>

                    <span
                      className={`font-bold ${isSelected ? 'text-white' : 'text-brand-primary'}`}
                    >
                      {formatCentsToBRL(zone.fee_cents)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-status-error">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
