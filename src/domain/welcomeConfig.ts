/**
 * Easy-to-toggle configuration for the smart Welcome / Promo Popup (`WelcomePromoModal`).
 * Can be switched off (`enabled: false`) or updated with a seasonal promotion by changing `campaignId`.
 */

export interface WelcomePromoConfig {
  enabled: boolean;
  campaignId: string;
  badgeText: string;
  headline: string;
  subtitle: string;
  heroImageUrl: string;
  steps: ReadonlyArray<{
    stepNumber: string;
    title: string;
    description: string;
  }>;
  ctaLabel: string;
}

export const WELCOME_PROMO_CONFIG: WelcomePromoConfig = {
  enabled: true,
  campaignId: 'welcome-v1-3-sides',
  badgeText: 'Bem-vindo ao Seu Mignon',
  headline: 'Filé Mignon de verdade, do seu jeito.',
  subtitle:
    'Sem complicação: escolha seu corte favorito e monte seu prato com 3 acompanhamentos inclusos no preço.',
  heroImageUrl:
    'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1000&q=80',
  steps: [
    {
      stepNumber: '1',
      title: 'Escolha o prato principal',
      description: 'Cortes altos de filé mignon grelhados, empanados ou ao molho artesanal.',
    },
    {
      stepNumber: '2',
      title: 'Monte seus 3 acompanhamentos',
      description:
        'Toque nas fotos para escolher 3 porções inclusas (pode repetir o seu favorito!).',
    },
    {
      stepNumber: '3',
      title: 'Adicione extras só se quiser',
      description: 'Quer uma porção extra avulsa ou bebida? É só navegar pelas abas do cardápio.',
    },
  ],
  ctaLabel: 'Bora montar meu prato!',
};
