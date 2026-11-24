/**
 * Pure domain types strictly aligned with `seumignon-backend` OpenAPI contracts.
 * Zero React, DOM, or HTTP dependencies (`low_gear` unit-testable).
 */

export type ThemeId = 'blue-bistro' | 'red-kraft';

export interface HealthResponse {
  status: string;
  environment: string;
}

export interface ChoiceItem {
  choice_item_id: string;
  name: string;
  price_cents: number;
  enabled: boolean;
  image_url?: string;
}

export interface ChoiceGroup {
  group_id: string;
  name: string;
  min_choices: number;
  max_choices: number;
  items: ChoiceItem[];
}

export interface MenuItem {
  item_id: string;
  name: string;
  category: string;
  size: string;
  price_cents: number;
  description: string;
  image_url: string;
  choice_groups: ChoiceGroup[];
}

export interface DeliveryZone {
  zone_id: string;
  name: string;
  distance_km: number;
  fee_cents: number;
}

export interface DeliveryFeeQuoteResponse {
  cep: string;
  distance_km: number;
  fee_cents: number;
  district: string;
  source: string;
}

export type CepErrorCode = 'DeliveryOutOfRangeError' | 'CepNotFoundError' | 'InvalidCepError';

export interface MenuResponse {
  updated_at_iso: string;
  items: MenuItem[];
  delivery_zones: DeliveryZone[];
}

export interface SelectedChoiceInput {
  group_id: string;
  choice_item_id: string;
  quantity: number;
  notes?: string;
}

export interface PricedChoiceSelection {
  group_id: string;
  choice_item_id: string;
  name: string;
  price_cents: number;
  quantity: number;
  notes?: string;
}

export interface CartLineItem {
  cart_line_id: string;
  item_id: string;
  name: string;
  size: string;
  unit_price_cents: number;
  quantity: number;
  choices: PricedChoiceSelection[];
  notes: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  document_number: string;
  customer_id?: string;
}

export interface DeliveryAddressInput {
  postal_code: string;
  street_name: string;
  street_number: string;
  district: string;
  city: string;
  state: string;
  complement?: string;
  reference?: string;
  country?: string;
}

export interface OrderItemInput {
  item_id: string;
  quantity: number;
  choices: SelectedChoiceInput[];
  notes?: string;
}

export interface CreateOrderRequest {
  customer: CustomerInput;
  delivery_address: DeliveryAddressInput;
  items: OrderItemInput[];
  notes?: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'DISPATCHED' | 'CANCELLED';

export interface OrderChoiceResponse {
  choice_item_id: string;
  group_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
  notes: string;
}

export interface OrderItemResponse {
  item_id: string;
  name: string;
  size: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  choices: OrderChoiceResponse[];
  notes: string;
}

export interface OrderResponse {
  order_id: string;
  display_id: string;
  status: OrderStatus;
  created_at_iso: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  payment_link_id: string;
  checkout_url: string;
  payment_method: string;
  items: OrderItemResponse[];
  notes: string;
  user_id?: string;
}

export interface AuthRequestCodeRequest {
  email: string;
}

export interface AuthRequestCodeResponse {
  email: string;
  challenge_name: string;
  session: string;
}

export interface AuthVerifyCodeRequest {
  email: string;
  code: string;
  session: string;
}

export interface AuthVerifyCodeResponse {
  user_id: string;
  email: string;
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in_seconds: number;
}

export interface CustomerProfileAddress {
  street_name: string;
  street_number: string;
  district: string;
  city: string;
  state: string;
  postal_code: string;
  complement: string;
  reference: string;
  country: string;
}

export interface CustomerProfileResponse {
  user_id: string;
  email: string;
  name: string;
  phone: string;
  document_number: string;
  default_address: CustomerProfileAddress | null;
  updated_at_iso?: string;
}

export interface UpsertCustomerProfileRequest {
  email: string;
  name: string;
  phone: string;
  document_number: string;
  default_address: CustomerProfileAddress;
}

export interface ApiErrorEnvelope {
  error: string;
  detail: string;
}
