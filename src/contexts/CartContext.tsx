/**
 * Global Cart, Delivery Zone, Checkout Draft & Recent Orders Context (`CartContext`).
 * Persists state in `localStorage` and computes all monetary totals strictly in integer centavos.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  INITIAL_CHECKOUT_FORM_DRAFT,
  calculateCartSubtotalCents,
  calculateOrderTotalCents,
  findDeliveryZoneById,
  upsertRecentOrderList,
  type CartLineItem,
  type CheckoutFormDraft,
  type DeliveryZone,
  type MenuItem,
  type OrderResponse,
  type PricedChoiceSelection,
  type StoredRecentOrder,
} from '../domain';

export const CART_STORAGE_KEY = 'seumignon:cart:v1';
export const ZONE_STORAGE_KEY = 'seumignon:selected-zone:v1';
export const CHECKOUT_DRAFT_STORAGE_KEY = 'seumignon:checkout-draft:v1';
export const RECENT_ORDERS_STORAGE_KEY = 'seumignon:recent-orders:v1';

interface AddToCartParams {
  dish: MenuItem;
  quantity: number;
  choices: PricedChoiceSelection[];
  notes: string;
}

export interface CartContextValue {
  cartItems: CartLineItem[];
  totalCartUnits: number;
  cartQuantitiesByItemId: Record<string, number>;
  selectedZoneId: string;
  selectedZone: DeliveryZone | undefined;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  checkoutDraft: CheckoutFormDraft;
  recentOrders: StoredRecentOrder[];
  addToCart: (params: AddToCartParams) => void;
  updateLineQuantity: (cartLineId: string, delta: number) => void;
  removeLine: (cartLineId: string) => void;
  clearCart: () => void;
  selectZone: (zoneId: string) => void;
  updateCheckoutDraft: (patch: Partial<CheckoutFormDraft>) => void;
  recordCreatedOrder: (order: OrderResponse) => void;
  syncPolledOrderStatus: (order: OrderResponse) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartLineItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as CartLineItem[];
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

function readStoredZoneId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ZONE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function readStoredCheckoutDraft(initialZoneId: string): CheckoutFormDraft {
  if (typeof window === 'undefined') {
    return { ...INITIAL_CHECKOUT_FORM_DRAFT, zoneId: initialZoneId };
  }
  try {
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CheckoutFormDraft>;
      return {
        ...INITIAL_CHECKOUT_FORM_DRAFT,
        ...parsed,
        zoneId: initialZoneId || parsed.zoneId || '',
      };
    }
  } catch {
    // Ignore storage errors
  }
  return { ...INITIAL_CHECKOUT_FORM_DRAFT, zoneId: initialZoneId };
}

function readStoredRecentOrders(): StoredRecentOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as StoredRecentOrder[];
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

interface CartProviderProps {
  deliveryZones: ReadonlyArray<DeliveryZone>;
  children: ReactNode;
}

export function CartProvider({ deliveryZones, children }: CartProviderProps) {
  const [cartItems, setCartItems] = useState<CartLineItem[]>(readStoredCart);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(readStoredZoneId);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutFormDraft>(() =>
    readStoredCheckoutDraft(readStoredZoneId()),
  );
  const [recentOrders, setRecentOrders] = useState<StoredRecentOrder[]>(readStoredRecentOrders);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // Ignore storage errors
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ZONE_STORAGE_KEY, selectedZoneId);
    } catch {
      // Ignore storage errors
    }
  }, [selectedZoneId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(checkoutDraft));
    } catch {
      // Ignore storage errors
    }
  }, [checkoutDraft]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify(recentOrders));
    } catch {
      // Ignore storage errors
    }
  }, [recentOrders]);

  const selectedZone = useMemo(
    () => findDeliveryZoneById(deliveryZones, selectedZoneId),
    [deliveryZones, selectedZoneId],
  );

  const subtotalCents = useMemo(() => calculateCartSubtotalCents(cartItems), [cartItems]);
  const deliveryFeeCents = selectedZone ? selectedZone.fee_cents : 0;
  const totalCents = useMemo(
    () =>
      calculateOrderTotalCents({
        subtotalCents,
        deliveryFeeCents,
      }),
    [subtotalCents, deliveryFeeCents],
  );

  const totalCartUnits = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const cartQuantitiesByItemId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of cartItems) {
      map[line.item_id] = (map[line.item_id] ?? 0) + line.quantity;
    }
    return map;
  }, [cartItems]);

  const addToCart = useCallback((params: AddToCartParams) => {
    const newLine: CartLineItem = {
      cart_line_id: `${params.dish.item_id}-${String(Date.now())}-${Math.random().toString(36).slice(2, 6)}`,
      item_id: params.dish.item_id,
      name: params.dish.name,
      size: params.dish.size,
      unit_price_cents: params.dish.price_cents,
      quantity: params.quantity,
      choices: params.choices,
      notes: params.notes,
    };
    setCartItems((prev) => [...prev, newLine]);
  }, []);

  const updateLineQuantity = useCallback((cartLineId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((line) => {
          if (line.cart_line_id !== cartLineId) return line;
          const nextQty = line.quantity + delta;
          return nextQty > 0 ? { ...line, quantity: nextQty } : null;
        })
        .filter((line): line is CartLineItem => line !== null),
    );
  }, []);

  const removeLine = useCallback((cartLineId: string) => {
    setCartItems((prev) => prev.filter((line) => line.cart_line_id !== cartLineId));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const selectZone = useCallback((zoneId: string) => {
    setSelectedZoneId(zoneId);
    setCheckoutDraft((prev) => ({ ...prev, zoneId }));
  }, []);

  const updateCheckoutDraft = useCallback((patch: Partial<CheckoutFormDraft>) => {
    setCheckoutDraft((prev) => {
      const next = { ...prev, ...patch };
      if (patch.zoneId !== undefined) {
        setSelectedZoneId(patch.zoneId);
      }
      return next;
    });
  }, []);

  const recordCreatedOrder = useCallback((order: OrderResponse) => {
    setRecentOrders((prev) => upsertRecentOrderList(prev, order));
    setCartItems([]);
  }, []);

  const syncPolledOrderStatus = useCallback((order: OrderResponse) => {
    setRecentOrders((prev) => upsertRecentOrderList(prev, order));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cartItems,
      totalCartUnits,
      cartQuantitiesByItemId,
      selectedZoneId,
      selectedZone,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      checkoutDraft,
      recentOrders,
      addToCart,
      updateLineQuantity,
      removeLine,
      clearCart,
      selectZone,
      updateCheckoutDraft,
      recordCreatedOrder,
      syncPolledOrderStatus,
    }),
    [
      cartItems,
      totalCartUnits,
      cartQuantitiesByItemId,
      selectedZoneId,
      selectedZone,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      checkoutDraft,
      recentOrders,
      addToCart,
      updateLineQuantity,
      removeLine,
      clearCart,
      selectZone,
      updateCheckoutDraft,
      recordCreatedOrder,
      syncPolledOrderStatus,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider.');
  }
  return ctx;
}
