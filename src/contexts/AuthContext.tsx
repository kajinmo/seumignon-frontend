/**
 * Optional Customer Passwordless Email OTP Context (`AuthContext.tsx`).
 *
 * Guardrails:
 * 1. Guest Checkout remains 100% functional when unauthenticated.
 * 2. Stores `access_token` (used in `Authorization: Bearer <access_token>`) in `localStorage`.
 * 3. Automatically clears stale sessions on `401 Unauthorized` without blocking checkout.
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
import type {
  AuthRequestCodeResponse,
  AuthVerifyCodeResponse,
  CustomerProfileResponse,
  UpsertCustomerProfileRequest,
} from '../domain';
import { ApiClientError, apiClient } from '../services/api';

export const AUTH_SESSION_STORAGE_KEY = 'seumignon:auth-session:v1';

export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAtMs: number;
}

export interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  profile: CustomerProfileResponse | null;
  isLoadingProfile: boolean;
  authNotice: string | null;
  clearAuthNotice: () => void;
  requestOtpCode: (email: string) => Promise<AuthRequestCodeResponse>;
  verifyOtpCode: (params: {
    email: string;
    code: string;
    challengeSession: string;
  }) => Promise<AuthVerifyCodeResponse>;
  refreshProfile: () => Promise<CustomerProfileResponse | null>;
  saveProfile: (payload: UpsertCustomerProfileRequest) => Promise<CustomerProfileResponse>;
  handleUnauthorized: (customNotice?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken === 'string' &&
      parsed.accessToken.trim() &&
      typeof parsed.email === 'string' &&
      typeof parsed.expiresAtMs === 'number' &&
      parsed.expiresAtMs > Date.now()
    ) {
      return {
        userId: typeof parsed.userId === 'string' ? parsed.userId : '',
        email: parsed.email,
        accessToken: parsed.accessToken,
        idToken: typeof parsed.idToken === 'string' ? parsed.idToken : '',
        refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : '',
        expiresAtMs: parsed.expiresAtMs,
      };
    }
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  return null;
}

interface AuthProviderProps {
  onProfileLoaded?: (profile: CustomerProfileResponse) => void;
  children: ReactNode;
}

export function AuthProvider({ onProfileLoaded, children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(readStoredAuthSession);
  const [profile, setProfile] = useState<CustomerProfileResponse | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const onProfileLoadedRef = useRef(onProfileLoaded);
  useEffect(() => {
    onProfileLoadedRef.current = onProfileLoaded;
  }, [onProfileLoaded]);

  useEffect(() => {
    try {
      if (session) {
        window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [session]);

  const handleUnauthorized = useCallback((customNotice?: string) => {
    setSession(null);
    setProfile(null);
    setAuthNotice(
      customNotice ??
        'Sua sessão expirou. Você pode continuar seu pedido como convidado ou entrar novamente com um código por e-mail.',
    );
  }, []);

  const clearAuthNotice = useCallback(() => {
    setAuthNotice(null);
  }, []);

  const loadProfileForToken = useCallback(
    async (accessToken: string, signal?: AbortSignal): Promise<CustomerProfileResponse | null> => {
      setIsLoadingProfile(true);
      try {
        const loaded = await apiClient.getMyProfile(accessToken, signal);
        if (signal?.aborted) return null;
        setProfile(loaded);
        onProfileLoadedRef.current?.(loaded);
        return loaded;
      } catch (err) {
        if (signal?.aborted) return null;
        if (err instanceof ApiClientError) {
          if (err.status === 401) {
            handleUnauthorized();
            return null;
          }
          if (err.status === 404) {
            setProfile(null);
            return null;
          }
        }
        return null;
      } finally {
        if (!signal?.aborted) {
          setIsLoadingProfile(false);
        }
      }
    },
    [handleUnauthorized],
  );

  // Sync saved profile on startup whenever a valid non-expired session is restored
  useEffect(() => {
    if (!session) return;
    if (session.expiresAtMs <= Date.now()) {
      handleUnauthorized();
      return;
    }

    const controller = new AbortController();
    void loadProfileForToken(session.accessToken, controller.signal);
    return () => controller.abort();
  }, [session, handleUnauthorized, loadProfileForToken]);

  const requestOtpCode = useCallback(async (email: string) => {
    setAuthNotice(null);
    return apiClient.requestAuthCode(email);
  }, []);

  const verifyOtpCode = useCallback(
    async (params: { email: string; code: string; challengeSession: string }) => {
      setAuthNotice(null);
      const authResult = await apiClient.verifyAuthCode({
        email: params.email,
        code: params.code,
        session: params.challengeSession,
      });

      const nextSession: AuthSession = {
        userId: authResult.user_id,
        email: authResult.email,
        accessToken: authResult.access_token,
        idToken: authResult.id_token,
        refreshToken: authResult.refresh_token,
        expiresAtMs: Date.now() + authResult.expires_in_seconds * 1000,
      };
      setSession(nextSession);
      return authResult;
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    if (!session) return null;
    return loadProfileForToken(session.accessToken);
  }, [session, loadProfileForToken]);

  const saveProfile = useCallback(
    async (payload: UpsertCustomerProfileRequest): Promise<CustomerProfileResponse> => {
      if (!session) {
        throw new ApiClientError({
          status: 401,
          errorCode: 'Unauthorized',
          detail: 'Faça login para salvar seu perfil.',
        });
      }
      try {
        const updated = await apiClient.updateMyProfile(session.accessToken, payload);
        setProfile(updated);
        onProfileLoadedRef.current?.(updated);
        return updated;
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          handleUnauthorized();
        }
        throw err;
      }
    },
    [session, handleUnauthorized],
  );

  const logout = useCallback(() => {
    setSession(null);
    setProfile(null);
    setAuthNotice(null);
  }, []);

  const isAuthenticated = Boolean(session && session.expiresAtMs > Date.now());

  const value = useMemo<AuthContextValue>(
    () => ({
      session: isAuthenticated ? session : null,
      isAuthenticated,
      profile,
      isLoadingProfile,
      authNotice,
      clearAuthNotice,
      requestOtpCode,
      verifyOtpCode,
      refreshProfile,
      saveProfile,
      handleUnauthorized,
      logout,
    }),
    [
      session,
      isAuthenticated,
      profile,
      isLoadingProfile,
      authNotice,
      clearAuthNotice,
      requestOtpCode,
      verifyOtpCode,
      refreshProfile,
      saveProfile,
      handleUnauthorized,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return ctx;
}
