/**
 * Optional Customer Account Modal (`AccountModal.tsx`).
 *
 * Features:
 * 1. Clear separation for unauthenticated customers:
 *    - "Já tenho conta": Passwordless Email OTP (`POST /auth/request-code` -> `POST /auth/verify-code`),
 *      automatically prompting new-to-profile users (`GET /me/profile` 404) to complete their profile.
 *    - "Criar minha conta": Upfront registration form (name, phone, email, CPF, default address)
 *      followed by Email OTP verification that immediately persists `PUT /me/profile`.
 * 2. Cloud Order History (`GET /me/orders`) with live tracking, Pagar.me link recovery, and "Pedir novamente".
 * 3. Saved Profile & Default Address (`GET /me/profile` + `PUT /me/profile`) to autofill checkouts.
 * 4. Automatic graceful cleanup when any authenticated call returns `401 Unauthorized`.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  History,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  RotateCcw,
  Search,
  Sparkles,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import {
  formatCepInput,
  formatCentsToBRL,
  formatCpfInput,
  getOrderStatusPresentation,
  isCompleteCep,
  isValidCpf,
  isValidEmail,
  isValidFullName,
  stripNonDigits,
  type AuthRequestCodeResponse,
  type OrderResponse,
  type UpsertCustomerProfileRequest,
} from '../domain';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { ApiClientError, apiClient, lookupCepAddressPublic } from '../services/api';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackOrder: (orderId: string) => void;
  onReorder?: (order: OrderResponse) => void;
}

type UnauthMode = 'login' | 'register';
type AccountTab = 'orders' | 'profile';

interface ProfileFormState {
  name: string;
  phone: string;
  email: string;
  documentNumber: string;
  postalCode: string;
  streetName: string;
  streetNumber: string;
  district: string;
  complement: string;
  reference: string;
}

const EMPTY_PROFILE_FORM: ProfileFormState = {
  name: '',
  phone: '',
  email: '',
  documentNumber: '',
  postalCode: '',
  streetName: '',
  streetNumber: '',
  district: '',
  complement: '',
  reference: '',
};

function validateUpfrontRegistration(form: ProfileFormState): string | null {
  if (!isValidFullName(form.name)) {
    return 'Informe seu nome completo (nome e sobrenome).';
  }
  const phoneDigits = stripNonDigits(form.phone);
  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    return 'Informe um WhatsApp/telefone válido com DDD (10 ou 11 dígitos).';
  }
  if (!isValidEmail(form.email)) {
    return 'Informe um e-mail válido (ex.: nome@dominio.com) para receber o código de confirmação.';
  }
  if (!isValidCpf(form.documentNumber)) {
    return 'Informe um CPF válido.';
  }
  if (!isCompleteCep(form.postalCode)) {
    return 'Informe um CEP válido com 8 dígitos.';
  }
  if (form.streetName.trim().length < 2) {
    return 'Informe o nome da rua ou avenida.';
  }
  if (form.streetNumber.trim().length < 1) {
    return 'Informe o número do endereço.';
  }
  if (form.district.trim().length < 2) {
    return 'Informe o bairro do endereço.';
  }
  return null;
}

interface CepAddressFieldProps {
  id: string;
  label: string;
  value: string;
  isLookingUp: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
  onChange: (rawCep: string) => void;
  onSearchClick: () => void;
}

function CepAddressField({
  id,
  label,
  value,
  isLookingUp,
  feedback,
  onChange,
  onSearchClick,
}: CepAddressFieldProps) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="block text-xs font-bold text-ink-primary">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength={9}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex.: 03195-000"
          className="w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
        />
        <button
          type="button"
          disabled={isLookingUp}
          onClick={onSearchClick}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-hover disabled:opacity-60"
        >
          {isLookingUp ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Buscando...</span>
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              <span>Buscar CEP</span>
            </>
          )}
        </button>
      </div>
      {isLookingUp && (
        <p
          role="status"
          className="mt-1 flex items-center gap-1.5 text-xs font-medium text-brand-primary"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Buscando endereço pelo CEP...</span>
        </p>
      )}
      {!isLookingUp && feedback && (
        <p
          role="status"
          className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${
            feedback.type === 'success' ? 'text-status-success' : 'text-ink-secondary'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          <span>{feedback.message}</span>
        </p>
      )}
    </div>
  );
}

export function AccountModal({ isOpen, onClose, onTrackOrder, onReorder }: AccountModalProps) {
  const {
    session,
    isAuthenticated,
    profile,
    isLoadingProfile,
    isNewUserWithoutProfile,
    authNotice,
    clearAuthNotice,
    requestOtpCode,
    verifyOtpCode,
    refreshProfile,
    saveProfile,
    handleUnauthorized,
    logout,
  } = useAuth();

  const { checkoutDraft } = useCart();

  // Unauthenticated state (challenge session & pending registration stay strictly in memory)
  const [unauthMode, setUnauthMode] = useState<UnauthMode>('login');
  const [emailInput, setEmailInput] = useState<string>('');
  const [registerForm, setRegisterForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [pendingRegistrationPayload, setPendingRegistrationPayload] =
    useState<UpsertCustomerProfileRequest | null>(null);
  const [otpChallenge, setOtpChallenge] = useState<AuthRequestCodeResponse | null>(null);
  const [otpCodeInput, setOtpCodeInput] = useState<string>('');
  const [registrationPromptNotice, setRegistrationPromptNotice] = useState<string | null>(null);
  const [redirectAnimationKey, setRedirectAnimationKey] = useState<number>(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // Authenticated state
  const [activeTab, setActiveTab] = useState<AccountTab>('orders');
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [isLookingUpCep, setIsLookingUpCep] = useState<boolean>(false);
  const [cepLookupFeedback, setCepLookupFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const cepLookupAbortRef = useRef<AbortController | null>(null);
  const lastLookedUpCepRef = useRef<{ register: string; profile: string }>({
    register: '',
    profile: '',
  });

  useEffect(() => {
    return () => {
      cepLookupAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cepLookupAbortRef.current?.abort();
      setIsLookingUpCep(false);
      setCepLookupFeedback(null);
      setAuthError(null);
      setRegistrationPromptNotice(null);
      setRedirectAnimationKey(0);
      setProfileSuccess(null);
      setProfileError(null);
      setOrdersError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // If user logged in via "Já tenho conta" and backend returned 404 for /me/profile, guide them straight to Profile
  useEffect(() => {
    if (isAuthenticated && isNewUserWithoutProfile && !pendingRegistrationPayload) {
      setActiveTab('profile');
    }
  }, [isAuthenticated, isNewUserWithoutProfile, pendingRegistrationPayload]);

  useEffect(() => {
    if (!profile) {
      setProfileForm((prev) => {
        const hasLocalInput = Boolean(
          prev.name.trim() ||
          prev.phone.trim() ||
          prev.documentNumber.trim() ||
          prev.postalCode.trim(),
        );
        if (hasLocalInput) {
          return prev;
        }
        return {
          name: checkoutDraft.name,
          phone: checkoutDraft.phone,
          email: session?.email ?? checkoutDraft.email,
          documentNumber: formatCpfInput(checkoutDraft.documentNumber),
          postalCode: checkoutDraft.postalCode,
          streetName: checkoutDraft.streetName,
          streetNumber: checkoutDraft.streetNumber,
          district: checkoutDraft.district,
          complement: checkoutDraft.complement,
          reference: checkoutDraft.reference,
        };
      });
      return;
    }
    const addr = profile.default_address;
    setProfileForm({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      email: profile.email ?? session?.email ?? '',
      documentNumber: profile.document_number ? formatCpfInput(profile.document_number) : '',
      postalCode: addr?.postal_code ? formatCepInput(addr.postal_code) : '',
      streetName: addr?.street_name ?? '',
      streetNumber: addr?.street_number ?? '',
      district: addr?.district ?? '',
      complement: addr?.complement ?? '',
      reference: addr?.reference ?? '',
    });
  }, [profile, session?.email, checkoutDraft]);

  // Retry loading profile when opening the Profile tab if it wasn't loaded yet
  useEffect(() => {
    if (
      !isOpen ||
      !isAuthenticated ||
      activeTab !== 'profile' ||
      profile ||
      isLoadingProfile ||
      isNewUserWithoutProfile ||
      pendingRegistrationPayload
    ) {
      return;
    }
    void refreshProfile();
  }, [
    isOpen,
    isAuthenticated,
    activeTab,
    profile,
    isLoadingProfile,
    isNewUserWithoutProfile,
    pendingRegistrationPayload,
    refreshProfile,
  ]);

  const fetchMyOrders = useCallback(
    async (accessToken: string, signal?: AbortSignal) => {
      setIsLoadingOrders(true);
      setOrdersError(null);
      try {
        const list = await apiClient.getMyOrders(accessToken, signal);
        if (!signal?.aborted) {
          setOrders(list);
        }
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof ApiClientError) {
          if (err.status === 401) {
            handleUnauthorized();
            return;
          }
          setOrdersError(err.detail);
        } else {
          setOrdersError('Não foi possível carregar seu histórico de pedidos agora.');
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoadingOrders(false);
        }
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    if (!isOpen || !isAuthenticated || !session?.accessToken || activeTab !== 'orders') {
      return;
    }
    const controller = new AbortController();
    void fetchMyOrders(session.accessToken, controller.signal);
    return () => controller.abort();
  }, [isOpen, isAuthenticated, session?.accessToken, activeTab, fetchMyOrders]);

  if (!isOpen) {
    return null;
  }

  function handleSwitchUnauthMode(mode: UnauthMode, emphasizeSwitch = false) {
    setUnauthMode(mode);
    setOtpChallenge(null);
    setPendingRegistrationPayload(null);
    setOtpCodeInput('');
    setAuthError(null);
    setRegistrationPromptNotice(null);
    if (mode === 'register' && emphasizeSwitch) {
      setRedirectAnimationKey((prev) => prev + 1);
    } else if (mode === 'login') {
      setRedirectAnimationKey(0);
    }
    if (mode === 'register' && emailInput.trim() && !registerForm.email.trim()) {
      setRegisterForm((prev) => ({ ...prev, email: emailInput.trim() }));
    }
  }

  async function lookupAndFillAddressForForm(rawCep: string, target: 'register' | 'profile') {
    const digits = stripNonDigits(rawCep);
    if (digits.length !== 8) {
      setCepLookupFeedback({
        type: 'error',
        message: 'Digite os 8 números do CEP para buscar o endereço.',
      });
      return;
    }

    cepLookupAbortRef.current?.abort();
    const controller = new AbortController();
    cepLookupAbortRef.current = controller;
    lastLookedUpCepRef.current[target] = digits;

    setIsLookingUpCep(true);
    setCepLookupFeedback(null);

    try {
      const publicAddr = await lookupCepAddressPublic(digits, controller.signal);
      if (controller.signal.aborted) return;

      if (!publicAddr || (!publicAddr.streetName && !publicAddr.district)) {
        const clearAddress = (prev: ProfileFormState): ProfileFormState =>
          stripNonDigits(prev.postalCode) === digits
            ? { ...prev, streetName: '', district: '' }
            : prev;

        if (target === 'register') {
          setRegisterForm(clearAddress);
        } else {
          setProfileForm(clearAddress);
        }

        setCepLookupFeedback({
          type: 'error',
          message: 'CEP não localizado. Verifique o número digitado e tente novamente.',
        });
        return;
      }

      const applyUpdate = (prev: ProfileFormState): ProfileFormState => {
        if (stripNonDigits(prev.postalCode) !== digits) {
          return prev;
        }
        return {
          ...prev,
          streetName: publicAddr.streetName ?? '',
          district: publicAddr.district ?? '',
        };
      };

      if (target === 'register') {
        setRegisterForm(applyUpdate);
      } else {
        setProfileForm(applyUpdate);
      }

      const summary = [publicAddr.streetName, publicAddr.district].filter(Boolean).join(' • ');
      setCepLookupFeedback({
        type: 'success',
        message: summary ? `Endereço preenchido: ${summary}` : 'Endereço atualizado pelo CEP.',
      });
    } finally {
      if (!controller.signal.aborted) {
        setIsLookingUpCep(false);
      }
    }
  }

  function handleFormCepChange(rawCep: string, target: 'register' | 'profile') {
    const formatted = formatCepInput(rawCep);
    const digits = stripNonDigits(formatted);

    const updatePostal = (prev: ProfileFormState): ProfileFormState => {
      const cepChanged = stripNonDigits(prev.postalCode) !== digits;
      return {
        ...prev,
        postalCode: formatted,
        ...(cepChanged && digits.length < 8 ? { streetName: '', district: '' } : {}),
      };
    };

    if (target === 'register') {
      setRegisterForm(updatePostal);
    } else {
      setProfileForm(updatePostal);
    }

    setCepLookupFeedback(null);
    if (digits.length < 8) {
      cepLookupAbortRef.current?.abort();
      setIsLookingUpCep(false);
      lastLookedUpCepRef.current[target] = '';
      return;
    }

    if (digits !== lastLookedUpCepRef.current[target]) {
      void lookupAndFillAddressForForm(formatted, target);
    }
  }

  async function handleRequestLoginOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setRegistrationPromptNotice(null);
    clearAuthNotice();

    const normalized = emailInput.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setAuthError(
        'Informe um e-mail válido (ex.: nome@dominio.com) para receber o código de acesso.',
      );
      return;
    }

    setIsAuthLoading(true);
    try {
      const challenge = await requestOtpCode(normalized, { createIfMissing: false });
      setPendingRegistrationPayload(null);
      setOtpChallenge(challenge);
      setOtpCodeInput('');
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        (err.status === 404 ||
          err.errorCode === 'UserNotFoundError' ||
          err.errorCode === 'ProfileNotFoundError')
      ) {
        setUnauthMode('register');
        setRegisterForm((prev) => ({ ...prev, email: normalized }));
        setRegistrationPromptNotice(
          `O e-mail ${normalized} ainda não possui cadastro. Preencha seus dados abaixo para criar sua conta e receber o código de confirmação!`,
        );
        setRedirectAnimationKey((prev) => prev + 1);
        setAuthError(null);
      } else if (err instanceof ApiClientError) {
        setAuthError(err.detail);
      } else {
        setAuthError('Não foi possível enviar o código agora. Tente novamente.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleStartRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    clearAuthNotice();

    const validationError = validateUpfrontRegistration(registerForm);
    if (validationError) {
      setAuthError(validationError);
      return;
    }

    const normalizedEmail = registerForm.email.trim().toLowerCase();
    const registrationPayload: UpsertCustomerProfileRequest = {
      email: normalizedEmail,
      name: registerForm.name.trim(),
      phone: stripNonDigits(registerForm.phone),
      document_number: stripNonDigits(registerForm.documentNumber),
      default_address: {
        postal_code: formatCepInput(registerForm.postalCode),
        street_name: registerForm.streetName.trim(),
        street_number: registerForm.streetNumber.trim(),
        district: registerForm.district.trim(),
        city: 'São Paulo',
        state: 'SP',
        complement: registerForm.complement.trim(),
        reference: registerForm.reference.trim(),
        country: 'BR',
      },
    };

    setIsAuthLoading(true);
    try {
      const challenge = await requestOtpCode(normalizedEmail, { createIfMissing: true });
      setRegistrationPromptNotice(null);
      setPendingRegistrationPayload(registrationPayload);
      setOtpChallenge(challenge);
      setOtpCodeInput('');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setAuthError(err.detail);
      } else {
        setAuthError('Não foi possível enviar o código de confirmação agora. Tente novamente.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpChallenge) return;
    setAuthError(null);

    const trimmedCode = otpCodeInput.trim();
    if (trimmedCode.length < 4) {
      setAuthError('Digite o código de verificação enviado para o seu e-mail.');
      return;
    }

    setIsAuthLoading(true);
    try {
      const isSignUpFlow = Boolean(pendingRegistrationPayload);
      const authResult = await verifyOtpCode({
        email: otpChallenge.email,
        code: trimmedCode,
        challengeSession: otpChallenge.session,
        skipProfileAutoFetch: isSignUpFlow,
      });

      if (pendingRegistrationPayload) {
        try {
          await saveProfile(pendingRegistrationPayload, authResult.access_token);
          setActiveTab('profile');
          setProfileSuccess(
            'Cadastro concluído! Seus dados e endereço padrão já estão salvos para os próximos pedidos.',
          );
        } catch (saveErr) {
          setProfileForm({
            ...registerForm,
            email: pendingRegistrationPayload.email,
            documentNumber: formatCpfInput(registerForm.documentNumber),
            postalCode: formatCepInput(registerForm.postalCode),
          });
          setActiveTab('profile');
          setProfileError(
            saveErr instanceof ApiClientError
              ? `Sua conta foi validada, mas não foi possível salvar seus dados (${saveErr.detail}). Revise e clique em salvar abaixo.`
              : 'Sua conta foi validada, mas não foi possível salvar seus dados agora. Revise e clique em salvar abaixo.',
          );
        }
        setPendingRegistrationPayload(null);
      } else {
        setActiveTab('orders');
      }

      setOtpChallenge(null);
      setOtpCodeInput('');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setAuthError(err.detail);
      } else {
        setAuthError('Código inválido ou expirado. Solicite um novo código.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setProfileError(null);
    setProfileSuccess(null);

    if (profileForm.name.trim() && !isValidFullName(profileForm.name)) {
      setProfileError('Informe seu nome completo (nome e sobrenome).');
      return;
    }

    if (profileForm.documentNumber.trim() && !isValidCpf(profileForm.documentNumber)) {
      setProfileError('Informe um CPF válido.');
      return;
    }

    setIsSavingProfile(true);

    try {
      await saveProfile({
        email: session.email,
        name: profileForm.name.trim(),
        phone: stripNonDigits(profileForm.phone),
        document_number: stripNonDigits(profileForm.documentNumber),
        default_address: {
          postal_code: formatCepInput(profileForm.postalCode),
          street_name: profileForm.streetName.trim(),
          street_number: profileForm.streetNumber.trim(),
          district: profileForm.district.trim(),
          city: 'São Paulo',
          state: 'SP',
          complement: profileForm.complement.trim(),
          reference: profileForm.reference.trim(),
          country: 'BR',
        },
      });
      setProfileSuccess(
        'Perfil e endereço salvos! Seus próximos checkouts serão preenchidos automaticamente.',
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status !== 401) {
          setProfileError(err.detail);
        }
      } else {
        setProfileError('Não foi possível salvar seu perfil agora.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary">
              {isAuthenticated ? 'Conta Conectada' : 'Acesso Opcional sem Senha'}
            </span>
            <h2
              id="account-modal-title"
              className="font-display text-2xl font-bold uppercase tracking-tight text-ink-primary"
            >
              {isAuthenticated
                ? 'Minha Conta'
                : unauthMode === 'register'
                  ? 'Criar Minha Conta'
                  : 'Entrar ou Cadastrar'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela da conta"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-subtle text-ink-primary transition hover:bg-canvas"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {authNotice && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-3 text-xs font-medium text-ink-primary"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
              <span>{authNotice}</span>
            </div>
          )}

          {!isAuthenticated ? (
            /* Unauthenticated View: "Já tenho conta" vs "Criar minha conta" */
            <div className="space-y-4">
              {!otpChallenge && (
                <>
                  <div
                    role="tablist"
                    aria-label="Modo de acesso"
                    className="grid grid-cols-2 gap-2 rounded-xl bg-subtle p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={unauthMode === 'login'}
                      onClick={() => handleSwitchUnauthMode('login')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                        unauthMode === 'login'
                          ? 'bg-brand-primary text-white shadow-2xs'
                          : 'text-ink-secondary hover:text-ink-primary'
                      }`}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Já tenho conta</span>
                    </button>
                    <button
                      key={`register-tab-${String(redirectAnimationKey)}`}
                      type="button"
                      role="tab"
                      aria-selected={unauthMode === 'register'}
                      onClick={() => handleSwitchUnauthMode('register')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                        unauthMode === 'register'
                          ? 'bg-brand-primary text-white shadow-2xs'
                          : 'text-ink-secondary hover:text-ink-primary'
                      } ${
                        redirectAnimationKey > 0 && unauthMode === 'register'
                          ? 'animate-tab-shake ring-2 ring-brand-primary/40'
                          : ''
                      }`}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Criar minha conta</span>
                    </button>
                  </div>

                  <div
                    key={`optional-banner-${unauthMode}-${String(redirectAnimationKey)}`}
                    className={`animate-dynamic-reveal flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed transition ${
                      redirectAnimationKey > 0 && unauthMode === 'register'
                        ? 'border-brand-primary/40 bg-brand-primary/5 text-ink-primary shadow-2xs'
                        : 'border-border bg-subtle/60 text-ink-secondary'
                    }`}
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    <p>
                      O cadastro é <strong>100% opcional</strong>: você também pode pedir direto
                      como convidado no checkout. Criando sua conta, seu endereço padrão e histórico
                      ficam salvos na nuvem sem precisar decorar senha.
                    </p>
                  </div>
                </>
              )}

              {registrationPromptNotice && (
                <div
                  key={`notice-${String(redirectAnimationKey)}`}
                  role="status"
                  data-testid="unregistered-email-notice"
                  className="animate-dynamic-reveal flex items-start gap-2 rounded-xl border border-brand-primary/40 bg-brand-primary/10 p-3 text-xs font-medium text-ink-primary shadow-2xs"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                  <span>{registrationPromptNotice}</span>
                </div>
              )}

              {authError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-status-error/40 bg-status-error/10 p-3 text-xs font-semibold text-status-error"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {otpChallenge ? (
                /* Step 2 (shared OTP verification for Login or Sign-Up) */
                <form onSubmit={(e) => void handleVerifyOtp(e)} noValidate className="space-y-4">
                  <div className="space-y-2 rounded-xl border border-brand-primary/30 bg-brand-primary/5 p-3 text-xs text-ink-primary">
                    <p>
                      Enviamos um código de verificação para <strong>{otpChallenge.email}</strong>{' '}
                      (expira em cerca de 3 minutos).
                    </p>
                    <p
                      role="note"
                      className="flex items-start gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-2.5 py-2 font-semibold text-amber-900"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span>
                        Não encontrou o e-mail? Olhe também na sua caixa de spam ou lixo eletrônico.
                      </span>
                    </p>
                    {pendingRegistrationPayload && (
                      <p className="font-semibold text-brand-primary">
                        Assim que confirmar o código, finalizaremos seu cadastro com os dados
                        informados.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="auth-otp-input"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      Código recebido no e-mail *
                    </label>
                    <div className="relative mt-1">
                      <KeyRound
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary"
                      />
                      <input
                        id="auth-otp-input"
                        type="text"
                        inputMode="numeric"
                        value={otpCodeInput}
                        onChange={(e) => setOtpCodeInput(e.target.value)}
                        placeholder="Digite os dígitos do código"
                        className="w-full rounded-xl border border-border bg-subtle/50 py-2.5 pl-9 pr-3 font-mono text-sm tracking-widest text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-hover disabled:opacity-60"
                  >
                    {isAuthLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Validando código...</span>
                      </>
                    ) : (
                      <span>
                        {pendingRegistrationPayload
                          ? 'Confirmar código e concluir cadastro'
                          : 'Validar e entrar'}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isAuthLoading}
                    onClick={() => {
                      setOtpChallenge(null);
                      setOtpCodeInput('');
                      setAuthError(null);
                    }}
                    className="w-full rounded-xl border border-border bg-subtle py-2.5 text-xs font-bold text-ink-secondary transition hover:text-ink-primary"
                  >
                    {pendingRegistrationPayload
                      ? 'Voltar e editar dados / e-mail'
                      : 'Trocar e-mail ou pedir novo código'}
                  </button>
                </form>
              ) : unauthMode === 'login' ? (
                /* Mode 1: Returning User Login by Email OTP */
                <form
                  onSubmit={(e) => void handleRequestLoginOtp(e)}
                  noValidate
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="auth-email-input"
                      className="block text-xs font-bold text-ink-primary"
                    >
                      Seu e-mail *
                    </label>
                    <div className="relative mt-1">
                      <Mail
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary"
                      />
                      <input
                        id="auth-email-input"
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="cliente@exemplo.com"
                        className="w-full rounded-xl border border-border bg-subtle/50 py-2.5 pl-9 pr-3 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-hover disabled:opacity-60"
                  >
                    {isAuthLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Enviando código...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        <span>Receber código por e-mail</span>
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-ink-secondary">
                    Ainda não tem cadastro?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchUnauthMode('register', true)}
                      className="font-bold text-brand-primary underline"
                    >
                      Preencher meus dados agora
                    </button>
                  </p>
                </form>
              ) : (
                /* Mode 2: Upfront Registration Form -> Email OTP Confirmation */
                <form
                  onSubmit={(e) => void handleStartRegistration(e)}
                  noValidate
                  className="space-y-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="register-name"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Nome completo *
                      </label>
                      <input
                        id="register-name"
                        type="text"
                        maxLength={64}
                        value={registerForm.name}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="Ex.: Maria Silva"
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="register-phone"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        WhatsApp / Telefone com DDD *
                      </label>
                      <input
                        id="register-phone"
                        type="tel"
                        value={registerForm.phone}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="Ex.: (11) 99999-8888"
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="register-email"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        E-mail *
                      </label>
                      <input
                        id="register-email"
                        type="email"
                        value={registerForm.email}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="Ex.: maria@exemplo.com"
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="register-document"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        CPF *
                      </label>
                      <input
                        id="register-document"
                        type="text"
                        inputMode="numeric"
                        maxLength={14}
                        value={registerForm.documentNumber}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({
                            ...prev,
                            documentNumber: formatCpfInput(e.target.value),
                          }))
                        }
                        placeholder="Ex.: 123.456.789-09"
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <CepAddressField
                      id="register-cep"
                      label="CEP *"
                      value={registerForm.postalCode}
                      isLookingUp={isLookingUpCep}
                      feedback={cepLookupFeedback}
                      onChange={(raw) => handleFormCepChange(raw, 'register')}
                      onSearchClick={() =>
                        void lookupAndFillAddressForForm(registerForm.postalCode, 'register')
                      }
                    />

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="register-district"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Bairro *
                      </label>
                      <input
                        id="register-district"
                        type="text"
                        value={registerForm.district}
                        disabled
                        readOnly
                        placeholder="Preenchido automaticamente pelo CEP"
                        className="mt-1 w-full cursor-not-allowed rounded-xl border border-gray-300 bg-gray-200 px-3 py-2 text-sm text-gray-600 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="register-street"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Rua / Avenida *
                      </label>
                      <input
                        id="register-street"
                        type="text"
                        value={registerForm.streetName}
                        disabled
                        readOnly
                        placeholder="Preenchido automaticamente pelo CEP"
                        className="mt-1 w-full cursor-not-allowed rounded-xl border border-gray-300 bg-gray-200 px-3 py-2 text-sm text-gray-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="register-number"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Número *
                      </label>
                      <input
                        id="register-number"
                        type="text"
                        value={registerForm.streetNumber}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, streetNumber: e.target.value }))
                        }
                        placeholder="Ex.: 123"
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="register-complement"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Complemento
                      </label>
                      <input
                        id="register-complement"
                        type="text"
                        value={registerForm.complement}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, complement: e.target.value }))
                        }
                        placeholder="Ex.: Apto 42"
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="register-reference"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Ponto de referência
                      </label>
                      <input
                        id="register-reference"
                        type="text"
                        value={registerForm.reference}
                        onChange={(e) =>
                          setRegisterForm((prev) => ({ ...prev, reference: e.target.value }))
                        }
                        placeholder="Ex.: Próximo ao metrô"
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-hover disabled:opacity-60"
                  >
                    {isAuthLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Enviando código de confirmação...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        <span>Continuar e validar e-mail com código</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Authenticated Cloud Order History & Saved Profile */
            <div className="space-y-5">
              {/* Session Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-subtle/60 px-3.5 py-2.5">
                <div className="text-xs">
                  <span className="block text-[11px] text-ink-secondary">Conectado como</span>
                  <strong className="text-ink-primary">{session?.email}</strong>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink-secondary transition hover:border-status-error/40 hover:text-status-error"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sair</span>
                </button>
              </div>

              {/* Navigation Tabs */}
              <div role="tablist" className="grid grid-cols-2 gap-2 rounded-xl bg-subtle p-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'orders'}
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                    activeTab === 'orders'
                      ? 'bg-brand-primary text-white shadow-2xs'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Meus Pedidos</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'profile'}
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                    activeTab === 'profile'
                      ? 'bg-brand-primary text-white shadow-2xs'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Meu Perfil &amp; Endereço</span>
                </button>
              </div>

              {activeTab === 'orders' ? (
                <div className="space-y-3">
                  {isLoadingOrders && (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-ink-secondary">
                      <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                      <span>Buscando seus pedidos...</span>
                    </div>
                  )}

                  {!isLoadingOrders && ordersError && (
                    <div
                      role="alert"
                      className="rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-xs font-semibold text-status-error"
                    >
                      {ordersError}
                    </div>
                  )}

                  {!isLoadingOrders && !ordersError && orders.length === 0 && (
                    <div className="rounded-2xl border border-border bg-subtle/40 p-6 text-center text-xs text-ink-secondary">
                      Você ainda não tem pedidos vinculados a esta conta.
                    </div>
                  )}

                  {!isLoadingOrders &&
                    orders.map((order) => {
                      const statusMeta = getOrderStatusPresentation(order.status);
                      return (
                        <article
                          key={order.order_id}
                          className="rounded-2xl border border-border bg-subtle/40 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-base font-bold uppercase text-ink-primary">
                                Pedido #{order.display_id}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  statusMeta.isCancelled
                                    ? 'bg-status-error text-white'
                                    : order.status === 'PENDING'
                                      ? 'bg-brand-primary text-white'
                                      : 'bg-status-success text-white'
                                }`}
                              >
                                {statusMeta.badgeLabel}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-brand-primary">
                              {formatCentsToBRL(order.total_cents)}
                            </span>
                          </div>

                          {order.items.length > 0 && (
                            <p className="mt-2 text-xs text-ink-secondary">
                              {order.items
                                .map((item) => `${item.quantity}x ${item.name}`)
                                .join(', ')}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onTrackOrder(order.order_id);
                              }}
                              className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-hover"
                            >
                              Acompanhar status
                            </button>

                            {order.status === 'PENDING' && order.checkout_url && (
                              <a
                                href={order.checkout_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-primary bg-surface px-3 py-1.5 text-xs font-bold text-brand-primary transition hover:bg-brand-primary/10"
                              >
                                <span>Pagar no Pagar.me</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}

                            {order.items.length > 0 && onReorder && (
                              <button
                                type="button"
                                onClick={() => {
                                  onReorder(order);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink-primary transition hover:bg-subtle"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Pedir novamente</span>
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                </div>
              ) : isLoadingProfile && !profile ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-ink-secondary">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                  <span>Carregando seus dados salvos...</span>
                </div>
              ) : (
                <form onSubmit={(e) => void handleSaveProfile(e)} noValidate className="space-y-4">
                  {isNewUserWithoutProfile && !profileSuccess && (
                    <div
                      role="status"
                      className="flex items-start gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-3 text-xs font-medium text-ink-primary"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                      <span>
                        Bem-vindo! Como este é seu primeiro acesso, complete seus dados abaixo para
                        agilizar seus próximos pedidos.
                      </span>
                    </div>
                  )}

                  {profileSuccess && (
                    <div className="flex items-start gap-2 rounded-xl border border-status-success/30 bg-status-success/10 p-3 text-xs font-semibold text-status-success">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{profileSuccess}</span>
                    </div>
                  )}

                  {profileError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-xs font-semibold text-status-error"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{profileError}</span>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="profile-name"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Nome completo
                      </label>
                      <input
                        id="profile-name"
                        type="text"
                        maxLength={64}
                        value={profileForm.name}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="Ex.: Maria Silva"
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-phone"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        WhatsApp / Telefone
                      </label>
                      <input
                        id="profile-phone"
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-document"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        CPF
                      </label>
                      <input
                        id="profile-document"
                        type="text"
                        inputMode="numeric"
                        maxLength={14}
                        value={profileForm.documentNumber}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            documentNumber: formatCpfInput(e.target.value),
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <CepAddressField
                      id="profile-cep"
                      label="CEP Padrão"
                      value={profileForm.postalCode}
                      isLookingUp={isLookingUpCep}
                      feedback={cepLookupFeedback}
                      onChange={(raw) => handleFormCepChange(raw, 'profile')}
                      onSearchClick={() =>
                        void lookupAndFillAddressForForm(profileForm.postalCode, 'profile')
                      }
                    />

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="profile-street"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Rua / Avenida
                      </label>
                      <input
                        id="profile-street"
                        type="text"
                        value={profileForm.streetName}
                        disabled
                        readOnly
                        placeholder="Preenchido automaticamente pelo CEP"
                        className="mt-1 w-full cursor-not-allowed rounded-xl border border-gray-300 bg-gray-200 px-3 py-2 text-sm text-gray-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-number"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Número
                      </label>
                      <input
                        id="profile-number"
                        type="text"
                        value={profileForm.streetNumber}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, streetNumber: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-district"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Bairro
                      </label>
                      <input
                        id="profile-district"
                        type="text"
                        value={profileForm.district}
                        disabled
                        readOnly
                        placeholder="Preenchido automaticamente pelo CEP"
                        className="mt-1 w-full cursor-not-allowed rounded-xl border border-gray-300 bg-gray-200 px-3 py-2 text-sm text-gray-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-complement"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Complemento
                      </label>
                      <input
                        id="profile-complement"
                        type="text"
                        value={profileForm.complement}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, complement: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-reference"
                        className="block text-xs font-bold text-ink-primary"
                      >
                        Referência
                      </label>
                      <input
                        id="profile-reference"
                        type="text"
                        value={profileForm.reference}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, reference: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-border bg-subtle/50 px-3 py-2 text-sm text-ink-primary focus:border-brand-primary focus:bg-surface focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-hover disabled:opacity-60"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Salvando perfil...</span>
                      </>
                    ) : (
                      <span>Salvar perfil e endereço</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
