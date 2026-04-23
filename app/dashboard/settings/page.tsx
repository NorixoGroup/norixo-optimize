"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";
import {
  buildOwnerProfileStorageKey,
  getVisibleWorkspaceName,
  getWorkspaceAvatarLetters,
  NORIXO_OWNER_PROFILE_UPDATED_EVENT,
} from "@/lib/workspaces/visibleWorkspaceDisplay";

type WorkspaceData = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
} | null;

type AccountIdentity = {
  id: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

type OwnerProfileDraft = {
  logoDataUrl: string;
  firstName: string;
  lastName: string;
  conciergeName: string;
  email: string;
  phone: string;
  jobTitle: string;
  bio: string;
};

type PreferencesDraft = {
  notifications: string;
};

const emptyOwnerProfile: OwnerProfileDraft = {
  logoDataUrl: "",
  firstName: "",
  lastName: "",
  conciergeName: "",
  email: "",
  phone: "",
  jobTitle: "",
  bio: "",
};

const emptyPreferencesDraft: PreferencesDraft = {
  notifications: "",
};

function buildProfileStorageKey(accountId?: string | null, workspaceId?: string | null) {
  if (!accountId) return null;
  return buildOwnerProfileStorageKey(accountId, workspaceId ?? "no-workspace");
}

function buildPreferencesStorageKey(accountId?: string | null, workspaceId?: string | null) {
  if (!accountId) return null;
  return `settings-preferences:${accountId}:${workspaceId ?? "no-workspace"}`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Indisponible";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Indisponible";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SettingsPage() {
  const [account, setAccount] = useState<AccountIdentity>({
    id: null,
    email: null,
    displayName: null,
    avatarUrl: null,
    createdAt: null,
    lastSignInAt: null,
  });
  const [workspace, setWorkspace] = useState<WorkspaceData>(null);
  const [loading, setLoading] = useState(true);
  const [profileDraft, setProfileDraft] = useState<OwnerProfileDraft>(emptyOwnerProfile);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [preferencesDraft, setPreferencesDraft] =
    useState<PreferencesDraft>(emptyPreferencesDraft);
  const [preferencesMessage, setPreferencesMessage] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSettingsData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (!user) {
          setAccount({
            id: null,
            email: null,
            displayName: null,
            avatarUrl: null,
            createdAt: null,
            lastSignInAt: null,
          });
          setWorkspace(null);
          setLoading(false);
          return;
        }

        setAccount({
          id: user.id ?? null,
          email: user.email ?? null,
          displayName:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : typeof user.user_metadata?.display_name === "string"
              ? user.user_metadata.display_name
              : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : null,
          avatarUrl:
            typeof user.user_metadata?.avatar_url === "string"
              ? user.user_metadata.avatar_url
              : null,
          createdAt: user.created_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
        });

        const resolvedWorkspace = await getOrCreateWorkspaceForUser({
          userId: user.id,
          email: user.email ?? null,
          client: supabase,
        });

        if (!mounted) return;

        if (!resolvedWorkspace) {
          setWorkspace(null);
        } else {
          const userMayUseWorkspace = async (workspaceId: string): Promise<boolean> => {
            const { data: member } = await supabase
              .from("workspace_members")
              .select("workspace_id")
              .eq("workspace_id", workspaceId)
              .eq("user_id", user.id)
              .maybeSingle();

            if (member?.workspace_id) {
              return true;
            }

            const { data: owned } = await supabase
              .from("workspaces")
              .select("id")
              .eq("id", workspaceId)
              .eq("owner_user_id", user.id)
              .maybeSingle();

            return Boolean(owned?.id);
          };

          const storedWorkspaceId = getStoredWorkspaceId();
          let activeWorkspaceId = resolvedWorkspace.id;

          if (storedWorkspaceId) {
            const allowedStored = await userMayUseWorkspace(storedWorkspaceId);
            if (allowedStored) {
              activeWorkspaceId = storedWorkspaceId;
              setStoredWorkspaceId(storedWorkspaceId);
            } else {
              setStoredWorkspaceId(resolvedWorkspace.id);
            }
          } else {
            setStoredWorkspaceId(resolvedWorkspace.id);
          }

          if (!mounted) return;

          if (activeWorkspaceId === resolvedWorkspace.id) {
            setWorkspace({
              id: resolvedWorkspace.id,
              name: resolvedWorkspace.name,
              slug: resolvedWorkspace.slug,
              owner_user_id: resolvedWorkspace.owner_user_id,
              created_at: resolvedWorkspace.created_at,
              updated_at: resolvedWorkspace.updated_at,
            });
          } else {
            const { data: wsRow, error: wsRowError } = await supabase
              .from("workspaces")
              .select("id,name,slug,owner_user_id,created_at,updated_at")
              .eq("id", activeWorkspaceId)
              .maybeSingle();

            if (!mounted) return;

            if (!wsRowError && wsRow) {
              setWorkspace(wsRow as NonNullable<WorkspaceData>);
            } else {
              setWorkspace({
                id: resolvedWorkspace.id,
                name: resolvedWorkspace.name,
                slug: resolvedWorkspace.slug,
                owner_user_id: resolvedWorkspace.owner_user_id,
                created_at: resolvedWorkspace.created_at,
                updated_at: resolvedWorkspace.updated_at,
              });
            }
          }
        }
      } catch (error) {
        console.warn("Failed to load settings data", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadSettingsData();

    function onActiveWorkspaceChange() {
      void loadSettingsData();
    }

    window.addEventListener("norixo:active-workspace-changed", onActiveWorkspaceChange);

    return () => {
      mounted = false;
      window.removeEventListener("norixo:active-workspace-changed", onActiveWorkspaceChange);
    };
  }, []);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = window.setTimeout(() => setSaveMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

  useEffect(() => {
    if (!preferencesMessage) return;
    const timer = window.setTimeout(() => setPreferencesMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [preferencesMessage]);

  const visibleDisplayName = useMemo(
    () =>
      getVisibleWorkspaceName({
        conciergeName: profileDraft.conciergeName,
        workspaceName: workspace?.name,
      }),
    [profileDraft.conciergeName, workspace?.name]
  );
  const heroWorkspaceLabel =
    loading && !workspace ? "Chargement…" : visibleDisplayName || "–";
  const accountCreatedAt = formatDateLabel(account.createdAt);
  const lastSignInAt = formatDateLabel(account.lastSignInAt);
  const storageKey = buildProfileStorageKey(account.id, workspace?.id);
  const preferencesStorageKey = buildPreferencesStorageKey(account.id, workspace?.id);
  const roleLabel = workspace
    ? workspace.owner_user_id === account.id
      ? "Propriétaire du workspace"
      : "Membre du workspace"
    : "Indisponible";
  const statusLabel = account.id ? "Connecté" : "Indisponible";

  const ownerInfo = useMemo(() => {
    if (!workspace?.owner_user_id) return "Indisponible";
    return workspace.owner_user_id.slice(0, 12);
  }, [workspace?.owner_user_id]);

  const brandingInitials = useMemo(
    () => getWorkspaceAvatarLetters(visibleDisplayName),
    [visibleDisplayName]
  );

  useEffect(() => {
    const defaultDraft: OwnerProfileDraft = {
      logoDataUrl: "",
      firstName: account.displayName?.split(" ")[0] ?? "",
      lastName: account.displayName?.split(" ").slice(1).join(" ") ?? "",
      conciergeName: workspace?.name ?? "",
      email: account.email ?? "",
      phone: "",
      jobTitle: roleLabel !== "Indisponible" ? roleLabel : "",
      bio: "",
    };

    if (!storageKey || typeof window === "undefined") {
      setProfileDraft(defaultDraft);
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setProfileDraft(defaultDraft);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<OwnerProfileDraft>;
      setProfileDraft({
        logoDataUrl: typeof parsed.logoDataUrl === "string" ? parsed.logoDataUrl : "",
        firstName: typeof parsed.firstName === "string" ? parsed.firstName : defaultDraft.firstName,
        lastName: typeof parsed.lastName === "string" ? parsed.lastName : defaultDraft.lastName,
        conciergeName:
          typeof parsed.conciergeName === "string"
            ? parsed.conciergeName
            : defaultDraft.conciergeName,
        email: typeof parsed.email === "string" ? parsed.email : defaultDraft.email,
        phone: typeof parsed.phone === "string" ? parsed.phone : "",
        jobTitle:
          typeof parsed.jobTitle === "string" ? parsed.jobTitle : defaultDraft.jobTitle,
        bio: typeof parsed.bio === "string" ? parsed.bio : "",
      });
    } catch (error) {
      console.warn("Failed to load owner profile draft", error);
      setProfileDraft(defaultDraft);
    }
  }, [account.displayName, account.email, roleLabel, storageKey, workspace?.name]);

  useEffect(() => {
    const defaultPreferences: PreferencesDraft = {
      notifications: "",
    };

    if (!preferencesStorageKey || typeof window === "undefined") {
      setPreferencesDraft(defaultPreferences);
      return;
    }

    try {
      const raw = window.localStorage.getItem(preferencesStorageKey);
      if (!raw) {
        setPreferencesDraft(defaultPreferences);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PreferencesDraft & { currency?: string }>;
      setPreferencesDraft({
        notifications:
          typeof parsed.notifications === "string" ? parsed.notifications : "",
      });
    } catch (error) {
      console.warn("Failed to load preferences draft", error);
      setPreferencesDraft(defaultPreferences);
    }
  }, [preferencesStorageKey]);

  function updateProfileField<K extends keyof OwnerProfileDraft>(
    field: K,
    value: OwnerProfileDraft[K]
  ) {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  }

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateProfileField("logoDataUrl", reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSaveProfile() {
    if (!storageKey || typeof window === "undefined") {
      setSaveMessage("Impossible d’enregistrer ce profil pour le moment.");
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(profileDraft));
      window.dispatchEvent(new CustomEvent(NORIXO_OWNER_PROFILE_UPDATED_EVENT));
      setSaveMessage("Profil enregistré.");
    } catch (error) {
      console.warn("Failed to save owner profile draft", error);
      setSaveMessage("Impossible d’enregistrer ce profil pour le moment.");
    }
  }

  function updatePreferencesField<K extends keyof PreferencesDraft>(
    field: K,
    value: PreferencesDraft[K]
  ) {
    setPreferencesDraft((current) => ({ ...current, [field]: value }));
  }

  function handleSavePreferences() {
    if (!preferencesStorageKey || typeof window === "undefined") {
      setPreferencesMessage("Impossible d’enregistrer ces préférences pour le moment.");
      return;
    }

    try {
      window.localStorage.setItem(
        preferencesStorageKey,
        JSON.stringify({ notifications: preferencesDraft.notifications })
      );
      setPreferencesMessage("Préférences enregistrées.");
    } catch (error) {
      console.warn("Failed to save preferences draft", error);
      setPreferencesMessage("Impossible d’enregistrer ces préférences pour le moment.");
    }
  }

  const profileLogoSrc = profileDraft.logoDataUrl || account.avatarUrl || "";
  const profileCoreComplete =
    Boolean(profileDraft.firstName.trim()) &&
    Boolean(profileDraft.lastName.trim()) &&
    Boolean(profileDraft.email.trim()) &&
    Boolean(profileDraft.conciergeName.trim());
  const profilePublicStatusLabel = profileCoreComplete ? "Renseigné" : "À enrichir";
  const bioStatusLabel = profileDraft.bio.trim() ? "Complétée" : "À compléter";
  const logoStatusLabel =
    profileDraft.logoDataUrl || account.avatarUrl ? "Ajouté" : "Non ajouté";
  const spaceStatusLabel = workspace ? "Actif" : "En attente";

  return (
    <div className="space-y-8 text-sm md:space-y-10">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:flex md:items-center md:justify-between md:gap-10 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted text-[11px] font-semibold tracking-[0.22em] text-slate-500">
            WORKSPACE
          </p>
          <h1 className="nk-page-title nk-page-title-dashboard">Paramètres du workspace</h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted max-w-2xl text-[15px] leading-7 text-slate-600">
            Gérez la configuration de votre workspace, vos intégrations et votre environnement
            technique dans une interface claire, pensée pour un usage professionnel.
          </p>
        </div>

        <div className="mt-6 w-full shrink-0 md:mt-0 md:max-w-[340px]">
          <div className="nk-card-soft rounded-2xl border border-slate-200/70 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Workspace actif
                </p>
                <p className="mt-1.5 truncate text-base font-semibold text-slate-900">
                  {heroWorkspaceLabel}
                </p>
              </div>
              <span
                className={
                  workspace
                    ? "inline-flex shrink-0 items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]"
                    : "inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                }
              >
                {workspace ? "Actif" : "En attente"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)] lg:gap-8">
        <div className="nk-card nk-card-hover rounded-2xl p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] md:p-8">
          <div className="border-b border-slate-200/70 pb-5">
            <p className="nk-section-title">Profil du workspace</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              Identité publique et coordonnées
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-600">
              Ces informations alimentent l’affichage de votre marque dans l’app. Elles sont
              mémorisées sur cet appareil jusqu’à enregistrement.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/95 to-white/90 p-5 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-base font-semibold text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                {profileLogoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileLogoSrc}
                    alt="Logo ou avatar du workspace"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  brandingInitials
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-slate-900">
                    {heroWorkspaceLabel}
                  </p>
                  {workspace?.owner_user_id === account.id && (
                    <span className="inline-flex items-center rounded-full border border-orange-200/90 bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-800">
                      Propriétaire
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Marque affichée
                </p>
                <p className="text-[13px] leading-6 text-slate-600">
                  {workspace ? "Conciergerie" : "Indisponible"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex items-center rounded-full border border-slate-300/90 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Téléverser un logo
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Prénom
              </label>
              <input
                type="text"
                value={profileDraft.firstName}
                onChange={(event) => updateProfileField("firstName", event.target.value)}
                placeholder="Non renseigné"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Nom
              </label>
              <input
                type="text"
                value={profileDraft.lastName}
                onChange={(event) => updateProfileField("lastName", event.target.value)}
                placeholder="Non renseigné"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Nom de la conciergerie
              </label>
              <input
                type="text"
                value={profileDraft.conciergeName}
                onChange={(event) => updateProfileField("conciergeName", event.target.value)}
                placeholder="Nom de votre marque ou conciergerie"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                E-mail
              </label>
              <input
                type="email"
                value={profileDraft.email}
                onChange={(event) => updateProfileField("email", event.target.value)}
                placeholder="email@exemple.com"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Téléphone
              </label>
              <input
                type="tel"
                value={profileDraft.phone}
                onChange={(event) => updateProfileField("phone", event.target.value)}
                placeholder="Non renseigné"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Rôle / fonction
              </label>
              <input
                type="text"
                value={profileDraft.jobTitle}
                onChange={(event) => updateProfileField("jobTitle", event.target.value)}
                placeholder="Fonction"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Présentation courte
              </label>
              <textarea
                value={profileDraft.bio}
                onChange={(event) => updateProfileField("bio", event.target.value)}
                placeholder="Décrivez brièvement votre activité ou votre positionnement."
                rows={5}
                className="nk-form-textarea min-h-[140px] resize-y rounded-2xl border-slate-200/90 bg-white/95 text-[15px] leading-7 text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:px-5">
            <p className="text-xs leading-relaxed text-slate-500">
              Les modifications sont enregistrées localement sur cet appareil pour le moment.
            </p>
            <button
              type="button"
              onClick={handleSaveProfile}
              className="nk-primary-btn shrink-0 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] shadow-[0_14px_32px_rgba(15,23,42,0.18)] transition-all duration-200 hover:scale-[1.02] hover:brightness-105"
            >
              Enregistrer les modifications
            </button>
          </div>

          {saveMessage && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/95 px-3.5 py-1.5 text-[11px] font-medium text-emerald-900 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              {saveMessage}
            </div>
          )}

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Statut
              </p>
              <p className="mt-1.5 font-medium text-slate-900">{statusLabel}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Compte créé le
              </p>
              <p className="mt-1.5 font-medium text-slate-900">{accountCreatedAt}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Dernière connexion
              </p>
              <p className="mt-1.5 font-medium text-slate-900">{lastSignInAt}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Réf. propriétaire (ID)
              </p>
              <p className="mt-1.5 font-mono text-[12px] font-medium text-slate-600">{ownerInfo}</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden nk-card nk-card-hover rounded-2xl p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] md:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.55]"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 55% at 100% 0%, rgba(16,185,129,0.07), transparent 55%), radial-gradient(ellipse 70% 50% at 0% 100%, rgba(251,146,60,0.06), transparent 50%)",
            }}
          />
          <div className="relative">
            <div className="border-b border-slate-200/80 pb-5 md:pb-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Synthèse workspace
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                Configuration active
              </h2>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-slate-600">
                Vue rapide des éléments qui structurent votre espace et son niveau de présentation.
              </p>
            </div>

            <div className="nk-card-soft mt-6 rounded-2xl border border-slate-200/65 bg-white/75 px-4 py-3.5 shadow-[0_8px_28px_rgba(15,23,42,0.06)] md:px-5 md:py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800/90">
                Workspace prêt
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">
                {profilePublicStatusLabel === "À enrichir" ||
                bioStatusLabel === "À compléter" ||
                logoStatusLabel === "Non ajouté"
                  ? "Base cohérente — quelques éléments de présentation restent à enrichir."
                  : "Présentation alignée — votre identité visible est complète sur cet appareil."}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/50 to-emerald-50/15 p-4 shadow-[0_6px_22px_rgba(15,23,42,0.05)] md:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Espace
                </p>
                <div className="mt-3">
                  <span
                    className={
                      workspace
                        ? "inline-flex items-center rounded-full border border-emerald-200/90 bg-emerald-50/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
                        : "inline-flex items-center rounded-full border border-slate-200/90 bg-slate-100/90 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-700"
                    }
                  >
                    {spaceStatusLabel}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/50 to-amber-50/10 p-4 shadow-[0_6px_22px_rgba(15,23,42,0.05)] md:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Profil public
                </p>
                <div className="mt-3">
                  <span
                    className={
                      profilePublicStatusLabel === "Renseigné"
                        ? "inline-flex items-center rounded-full border border-emerald-200/85 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
                        : "inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-950 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]"
                    }
                  >
                    {profilePublicStatusLabel}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/50 to-amber-50/10 p-4 shadow-[0_6px_22px_rgba(15,23,42,0.05)] md:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Bio courte
                </p>
                <div className="mt-3">
                  <span
                    className={
                      bioStatusLabel === "Complétée"
                        ? "inline-flex items-center rounded-full border border-emerald-200/85 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
                        : "inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-950 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]"
                    }
                  >
                    {bioStatusLabel}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/50 to-slate-100/40 p-4 shadow-[0_6px_22px_rgba(15,23,42,0.05)] md:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Logo
                </p>
                <div className="mt-3">
                  <span
                    className={
                      logoStatusLabel === "Ajouté"
                        ? "inline-flex items-center rounded-full border border-emerald-200/85 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
                        : "inline-flex items-center rounded-full border border-slate-200/90 bg-slate-100/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-700 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]"
                    }
                  >
                    {logoStatusLabel}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/40 to-sky-50/25 p-4 shadow-[0_6px_22px_rgba(15,23,42,0.05)] sm:col-span-2 md:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Persistance
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-sky-950 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
                    Locale
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200/70 pt-5">
              <p className="text-[13px] leading-relaxed text-slate-600">
                Votre espace est prêt à l’usage. Les derniers éléments visibles à enrichir
                concernent surtout votre présentation de marque.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
