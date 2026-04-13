"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceTeamSection } from "@/components/WorkspaceTeamSection";
import { supabase } from "@/lib/supabase";
import { getCurrentWorkspace } from "@/lib/workspaces/getCurrentWorkspace";

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
  language: string;
  currency: string;
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
  language: "",
  currency: "",
  notifications: "",
};

function buildProfileStorageKey(accountId?: string | null, workspaceId?: string | null) {
  if (!accountId) return null;
  return `settings-owner-profile:${accountId}:${workspaceId ?? "no-workspace"}`;
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

        const currentWorkspace = await getCurrentWorkspace(user.id);

        if (!mounted) return;

        setWorkspace(currentWorkspace);
      } catch (error) {
        console.warn("Failed to load settings data", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSettingsData();

    return () => {
      mounted = false;
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

  const workspaceName = workspace?.name ?? "Non renseigné";
  const workspaceSlug = workspace?.slug ?? "Non renseigné";
  const workspaceIdShort = workspace?.id ? workspace.id.slice(0, 12) : "—";
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

  const brandingInitials = useMemo(() => {
    const source =
      profileDraft.conciergeName ||
      `${profileDraft.firstName} ${profileDraft.lastName}`.trim() ||
      workspace?.name ||
      account.displayName ||
      account.email ||
      "WS";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk.charAt(0).toUpperCase())
      .join("");
  }, [
    account.displayName,
    account.email,
    profileDraft.conciergeName,
    profileDraft.firstName,
    profileDraft.lastName,
    workspace?.name,
  ]);

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
      language: "",
      currency: "",
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

      const parsed = JSON.parse(raw) as Partial<PreferencesDraft>;
      setPreferencesDraft({
        language: typeof parsed.language === "string" ? parsed.language : "",
        currency: typeof parsed.currency === "string" ? parsed.currency : "",
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
      setSaveMessage("Profil enregistre.");
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
      window.localStorage.setItem(preferencesStorageKey, JSON.stringify(preferencesDraft));
      setPreferencesMessage("Préférences enregistrées.");
    } catch (error) {
      console.warn("Failed to save preferences draft", error);
      setPreferencesMessage("Impossible d’enregistrer ces préférences pour le moment.");
    }
  }

  const profileLogoSrc = profileDraft.logoDataUrl || account.avatarUrl || "";
  return (
    <div className="space-y-7 md:space-y-8 text-sm">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-6 py-7 md:px-8 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-2.5">
          <p className="nk-kicker-muted">Workspace</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            Paramètres du workspace
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted text-[15px] leading-7 text-slate-600">
            Gérez la configuration de votre workspace, vos intégrations et votre environnement
            technique dans une interface claire, pensée pour un usage professionnel.
          </p>
        </div>
      </div>

      <div className="nk-card nk-card-hover p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="nk-section-title">Profil du workspace</p>
            <h2 className="mt-2 text-base font-semibold text-slate-900 md:text-lg">
              Identité et informations du propriétaire
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-700">
              Ce workspace est utilisé pour lancer les audits, stocker les résultats et connecter
              vos outils métier.
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200/85 bg-slate-50/95 px-4 py-3 text-[11px] text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.6)_inset] md:mt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">
                {loading ? "Chargement du workspace..." : workspaceName}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {workspace ? "Actif" : "En attente"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-slate-500">ID du workspace</span>
              <span className="break-all rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-50">
                {workspaceIdShort}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-slate-500">Slug</span>
              <span className="break-all rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-50">
                {workspaceSlug}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              ID propriétaire : <span className="font-medium text-slate-800">{ownerInfo}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
        <div className="nk-card nk-card-hover p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
          <p className="nk-section-title">Compte</p>
          <h2 className="mt-2 text-base font-semibold text-slate-900">Identité utilisateur</h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-700">
            Cette section reflète l’utilisateur authentifié et le workspace actif, sans contenu de
            démonstration.
          </p>

          <div className="mt-4 rounded-2xl border border-slate-200/85 bg-slate-50/95 p-4 shadow-[0_10px_22px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.6)_inset]">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700">
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

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-slate-900">
                    {profileDraft.conciergeName || workspaceName}
                  </p>
                  {workspace?.owner_user_id === account.id && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700">
                      Propriétaire
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Marque du workspace
                </p>
                <p className="mt-2 text-[13px] leading-6 text-slate-700">
                  {workspace ? "Conciergerie" : "Indisponible"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
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
                    className="nk-ghost-btn rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  >
                    Upload logo
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Prénom
              </label>
              <input
                type="text"
                value={profileDraft.firstName}
                onChange={(event) => updateProfileField("firstName", event.target.value)}
                placeholder="Non renseigne"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Nom
              </label>
              <input
                type="text"
                value={profileDraft.lastName}
                onChange={(event) => updateProfileField("lastName", event.target.value)}
                placeholder="Non renseigne"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Email
              </label>
              <input
                type="email"
                value={profileDraft.email}
                onChange={(event) => updateProfileField("email", event.target.value)}
                placeholder="email@exemple.com"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Téléphone
              </label>
              <input
                type="tel"
                value={profileDraft.phone}
                onChange={(event) => updateProfileField("phone", event.target.value)}
                placeholder="Non renseigne"
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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

            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Petite description / bio courte
              </label>
              <textarea
                value={profileDraft.bio}
                onChange={(event) => updateProfileField("bio", event.target.value)}
                placeholder="Décrivez brièvement votre activité ou votre positionnement."
                rows={4}
                className="nk-form-textarea resize-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center">
            <p className="text-[11px] text-slate-500">
              Enregistre localement sur cet appareil pour le moment.
            </p>
            <button
              type="button"
              onClick={handleSaveProfile}
              className="nk-primary-btn text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              Save
            </button>
          </div>

          {saveMessage && (
            <p className="mt-3 text-[12px] font-medium text-orange-700">{saveMessage}</p>
          )}

          <div className="mt-4 grid gap-3 text-[13px] md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Statut
              </p>
              <p className="mt-1 font-medium text-slate-900">{statusLabel}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Compte créé le
              </p>
              <p className="mt-1 font-medium text-slate-900">{accountCreatedAt}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Dernière connexion
              </p>
              <p className="mt-1 font-medium text-slate-900">{lastSignInAt}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Identité propriétaire
              </p>
              <p className="mt-1 font-medium text-slate-900">{ownerInfo}</p>
            </div>
          </div>
        </div>

        <WorkspaceTeamSection />
      </div>

      <div className="nk-card nk-card-hover p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
        <p className="nk-section-title">Préférences &amp; configuration</p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Langue
            </p>
            <select
              value={preferencesDraft.language}
              onChange={(event) => updatePreferencesField("language", event.target.value)}
              className="nk-form-select"
            >
              <option value="">Non renseigné</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Choisissez la langue utilisée pour votre espace de travail.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Devise
            </p>
            <select
              value={preferencesDraft.currency}
              onChange={(event) => updatePreferencesField("currency", event.target.value)}
              className="nk-form-select"
            >
              <option value="">Non renseigné</option>
              <option value="EUR">EUR</option>
              <option value="MAD">MAD</option>
              <option value="USD">USD</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Utilisée pour l’affichage des estimations de revenus dans les audits.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Notifications
            </p>
            <select
              value={preferencesDraft.notifications}
              onChange={(event) => updatePreferencesField("notifications", event.target.value)}
              className="nk-form-select"
            >
              <option value="">Non renseigné</option>
              <option value="email_audit_summary">Résumés d’audit par email</option>
              <option value="disabled">Désactivées</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Option prévue pour choisir quels événements déclenchent un email.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center">
          <p className="text-[11px] text-slate-500">
            Les préférences sont enregistrées pour ce workspace sur cet appareil.
          </p>
          <button
            type="button"
            onClick={handleSavePreferences}
            className="nk-primary-btn text-[11px] font-semibold uppercase tracking-[0.16em]"
          >
            Enregistrer
          </button>
        </div>

        {preferencesMessage && (
          <p className="mt-3 text-[12px] font-medium text-orange-700">{preferencesMessage}</p>
        )}
      </div>
    </div>
  );
}
