/**
 * Epic E2, E3, E4, E5 & E6 Full SPA Storefront & Live Order Tracking (`/orders/:orderId`).
 * Includes Smart Welcome Popup, Illustrated Brand & Mascot Assets,
 * Sticky Opaque Header & Category Tabs, Dish Cards, Sweetgreen-style 3x4 Side Selection Modal,
 * Persistent CartContext (`localStorage`), Mobile Cart Drawer + Sticky Desktop Cart Sidebar,
 * Authoritative CEP Delivery Fee Lookup (`GET /delivery-fee?cep=...`),
 * Optional Passwordless Email OTP Account (`AuthContext` + `AccountModal`),
 * Checkout Modal with Pagar.me Hosted `checkout_url` Handoff (`POST /orders`),
 * and `/orders/:orderId` live polling view (`PENDING` -> `PAID` -> `DISPATCHED` | `CANCELLED`).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { HelpCircle, Palette, ShoppingBag, User } from 'lucide-react';
import {
  WELCOME_PROMO_CONFIG,
  buildCategoryShortcuts,
  filterAndGroupMenuByShortcut,
  formatCentsToBRL,
  getCategoryShortcutLabel,
  normalizeSearchText,
  type CategoryShortcutId,
  type HealthResponse,
  type MenuItem,
  type MenuResponse,
  type OrderResponse,
  type ThemeId,
} from './domain';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider, useCart } from './contexts/CartContext';
import { apiClient, ApiClientError } from './services/api';
import { AccountModal } from './components/AccountModal';
import { BoizinhoMascot } from './components/BoizinhoMascot';
import { BrandPreviewModal } from './components/BrandPreviewModal';
import { WelcomePromoModal } from './components/WelcomePromoModal';
import { CategoryTabs } from './components/CategoryTabs';
import { DishCard } from './components/DishCard';
import { DishCustomizationModal } from './components/DishCustomizationModal';
import { CartPanel } from './components/CartPanel';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderStatusPage } from './pages/OrderStatusPage';

const THEME_STORAGE_KEY = 'seumignon:theme';
const WELCOME_SEEN_KEY_PREFIX = 'seumignon:welcome-seen:';

function getInitialTheme(): ThemeId {
  return 'red-kraft';
}

function getInitialWelcomeOpen(): boolean {
  if (!WELCOME_PROMO_CONFIG.enabled) return false;
  if (typeof window !== 'undefined') {
    try {
      const seen = window.localStorage.getItem(
        `${WELCOME_SEEN_KEY_PREFIX}${WELCOME_PROMO_CONFIG.campaignId}`,
      );
      return seen !== 'true';
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Parses `/orders/:orderId` from the current browser pathname (or returns null for `/` menu catalog).
 */
