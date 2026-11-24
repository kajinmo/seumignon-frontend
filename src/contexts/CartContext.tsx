/**
 * Global Cart, Authoritative CEP Delivery Quote, Checkout Draft & Recent Orders Context (`CartContext`).
 * Persists state in `localStorage` and computes all display subtotals strictly in integer centavos.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  INITIAL_CHECKOUT_FORM_DRAFT,
  calculateCartSubtotalCents,
  calculateOrderTotalCents,
  formatCepInput,
  formatCpfInput,
  getFriendlyCepErrorMessage,
  isCompleteCep,
  stripNonDigits,
  upsertRecentOrderList,
  type CartLineItem,
  type CheckoutFormDraft,
  type CustomerProfileResponse,
  type DeliveryFeeQuoteResponse,
  type MenuItem,
  type OrderResponse,
  type PricedChoiceSelection,
  type StoredRecentOrder,
} from '../domain';
import { ApiClientError, apiClient, lookupCepAddressPublic } from '../services/api';

export const CART_STORAGE_KEY = 'seumignon:cart:v1';
export const DELIVERY_QUOTE_STORAGE_KEY = 'seumignon:delivery-quote:v1';
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
  deliveryQuote: DeliveryFeeQuoteResponse | null;
  isQuotingCep: boolean;
  cepQuoteError: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  checkoutDraft: CheckoutFormDraft;
  recentOrders: StoredRecentOrder[];
  addToCart: (params: AddToCartParams) => void;
  updateLineQuantity: (cartLineId: string, delta: number) => void;
  removeLine: (cartLineId: string) => void;
  clearCart: () => void;
  quoteDeliveryByCep: (rawCep: string) => Promise<DeliveryFeeQuoteResponse | null>;
  clearDeliveryQuote: () => void;
  updateCheckoutDraft: (patch: Partial<CheckoutFormDraft>) => void;
  prefillFromCustomerProfile: (profile: CustomerProfileResponse) => void;
  clearPersonalData: () => void;
  recordCreatedOrder: (order: OrderResponse) => void;
  syncPolledOrderStatus: (order: OrderResponse) => void;
  reorderFromOrder: (order: OrderResponse) => void;
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

function readStoredDeliveryQuote(): DeliveryFeeQuoteResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DELIVERY_QUOTE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeliveryFeeQuoteResponse>;
      if (
        typeof parsed.cep === 'string' &&
        typeof parsed.fee_cents === 'number' &&
        Number.isInteger(parsed.fee_cents)
      ) {
        return {
          cep: parsed.cep,
          distance_km: typeof parsed.distance_km === 'number' ? parsed.distance_km : 0,
          fee_cents: parsed.fee_cents,
          district: typeof parsed.district === 'string' ? parsed.district : '',
          source: typeof parsed.source === 'string' ? parsed.source : 'local_index',
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function readStoredCheckoutDraft(initialQuote: DeliveryFeeQuoteResponse | null): CheckoutFormDraft {
  if (typeof window === 'undefined') {
    return {
      ...INITIAL_CHECKOUT_FORM_DRAFT,
      postalCode: initialQuote ? formatCepInput(initialQuote.cep) : '',
      district: initialQuote?.district ?? '',
    };
  }
  try {
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CheckoutFormDraft>;
      return {
        ...INITIAL_CHECKOUT_FORM_DRAFT,
        ...parsed,
        postalCode: parsed.postalCode || (initialQuote ? formatCepInput(initialQuote.cep) : ''),
        documentNumber: parsed.documentNumber ? formatCpfInput(parsed.documentNumber) : '',
        district: parsed.district || initialQuote?.district || '',
      };
    }
  } catch {
    // Ignore storage errors
  }
  return {
    ...INITIAL_CHECKOUT_FORM_DRAFT,
    postalCode: initialQuote ? formatCepInput(initialQuote.cep) : '',
    district: initialQuote?.district ?? '',
  };
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
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [cartItems, setCartItems] = useState<CartLineItem[]>(readStoredCart);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryFeeQuoteResponse | null>(
    readStoredDeliveryQuote,
  );
  const [isQuotingCep, setIsQuotingCep] = useState<boolean>(false);
  const [cepQuoteError, setCepQuoteError] = useState<string | null>(null);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutFormDraft>(() =>
    readStoredCheckoutDraft(readStoredDeliveryQuote()),
  );
  const [recentOrders, setRecentOrders] = useState<StoredRecentOrder[]>(readStoredRecentOrders);

  const cepQuoteAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      cepQuoteAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // Ignore storage errors
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      if (deliveryQuote) {
        window.localStorage.setItem(DELIVERY_QUOTE_STORAGE_KEY, JSON.stringify(deliveryQuote));
      } else {
        window.localStorage.removeItem(DELIVERY_QUOTE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [deliveryQuote]);

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

  const subtotalCents = useMemo(() => calculateCartSubtotalCents(cartItems), [cartItems]);
  const deliveryFeeCents = deliveryQuote ? deliveryQuote.fee_cents : 0;
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

  const clearDeliveryQuote = useCallback(() => {
    cepQuoteAbortRef.current?.abort();
    setDeliveryQuote(null);
    setCepQuoteError(null);
    setIsQuotingCep(false);
  }, []);

  const updateCheckoutDraft = useCallback(
    (patch: Partial<CheckoutFormDraft>) => {
      const formattedPostal =
        patch.postalCode !== undefined ? formatCepInput(patch.postalCode) : undefined;
      const formattedDocument =
        patch.documentNumber !== undefined ? formatCpfInput(patch.documentNumber) : undefined;

      setCheckoutDraft((prev) => {
        const cepChanged =
          formattedPostal !== undefined &&
          stripNonDigits(prev.postalCode) !== stripNonDigits(formattedPostal);
        const isIncomplete =
          formattedPostal !== undefined && stripNonDigits(formattedPostal).length < 8;

        return {
          ...prev,
          ...patch,
          ...(formattedPostal !== undefined ? { postalCode: formattedPostal } : {}),
          ...(formattedDocument !== undefined ? { documentNumber: formattedDocument } : {}),
          ...(cepChanged && isIncomplete ? { streetName: '', district: '' } : {}),
        };
      });

      if (formattedPostal !== undefined) {
        const nextPostalDigits = stripNonDigits(formattedPostal);
        setCepQuoteError(null);
        if (deliveryQuote && stripNonDigits(deliveryQuote.cep) !== nextPostalDigits) {
          setDeliveryQuote(null);
        }
      }
    },
    [deliveryQuote],
  );

  const quoteDeliveryByCep = useCallback(
    async (rawCep: string): Promise<DeliveryFeeQuoteResponse | null> => {
      const digits = stripNonDigits(rawCep);
      const formatted = formatCepInput(digits);

      setCheckoutDraft((prev) =>
        prev.postalCode === formatted ? prev : { ...prev, postalCode: formatted },
      );

      if (!isCompleteCep(digits)) {
        cepQuoteAbortRef.current?.abort();
        setDeliveryQuote(null);
        setIsQuotingCep(false);
        setCepQuoteError('Informe um CEP válido com 8 dígitos (ex.: 03195-000).');
        return null;
      }

      cepQuoteAbortRef.current?.abort();
      const controller = new AbortController();
      cepQuoteAbortRef.current = controller;

      setIsQuotingCep(true);
      setCepQuoteError(null);

      // Fire optional ViaCEP address enrichment concurrently so it never blocks authoritative backend quote
      void lookupCepAddressPublic(digits, controller.signal).then((publicAddress) => {
        if (controller.signal.aborted || !publicAddress) return;
        setCheckoutDraft((prev) => {
          if (stripNonDigits(prev.postalCode) !== digits) {
            return prev;
          }
          return {
            ...prev,
            streetName: publicAddress.streetName || prev.streetName,
            district: publicAddress.district || prev.district,
          };
        });
      });

      try {
        const quote = await apiClient.getDeliveryFee(formatted, controller.signal);
        if (controller.signal.aborted) {
          return null;
        }
        setDeliveryQuote(quote);
        setCheckoutDraft((prev) => ({
          ...prev,
          postalCode: formatCepInput(quote.cep),
          district: quote.district.trim() || prev.district,
        }));
        return quote;
      } catch (err) {
        if (controller.signal.aborted) {
          return null;
        }
        setDeliveryQuote(null);
        if (err instanceof ApiClientError) {
          setCepQuoteError(getFriendlyCepErrorMessage(err.errorCode, err.detail));
        } else {
          setCepQuoteError('Não foi possível consultar o frete para este CEP agora.');
        }
        return null;
      } finally {
        if (!controller.signal.aborted) {
          setIsQuotingCep(false);
        }
      }
    },
    [],
  );

  const prefillFromCustomerProfile = useCallback(
    (profile: CustomerProfileResponse) => {
      const addr = profile.default_address;
      setCheckoutDraft((prev) => ({
        ...prev,
        name: prev.name.trim() || profile.name || '',
        phone: prev.phone.trim() || profile.phone || '',
        email: prev.email.trim() || profile.email || '',
        documentNumber:
          prev.documentNumber.trim() ||
          (profile.document_number ? formatCpfInput(profile.document_number) : ''),
        postalCode:
          prev.postalCode.trim() || (addr?.postal_code ? formatCepInput(addr.postal_code) : ''),
        streetName: prev.streetName.trim() || addr?.street_name || '',
        streetNumber: prev.streetNumber.trim() || addr?.street_number || '',
        district: prev.district.trim() || addr?.district || '',
        complement: prev.complement.trim() || addr?.complement || '',
        reference: prev.reference.trim() || addr?.reference || '',
      }));

      const savedCep = addr?.postal_code ?? '';
      if (isCompleteCep(savedCep) && !deliveryQuote) {
        void quoteDeliveryByCep(savedCep);
      }
    },
    [deliveryQuote, quoteDeliveryByCep],
  );

  const clearPersonalData = useCallback(() => {
    cepQuoteAbortRef.current?.abort();
    setCheckoutDraft(INITIAL_CHECKOUT_FORM_DRAFT);
    setDeliveryQuote(null);
    setCepQuoteError(null);
    setRecentOrders([]);
    try {
      window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      window.localStorage.removeItem(DELIVERY_QUOTE_STORAGE_KEY);
      window.localStorage.removeItem(RECENT_ORDERS_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const recordCreatedOrder = useCallback((order: OrderResponse) => {
    setRecentOrders((prev) => upsertRecentOrderList(prev, order));
    setCartItems([]);
  }, []);

  const syncPolledOrderStatus = useCallback((order: OrderResponse) => {
    setRecentOrders((prev) => upsertRecentOrderList(prev, order));
  }, []);

  const reorderFromOrder = useCallback((order: OrderResponse) => {
    if (!order.items || order.items.length === 0) return;
    const restoredLines: CartLineItem[] = order.items.map((item, index) => ({
      cart_line_id: `${item.item_id}-${String(Date.now())}-${String(index)}`,
      item_id: item.item_id,
      name: item.name,
      size: item.size,
      unit_price_cents: item.unit_price_cents,
      quantity: item.quantity,
      choices: item.choices.map((c) => ({
        group_id: c.group_id,
        choice_item_id: c.choice_item_id,
        name: c.name,
        price_cents: c.unit_price_cents,
        quantity: c.quantity,
        notes: c.notes,
      })),
      notes: item.notes,
    }));
    setCartItems(restoredLines);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cartItems,
      totalCartUnits,
      cartQuantitiesByItemId,
      deliveryQuote,
      isQuotingCep,
      cepQuoteError,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      checkoutDraft,
      recentOrders,
      addToCart,
      updateLineQuantity,
      removeLine,
      clearCart,
      quoteDeliveryByCep,
      clearDeliveryQuote,
      updateCheckoutDraft,
      prefillFromCustomerProfile,
      clearPersonalData,
      recordCreatedOrder,
      syncPolledOrderStatus,
      reorderFromOrder,
    }),
    [
      cartItems,
      totalCartUnits,
      cartQuantitiesByItemId,
      deliveryQuote,
      isQuotingCep,
      cepQuoteError,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      checkoutDraft,
      recentOrders,
      addToCart,
      updateLineQuantity,
      removeLine,
      clearCart,
      quoteDeliveryByCep,
      clearDeliveryQuote,
      updateCheckoutDraft,
      prefillFromCustomerProfile,
      clearPersonalData,
      recordCreatedOrder,
      syncPolledOrderStatus,
      reorderFromOrder,
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
