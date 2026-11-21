/**
 * Real illustrated brand & mascot component backed by the generated 1930s rubber-hose assets.
 */

import type { ThemeId } from '../domain';
import { BRAND_ASSETS } from './brandAssets';

interface BoizinhoMascotProps {
  theme?: ThemeId;
  variant?: 'stamp' | 'chef-badge' | 'full-body' | 'angry-empty-bag';
  className?: string;
}

export function BoizinhoMascot({
  theme = 'blue-bistro',
  variant = 'stamp',
  className = 'h-12 w-12',
}: BoizinhoMascotProps) {
  if (variant === 'stamp') {
    return (
      <img
        src={BRAND_ASSETS.logoStampRedUrl}
        alt="Selo Seu Mignon — Boizinho Debochado"
        className={`rounded-full border border-border object-cover shadow-2xs ${className}`}
      />
    );
  }

  if (variant === 'angry-empty-bag') {
    return (
      <img
        src={BRAND_ASSETS.mascotAngryEmptyBagUrl}
        alt="Boizinho Seu Mignon impaciente com a sacola vazia"
        className={`rounded-2xl border border-border object-contain shadow-xs ${className}`}
      />
    );
  }

  const mascotSrc =
    theme === 'red-kraft' ? BRAND_ASSETS.mascotBoizinhoRedUrl : BRAND_ASSETS.mascotBoizinhoBlueUrl;

  return (
    <img
      src={mascotSrc}
      alt="Mascote Boizinho Debochado Seu Mignon"
      className={`rounded-2xl border border-border object-contain shadow-xs ${className}`}
    />
  );
}
