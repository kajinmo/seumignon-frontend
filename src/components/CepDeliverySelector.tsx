/**
 * Authoritative CEP-driven Delivery Fee Selector (`CepDeliverySelector.tsx`).
 * Replaces manual neighborhood zone picking with backend-validated distance/fee lookup
 * via `GET /delivery-fee?cep=...` (5.5 km cutoff) and friendly pt-BR 422 error handling.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MapPin, Search } from 'lucide-react';
import {
  formatCepInput,
  formatCentsToBRL,
  isCompleteCep,
  stripNonDigits,
  type DeliveryFeeQuoteResponse,
} from '../domain';

interface CepDeliverySelectorProps {
  postalCode: string;
  deliveryQuote: DeliveryFeeQuoteResponse | null;
  isQuoting: boolean;
  quoteError: string | null;
  onPostalCodeChange: (formattedCep: string) => void;
  onQuoteCep: (cep: string) => Promise<DeliveryFeeQuoteResponse | null>;
  idPrefix?: string;
  validationError?: string;
  alwaysShowInput?: boolean;
}

export function CepDeliverySelector({
  postalCode,
  deliveryQuote,
  isQuoting,
  quoteError,
  onPostalCodeChange,
  onQuoteCep,
  idPrefix = 'bag',
  validationError,
  alwaysShowInput = false,
}: CepDeliverySelectorProps) {
  const [isEditingCep, setIsEditingCep] = useState<boolean>(false);
  const lastAutoQuotedDigitsRef = useRef<string>('');

  const currentDigits = stripNonDigits(postalCode);
  const quotedDigits = deliveryQuote ? stripNonDigits(deliveryQuote.cep) : '';
  const hasMatchingQuote = Boolean(deliveryQuote && quotedDigits === currentDigits);

  // Automatically trigger `GET /delivery-fee` once 8 digits are entered
  useEffect(() => {
    if (!isCompleteCep(postalCode)) {
      lastAutoQuotedDigitsRef.current = '';
      return;
    }
    if (hasMatchingQuote || currentDigits === lastAutoQuotedDigitsRef.current) {
      return;
    }
    lastAutoQuotedDigitsRef.current = currentDigits;
    void onQuoteCep(postalCode).then((quote) => {
      if (quote) {
        setIsEditingCep(false);
      }
    });
  }, [postalCode, currentDigits, hasMatchingQuote, onQuoteCep]);

  const inputId = idPrefix === 'checkout' ? 'checkout-cep' : `${idPrefix}-cep-input`;
  const showInput = alwaysShowInput || !hasMatchingQuote || isEditingCep;
  const activeError = quoteError || validationError;

  function handleInputChange(rawValue: string) {
    const formatted = formatCepInput(rawValue);
    onPostalCodeChange(formatted);
  }

  function handleTriggerLookup() {
    lastAutoQuotedDigitsRef.current = currentDigits;
    void onQuoteCep(postalCode).then((quote) => {
      if (quote) {
        setIsEditingCep(false);
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleTriggerLookup();
    }
  }

  return (
    <div className="rounded-xl border border-border bg-subtle/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-primary"
        >
          <MapPin className="h-3.5 w-3.5 text-brand-primary" />
          <span>Entrega por CEP (até 5,5 km)</span>
        </label>

        {hasMatchingQuote && deliveryQuote && (
          <span
            data-testid={`${idPrefix}-selected-cep-fee`}
            className="rounded-full bg-brand-primary/15 px-2.5 py-0.5 text-xs font-bold text-brand-primary"
          >
            Taxa: {formatCentsToBRL(deliveryQuote.fee_cents)}
          </span>
        )}
      </div>

      {showInput && (
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-secondary"
            />
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              maxLength={9}
              value={postalCode}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite seu CEP (ex.: 03195-000)"
              aria-label="CEP de entrega"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-secondary focus:border-brand-primary focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={isQuoting}
            onClick={handleTriggerLookup}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isQuoting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Calculando...</span>
              </>
            ) : (
              <span>Calcular</span>
            )}
          </button>
        </div>
      )}

      {hasMatchingQuote && deliveryQuote && (
        <div
          data-testid={`${idPrefix}-cep-quote-card`}
          className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-brand-primary/40 bg-surface px-3 py-2"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
            <div>
              <span className="block text-xs font-bold text-ink-primary">
                {deliveryQuote.district || 'Área atendida'} &bull; CEP{' '}
                {formatCepInput(deliveryQuote.cep)}
              </span>
              <span className="text-[11px] text-ink-secondary">
                Distância: {deliveryQuote.distance_km.toFixed(1).replace('.', ',')} km &bull;{' '}
                {formatCentsToBRL(deliveryQuote.fee_cents)}
              </span>
            </div>
          </div>

          {!alwaysShowInput && (
            <button
              type="button"
              onClick={() => setIsEditingCep((prev) => !prev)}
              className="rounded-full border border-border bg-subtle px-2.5 py-1 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-white"
            >
              {isEditingCep ? 'Fechar' : 'Trocar CEP'}
            </button>
          )}
        </div>
      )}

      {activeError && (
        <div
          role="alert"
          data-testid={`${idPrefix}-cep-error`}
          className="mt-2 flex items-start gap-1.5 rounded-lg border border-status-error/30 bg-status-error/10 px-2.5 py-2 text-xs font-semibold text-status-error"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  );
}
