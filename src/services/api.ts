/**
 * Isolated HTTP client communicating exclusively with `seumignon-backend` via `VITE_API_BASE_URL`.
 * Normalizes backend `{ error, detail }` error responses into typed `ApiClientError` instances.
 */

import type {
  ApiErrorEnvelope,
  CreateOrderRequest,
  HealthResponse,
  MenuResponse,
  OrderResponse,
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

  public async createOrder(
    payload: CreateOrderRequest,
    signal?: AbortSignal,
  ): Promise<OrderResponse> {
    return this.request<OrderResponse>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
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

export const apiClient = new SeuMignonApiClient();
