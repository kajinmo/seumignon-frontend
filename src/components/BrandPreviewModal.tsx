/**
 * Interactive Brand & Mascot Showcase Modal (`BrandPreviewModal`).
 * Lets the restaurant owner inspect all generated high-resolution brand illustrations side-by-side
 * inside the live app (including the clean Blue/Red "O ORIGINAL SEU MIGNON" logos and the angry empty-bag bull).
 */

import { X } from 'lucide-react';
import { BRAND_ASSETS } from './brandAssets';
import type { ThemeId } from '../domain';

interface BrandPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
}

export function BrandPreviewModal({
  isOpen,
  onClose,
  activeTheme,
  onSelectTheme,
}: BrandPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-showcase-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border-2 border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <span className="inline-block rounded-full bg-brand-primary/15 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-primary">
              Estúdio de Marca — Épico E0 / E2
            </span>
            <h2
              id="brand-showcase-title"
              className="mt-1 font-display text-2xl font-bold uppercase tracking-tight text-ink-primary sm:text-3xl"
            >
              Logos &amp; Mascote Boizinho Debochado
            </h2>
            <p className="mt-1 text-xs text-ink-secondary">
              Compare o logo limpo &ldquo;O ORIGINAL SEU MIGNON&rdquo; (Azul #10388B vs. Vermelho
              #CB2031), o Carimbo &ldquo;Chad&rdquo;, o Boizinho Pistola da Sacola Vazia e os
              mascotes de corpo inteiro.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar vitrine de logos e mascote"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-ink-primary transition hover:bg-canvas"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Visual Grid of All Generated Brand Assets */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Clean Block Logo — Blue Version */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-subtle/60 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                  1. Logo Limpo — Azul (#10388B)
                </span>
                <span className="rounded bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
                  The Bear Clean
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-[#F7F3EA]">
                <img
                  src={BRAND_ASSETS.logoOriginalCleanBlueUrl}
                  alt="Logo O Original Seu Mignon Limpo Azul"
                  className="h-48 w-full object-contain p-2"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-secondary">
              Versão limpa só com <strong>O ORIGINAL SEU MIGNON</strong> em Azul Royal{' '}
              <code>#10388B</code> no creme <code>#F7F3EA</code>.
            </p>
          </div>

          {/* Card 2: Clean Block Logo — Red Version */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-subtle/60 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                  2. Logo Limpo — Vermelho (#CB2031)
                </span>
                <span className="rounded bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
                  The Bear Clean
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-[#F5EFE2]">
                <img
                  src={BRAND_ASSETS.logoOriginalCleanRedUrl}
                  alt="Logo O Original Seu Mignon Limpo Vermelho"
                  className="h-48 w-full object-contain p-2"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-secondary">
              Versão limpa só com <strong>O ORIGINAL SEU MIGNON</strong> em Vermelho Carmim{' '}
              <code>#CB2031</code> no creme kraft <code>#F5EFE2</code>.
            </p>
          </div>

          {/* Card 3: Circular Vintage Rubber-Stamp Badge Logo ("Chad" Bull) */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-subtle/60 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                  3. Carimbo Circular (&ldquo;Chad&rdquo;)
                </span>
                <span className="rounded bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
                  Lacre / Avatar
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-[#F5EFE2]">
                <img
                  src={BRAND_ASSETS.logoStampRedUrl}
                  alt="Logo Carimbo Circular Seu Mignon com Boizinho Debochado"
                  className="h-48 w-full object-contain p-2"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-secondary">
              Selo circular estilo carimbo com o rosto do Boizinho &ldquo;Chad&rdquo; e lenço
              vermelho <code>#CB2031</code>.
            </p>
          </div>

          {/* Card 4: Angry / Impatient Empty-Bag Bull ("Essa sacola tá muito leve...") */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-subtle/60 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                  4. Sacola Vazia (Boizinho Pistola)
                </span>
                <span className="rounded bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
                  Ativo na Sacola
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-[#F5EFE2]">
                <img
                  src={BRAND_ASSETS.mascotAngryEmptyBagUrl}
                  alt="Boizinho Seu Mignon Pistola com a Sacola Vazia"
                  className="h-56 w-full object-contain p-2"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-secondary">
              Modelo do Boizinho Chad com a pose dos punhos cerrados e dentes trincados quando a
              sacola está vazia!
            </p>
          </div>

          {/* Card 5: Full-Body Cheeky Bull Mascot — Theme A Blue Bistro */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-subtle/60 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                  5. Mascote Corpo Inteiro (Azul)
                </span>
                <button
                  type="button"
                  onClick={() => onSelectTheme('blue-bistro')}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                    activeTheme === 'blue-bistro'
                      ? 'bg-brand-primary text-white'
                      : 'border border-border bg-surface text-ink-primary'
                  }`}
                >
                  {activeTheme === 'blue-bistro' ? 'Tema Ativo' : 'Ativar Azul'}
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-[#F7F3EA]">
                <img
                  src={BRAND_ASSETS.mascotBoizinhoBlueUrl}
                  alt="Mascote Boizinho Debochado Versão Azul Royal"
                  className="h-56 w-full object-contain p-2"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-secondary">
              Boizinho anos 30 segurando o garfo trinchete como lança e a bandeja de filé mignon
              fumegante.
            </p>
          </div>

          {/* Card 6: Full-Body Cheeky Bull Mascot — Theme B Red Kraft */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-subtle/60 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                  6. Mascote Corpo Inteiro (Vermelho)
                </span>
                <button
                  type="button"
                  onClick={() => onSelectTheme('red-kraft')}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                    activeTheme === 'red-kraft'
                      ? 'bg-brand-primary text-white'
                      : 'border border-border bg-surface text-ink-primary'
                  }`}
                >
                  {activeTheme === 'red-kraft' ? 'Tema Ativo' : 'Ativar Vermelho'}
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-[#F5EFE2]">
                <img
                  src={BRAND_ASSETS.mascotBoizinhoRedUrl}
                  alt="Mascote Boizinho Debochado Versão Vermelho Kraft"
                  className="h-56 w-full object-contain p-2"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-secondary">
              Boizinho caminhando estilo caixa da <em>Paul&apos;s Boutique</em> (2 cores no papel
              kraft).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
