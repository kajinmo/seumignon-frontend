/**
 * Smart Welcome & Campaign Popup (`WelcomePromoModal`).
 * Opens on the customer's first visit (or when a new campaignId is configured) to explain the
 * 3-step meal assembly flow ("Escolha seu prato + 3 acompanhamentos inclusos") with an appetizing photo
 * and the real 1930s rubber-hose Cheeky Bull illustration.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ThemeId, WelcomePromoConfig } from '../domain';
import { BRAND_ASSETS } from './brandAssets';

interface WelcomePromoModalProps {
  config: WelcomePromoConfig;
  theme?: ThemeId;
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomePromoModal({
  config,
  theme = 'red-kraft',
  isOpen,
  onClose,
}: WelcomePromoModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !config.enabled) {
    return null;
  }

  const mascotImageUrl =
    theme === 'red-kraft' ? BRAND_ASSETS.mascotBoizinhoRedUrl : BRAND_ASSETS.mascotBoizinhoBlueUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border-2 border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close (X) Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar boas-vindas e ir para o cardápio"
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-surface/95 text-ink-primary shadow-md transition hover:bg-subtle"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Appetizing Hero Photography Header + Illustrated Cheeky Bull Mascot Card */}
        <div className="relative h-52 w-full overflow-hidden bg-subtle sm:h-60">
          <img
            src={config.heroImageUrl}
            alt="Filé Mignon grelhado com acompanhamentos do Seu Mignon"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
            <div>
              <span className="inline-block rounded-full bg-brand-primary px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs">
                {config.badgeText}
              </span>
              <h2
                id="welcome-modal-title"
                className="mt-1.5 font-display text-2xl font-bold uppercase leading-tight text-white sm:text-3xl"
              >
                {config.headline}
              </h2>
            </div>

            <img
              src={mascotImageUrl}
              alt="Mascote Boizinho Debochado Seu Mignon"
              className="h-24 w-24 shrink-0 rounded-2xl border-2 border-white bg-[#F7F3EA] object-contain p-1 shadow-xl"
            />
          </div>
        </div>

        {/* 3-Step Meal Assembly Instructions */}
        <div className="p-5 sm:p-6">
          <p className="text-sm text-ink-secondary">{config.subtitle}</p>

          <ol className="mt-4 space-y-3">
            {config.steps.map((step) => (
              <li
                key={step.stepNumber}
                className="flex items-start gap-3 rounded-xl border border-border bg-subtle/60 p-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary font-display text-sm font-bold text-white">
                  {step.stepNumber}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">{step.title}</h3>
                  <p className="text-xs text-ink-secondary">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-brand-primary px-5 py-3.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-brand-hover"
          >
            {config.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
