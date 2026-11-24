/**
 * Isolated HTTP client communicating exclusively with `seumignon-backend` via `VITE_API_BASE_URL`.
 * Normalizes backend `{ error, detail }` error responses into typed `ApiClientError` instances.
 */

import {
  formatCepInput,
  stripNonDigits,
  type ApiErrorEnvelope,
  type AuthRequestCodeResponse,
  type AuthVerifyCodeRequest,
  type AuthVerifyCodeResponse,
  type CreateOrderRequest,
  type CustomerProfileResponse,
  type DeliveryFeeQuoteResponse,
  type HealthResponse,
  type MenuResponse,
  type OrderResponse,
  type UpsertCustomerProfileRequest,
} from '../domain';

const DEFAULT_API_BASE_URL = 'https://p9joemg5dj.execute-api.us-east-1.amazonaws.com';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly errorCode: string;
  public readonly detail: string;

  constructor(params: { status: number; errorCode: string; detail: string }) {
    super(params.detail);
    this.name = 'ApiClientError';
    this.status = params.status;
    this.errorCode = params.errorCode;
    this.detail = params.detail;
  }
}

/**
 * Resolves and normalizes the backend base URL (stripping trailing slashes).
 */
export function resolveApiBaseUrl(overrideBaseUrl?: string): string {
  const raw =
    overrideBaseUrl ??
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
      ? String(import.meta.env.VITE_API_BASE_URL)
      : DEFAULT_API_BASE_URL);

  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_API_BASE_URL;
}

export interface SeuMignonApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class SeuMignonApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SeuMignonApiClientOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async getHealth(signal?: AbortSignal): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health', { method: 'GET', signal });
  }

  public async getMenu(signal?: AbortSignal): Promise<MenuResponse> {
    return this.request<MenuResponse>('/menu', { method: 'GET', signal });
  }

  public async getDeliveryFee(
    cep: string,
    signal?: AbortSignal,
  ): Promise<DeliveryFeeQuoteResponse> {
    const digits = stripNonDigits(cep);
    if (digits.length !== 8) {
      throw new ApiClientError({
        status: 422,
        errorCode: 'InvalidCepError',
        detail: 'Informe um CEP válido com 8 dígitos (ex.: 03195-000).',
      });
    }
    const formatted = formatCepInput(digits);
    return this.request<DeliveryFeeQuoteResponse>(
      `/delivery-fee?cep=${encodeURIComponent(formatted)}`,
      { method: 'GET', signal },
    );
  }

  public async createOrder(
    payload: CreateOrderRequest,
    options?: { accessToken?: string | null; signal?: AbortSignal },
  ): Promise<OrderResponse> {
    const headers: Record<string, string> = {};
    const token = options?.accessToken?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return this.request<OrderResponse>('/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: options?.signal,
    });
  }

  public async getOrder(orderId: string, signal?: AbortSignal): Promise<OrderResponse> {
    const trimmedId = orderId.trim();
    if (!trimmedId) {
      throw new ApiClientError({
        status: 400,
        errorCode: 'InvalidOrderId',
        detail: 'Identificador do pedido inválido.',
      });
    }
    return this.request<OrderResponse>(`/orders/${encodeURIComponent(trimmedId)}`, {
      method: 'GET',
      signal,
    });
  }

  public async requestAuthCode(
    email: string,
    options?: { createIfMissing?: boolean; signal?: AbortSignal },
  ): Promise<AuthRequestCodeResponse> {
    return this.request<AuthRequestCodeResponse>('/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        create_if_missing: options?.createIfMissing ?? false,
      }),
      signal: options?.signal,
    });
  }

  public async verifyAuthCode(
    payload: AuthVerifyCodeRequest,
    signal?: AbortSignal,
  ): Promise<AuthVerifyCodeResponse> {
    return this.request<AuthVerifyCodeResponse>('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email.trim().toLowerCase(),
        code: payload.code.trim(),
        session: payload.session,
      }),
      signal,
    });
  }

  public async getMyProfile(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<CustomerProfileResponse> {
    return this.request<CustomerProfileResponse>('/me/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });
  }

  public async updateMyProfile(
    accessToken: string,
    payload: UpsertCustomerProfileRequest,
    signal?: AbortSignal,
  ): Promise<CustomerProfileResponse> {
    return this.request<CustomerProfileResponse>('/me/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
  }

  public async getMyOrders(accessToken: string, signal?: AbortSignal): Promise<OrderResponse[]> {
    return this.request<OrderResponse[]>('/me/orders', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers,
      });
    } catch (networkError) {
      const fallbackMessage =
        networkError instanceof Error ? networkError.message : 'Falha de conexão com o servidor.';
      throw new ApiClientError({
        status: 0,
        errorCode: 'NetworkError',
        detail: `Não foi possível conectar ao servidor do Seu Mignon (${fallbackMessage}).`,
      });
    }

    if (!response.ok) {
      const envelope = await this.parseErrorEnvelope(response);
      throw new ApiClientError({
        status: response.status,
        errorCode: envelope.error,
        detail: envelope.detail,
      });
    }

    return (await response.json()) as T;
  }

  private async parseErrorEnvelope(response: Response): Promise<ApiErrorEnvelope> {
    try {
      const payload = (await response.json()) as Partial<ApiErrorEnvelope> & {
        detail?: unknown;
      };

      const errorCode =
        typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : `HTTP_${String(response.status)}`;

      if (typeof payload?.detail === 'string' && payload.detail.trim()) {
        return {
          error: errorCode,
          detail: payload.detail.trim(),
        };
      }

      if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
        const firstIssue = payload.detail[0] as { msg?: string };
        return {
          error: 'RequestValidationError',
          detail:
            typeof firstIssue?.msg === 'string'
              ? firstIssue.msg
              : `Erro de validação (HTTP ${String(response.status)}).`,
        };
      }
    } catch {
      // Fallback when response body is not valid JSON
    }

    return {
      error: `HTTP_${String(response.status)}`,
      detail: `Erro inesperado na comunicação com o servidor (HTTP ${String(response.status)}).`,
    };
  }
}

export interface PublicCepLookupResult {
  streetName?: string;
  district?: string;
  city?: string;
  state?: string;
}

/**
 * Best-effort public CEP lookup via ViaCEP for street/district autofill only.
 * Never used as delivery fee authority (delivery fee always comes from `GET /delivery-fee`).
 */
export async function lookupCepAddressPublic(
  cep: string,
  signal?: AbortSignal,
): Promise<PublicCepLookupResult | null> {
  const digits = stripNonDigits(cep);
  if (digits.length !== 8) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 3000);
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (data.erro) {
      return null;
    }
    return {
      streetName: data.logradouro?.trim() || undefined,
      district: data.bairro?.trim() || undefined,
      city: data.localidade?.trim() || undefined,
      state: data.uf?.trim() || undefined,
    };
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

export const apiClient = new SeuMignonApiClient();