function parseOrderIdFromPath(pathname: string): string | null {
  const match = /^\/orders\/([^/]+)\/?$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

interface StorefrontContentProps {
  theme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
  health: HealthResponse | null;
  menu: MenuResponse | null;
  isLoading: boolean;
  apiError: string | null;
  orderPollIntervalMs?: number;
}

function StorefrontContent({
  theme,
  onSelectTheme,
  health,
  menu,
  isLoading,
  apiError,
  orderPollIntervalMs,
}: StorefrontContentProps) {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? parseOrderIdFromPath(window.location.pathname) : null,
  );
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(getInitialWelcomeOpen);
  const [isBrandShowcaseOpen, setIsBrandShowcaseOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [activeShortcut, setActiveShortcut] = useState<CategoryShortcutId>('ALL');
  const [selectedDishForModal, setSelectedDishForModal] = useState<MenuItem | null>(null);
  const [isMobileCartDrawerOpen, setIsMobileCartDrawerOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);

  const {
    totalCartUnits,
    cartQuantitiesByItemId,
    totalCents,
    addToCart,
    syncPolledOrderStatus,
    reorderFromOrder,
  } = useCart();

  const { isAuthenticated, profile, session } = useAuth();

  // Keep `activeOrderId` synchronized with browser Back/Forward buttons (`popstate`)
  useEffect(() => {
    function handlePopState() {
      setActiveOrderId(parseOrderIdFromPath(window.location.pathname));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToOrderStatus = useCallback((orderId: string) => {
    const trimmed = orderId.trim();
    if (!trimmed) return;
    const nextPath = `/orders/${encodeURIComponent(trimmed)}`;
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setActiveOrderId(trimmed);
  }, []);

  const navigateToCatalog = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setActiveOrderId(null);
  }, []);

  const handleReorder = useCallback(
    (order: OrderResponse) => {
      reorderFromOrder(order);
      navigateToCatalog();
    },
    [reorderFromOrder, navigateToCatalog],
  );

  function handleDismissWelcome() {
    setIsWelcomeOpen(false);
    try {
      window.localStorage.setItem(
        `${WELCOME_SEEN_KEY_PREFIX}${WELCOME_PROMO_CONFIG.campaignId}`,
        'true',
      );
    } catch {
      // Ignore storage errors
    }
  }

  const enrichedMenuItems: MenuItem[] = useMemo(() => {
    if (!menu) return [];
    const baseItems = [...menu.items];
    const hasStandaloneSidesCategory = baseItems.some((item) =>
      normalizeSearchText(item.category).includes('acompanhamento'),
    );

    if (hasStandaloneSidesCategory) {
      return baseItems;
    }

    const seenExtraIds = new Set<string>();
    const standaloneExtras: MenuItem[] = [];

    for (const item of baseItems) {
      for (const group of item.choice_groups) {
        if (group.min_choices === 0) {
          for (const extra of group.items) {
            if (extra.enabled && !seenExtraIds.has(extra.choice_item_id)) {
              seenExtraIds.add(extra.choice_item_id);
              standaloneExtras.push({
                item_id: extra.choice_item_id,
                name: extra.name,
                category: 'Acompanhamentos Extras',
                size: 'Porção Avulsa',
                price_cents: extra.price_cents,
                description: 'Porção extra preparada na hora para acompanhar seu pedido.',
                image_url: extra.image_url ?? '',
                choice_groups: [],
              });
            }
          }
        }
      }
    }

    return [...baseItems, ...standaloneExtras];
  }, [menu]);

  const categoryShortcuts = useMemo(
    () => buildCategoryShortcuts(enrichedMenuItems),
    [enrichedMenuItems],
  );

  const filteredSections = useMemo(
    () => filterAndGroupMenuByShortcut(enrichedMenuItems, activeShortcut, ''),
    [enrichedMenuItems, activeShortcut],
  );

  const accountButtonLabel = isAuthenticated
    ? profile?.name?.trim().split(' ')[0] || session?.email.split('@')[0] || 'Minha Conta'
    : 'Entrar / Cadastrar';

  return (
    <div className="min-h-screen bg-canvas pb-28 text-ink-primary lg:pb-12">
      {/* Smart Welcome / Promo Popup (Touchpoint #1 of the Cheeky Bull Mascot — Only on Catalog Route) */}
      {!activeOrderId && (
        <WelcomePromoModal
          config={WELCOME_PROMO_CONFIG}
          theme={theme}
          isOpen={isWelcomeOpen}
          onClose={handleDismissWelcome}
        />
      )}

      {/* Brand & Mascot Showcase Modal */}
      <BrandPreviewModal
        isOpen={isBrandShowcaseOpen}
        onClose={() => setIsBrandShowcaseOpen(false)}
        activeTheme={theme}
        onSelectTheme={onSelectTheme}
      />

      {/* Optional Passwordless Email OTP Account, Profile & Cloud Order History Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onTrackOrder={navigateToOrderStatus}
        onReorder={handleReorder}
      />

      {/* Sticky Top Header — Solid Opaque bg-surface so scrolling content never bleeds through */}
      <header className="sticky top-0 z-30 h-[68px] border-b border-border bg-surface shadow-2xs">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-4">
          <button
            type="button"
            onClick={() => {
              if (activeOrderId) {
                navigateToCatalog();
              } else {
                setIsBrandShowcaseOpen(true);
              }
            }}
            title="Clique para voltar ao cardápio ou ampliar os Logos e Mascote"
            className="group flex items-center gap-3 text-left"
          >
            {/* Touchpoint #2: Real Illustrated Circular Stamp Emblem of the Cheeky Bull */}
            <BoizinhoMascot
              theme={theme}
              variant="stamp"
              className="h-12 w-12 shrink-0 transition group-hover:scale-105"
            />
            <div>
              <span className="block font-display text-xl font-bold uppercase leading-none tracking-tight text-brand-primary sm:text-2xl">
                SEU MIGNON
              </span>
              <span className="mt-0.5 block text-[11px] font-medium text-ink-secondary">
                Carnes nobres &bull; 3 acompanhamentos inclusos
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="account-modal-trigger"
              onClick={() => setIsAccountModalOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                isAuthenticated
                  ? 'border-status-success/40 bg-status-success/10 text-status-success hover:bg-status-success hover:text-white'
                  : 'border-brand-primary/30 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>{accountButtonLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBrandShowcaseOpen(true)}
              className="hidden items-center gap-1.5 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-bold text-brand-primary transition hover:bg-brand-primary hover:text-white md:inline-flex"
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Ver Logos &amp; Mascote</span>
            </button>

            <button
              type="button"
              onClick={() => setIsWelcomeOpen(true)}
              className="hidden items-center gap-1 rounded-full border border-border bg-subtle px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:text-ink-primary lg:inline-flex"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Como funciona</span>
            </button>
          </div>
        </div>
      </header>

      {/* Route View 1: Epic E4 Live Order Status Page (/orders/:orderId) */}
      {activeOrderId ? (
        <main>
          <OrderStatusPage
            orderId={activeOrderId}
            theme={theme}
            onBackToMenu={navigateToCatalog}
            onOrderUpdated={syncPolledOrderStatus}
            onReorder={handleReorder}
            pollIntervalMs={orderPollIntervalMs}
          />
        </main>
      ) : (
        /* Route View 2: Main Menu Catalog + Sticky Cart Sidebar + Checkout */
        <>
          {enrichedMenuItems.length > 0 && (
            <CategoryTabs
              shortcuts={categoryShortcuts}
              totalItemsCount={enrichedMenuItems.length}
              activeShortcut={activeShortcut}
              onSelectShortcut={setActiveShortcut}
            />
          )}

          <main className="mx-auto max-w-6xl px-4 pt-6">
            {isLoading && (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-ink-secondary">
                Carregando o cardápio do Seu Mignon...
              </div>
            )}

            {!isLoading && apiError && (
              <div
                role="alert"
                className="rounded-2xl border border-status-error/30 bg-surface p-6 text-sm text-status-error"
              >
                {apiError}
              </div>
            )}

            {!isLoading && menu && (
              <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
                {/* Left 2 Columns: Categorized Horizontal Dish Cards */}
                <div className="space-y-8 lg:col-span-2">
                  {filteredSections.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                      <p className="text-sm font-semibold text-ink-primary">
                        Ainda não há itens cadastrados em {getCategoryShortcutLabel(activeShortcut)}{' '}
                        neste momento.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveShortcut('ALL')}
                        className="mt-3 rounded-full bg-brand-primary px-4 py-1.5 text-xs font-bold text-white"
                      >
                        Ver cardápio completo
                      </button>
                    </div>
                  ) : (
                    filteredSections.map((section) => (
                      <section key={section.categoryName} aria-label={section.categoryName}>
                        <div className="mb-3 flex items-baseline justify-between">
                          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-ink-primary">
                            {section.categoryName}
                          </h2>
                          <span className="text-xs font-medium text-ink-secondary">
                            {section.items.length} {section.items.length === 1 ? 'opção' : 'opções'}
                          </span>
                        </div>

                        <div className="grid gap-3.5 sm:grid-cols-2">
                          {section.items.map((item) => (
                            <DishCard
                              key={item.item_id}
                              item={item}
                              cartQuantity={cartQuantitiesByItemId[item.item_id] ?? 0}
                              onSelectDish={(dish) => setSelectedDishForModal(dish)}
                            />
                          ))}
                        </div>
                      </section>
                    ))
                  )}
                </div>

                {/* Right Column: Sticky Cart Sidebar with Authoritative CEP Delivery Fee Selector */}
                <aside
                  aria-label="Sua Sacola"
                  className="sticky top-[135px] rounded-2xl border border-border bg-surface p-5 shadow-xs"
                >
                  <CartPanel
                    theme={theme}
                    health={health}
                    onProceedToCheckout={() => setIsCheckoutModalOpen(true)}
                    onTrackOrder={navigateToOrderStatus}
                    idPrefix="desktop-cart"
                  />
                </aside>
              </div>
            )}
          </main>

          {/* Mobile Sticky Bottom Cart Bar (< 1024px) */}
          {totalCartUnits > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface p-3 shadow-2xl lg:hidden">
              <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsMobileCartDrawerOpen(true)}
                  className="flex flex-1 items-center justify-between rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white shadow-md"
                >
                  <span className="inline-flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    <span>
                      Ver sacola ({totalCartUnits} {totalCartUnits === 1 ? 'item' : 'itens'})
                    </span>
                  </span>
                  <span>{formatCentsToBRL(totalCents)}</span>
                </button>
              </div>
            </div>
          )}

          {/* Mobile Slide-Over Cart Drawer */}
          {isMobileCartDrawerOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Sacola de compras"
              className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-xs lg:hidden"
              onClick={() => setIsMobileCartDrawerOpen(false)}
            >
              <div
                className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <CartPanel
                  theme={theme}
                  health={health}
                  idPrefix="mobile-cart"
                  onCloseDrawer={() => setIsMobileCartDrawerOpen(false)}
                  onTrackOrder={(orderId) => {
                    setIsMobileCartDrawerOpen(false);
                    navigateToOrderStatus(orderId);
                  }}
                  onProceedToCheckout={() => {
                    setIsMobileCartDrawerOpen(false);
                    setIsCheckoutModalOpen(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* Sweetgreen + Foodpanda Meal Assembly Modal (3 Included Sides in 3x4 Photo Grid) */}
          <DishCustomizationModal
            dish={selectedDishForModal}
            onClose={() => setSelectedDishForModal(null)}
            onConfirmAddToCart={addToCart}
          />

          {/* Epic E3 + E5 + E6 Checkout & Pagar.me Hosted Payment Link Modal */}
          <CheckoutModal
            isOpen={isCheckoutModalOpen}
            onClose={() => setIsCheckoutModalOpen(false)}
            onNavigateToOrderStatus={navigateToOrderStatus}
          />
        </>
      )}
    </div>
  );
}

function CartAwareAuthProvider({ children }: { children: ReactNode }) {
  const { prefillFromCustomerProfile } = useCart();
  return <AuthProvider onProfileLoaded={prefillFromCustomerProfile}>{children}</AuthProvider>;
}

export interface AppProps {
  orderPollIntervalMs?: number;
}

export function App({ orderPollIntervalMs }: AppProps = {}) {
  const [theme, setTheme] = useState<ThemeId>(getInitialTheme);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBootstrapData() {
      setIsLoading(true);
      setApiError(null);
      try {
        const [healthRes, menuRes] = await Promise.all([
          apiClient.getHealth(controller.signal),
          apiClient.getMenu(controller.signal),
        ]);
        setHealth(healthRes);
        setMenu(menuRes);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        if (err instanceof ApiClientError) {
          setApiError(err.detail);
        } else {
          setApiError('Não foi possível carregar o cardápio agora.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadBootstrapData();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <CartProvider>
      <CartAwareAuthProvider>
        <StorefrontContent
          theme={theme}
          onSelectTheme={setTheme}
          health={health}
          menu={menu}
          isLoading={isLoading}
          apiError={apiError}
          orderPollIntervalMs={orderPollIntervalMs}
        />
      </CartAwareAuthProvider>
    </CartProvider>
  );
}

export default App;
