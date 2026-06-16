"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/components/i18n/useTranslation";
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


const settingsCopy = {
  en: {
    unavailable: "Unavailable",
    loading: "Loading...",
    pageTitle: "Workspace settings",
    pageSubtitle:
      "Manage your workspace configuration, integrations and optimization environment.",
    workspaceProfile: "Workspace profile",
    workspaceSummary: "Workspace summary",
    owner: "Owner",
    workspaceOwner: "Workspace owner",
    workspaceMember: "Workspace member",
    ownerRole: "Owner",
    active: "Active",
    pending: "Pending",
    provided: "Completed",
    enrich: "To enrich",
    concierge: "Property management",
    name: "Name",
    conciergeName: "Property management name",
    conciergePlaceholder: "Your brand or property management name",
    saveChanges: "Save changes",
    activeWorkspace: "Active workspace",
    createdAt: "Account created on",
    workspaceReady: "Workspace ready",
    activeConfiguration: "Active configuration",
    space: "Space",
    publicProfile: "Public profile",
    shortBio: "Short bio",
    persistence: "Persistence",
    connected: "Connected",
    completed: "Completed",
    toComplete: "To complete",
    added: "Added",
    notAdded: "Not added",
    coherentBase: "Coherent base — a few presentation elements still need enrichment.",
    identityComplete: "Aligned presentation — your visible identity is complete on this device.",
    notProvided: "Not provided",
    profileSaved: "Profile saved.",
    profileSaveError: "Unable to save this profile right now.",
    preferencesSaved: "Preferences saved.",
    preferencesSaveError: "Unable to save these preferences right now.",
    activityPlaceholder: "Briefly describe your activity or positioning.",
    publicIdentity: "Public identity and contact details",
    displayedBrand: "Displayed brand",
    uploadLogo: "Upload a logo",
    firstName: "First name",
    phone: "Phone",
    role: "Role / position",
    shortPresentation: "Short presentation",
    lastSignIn: "Last sign-in",
    savedLocallyUntilSave: "stored on this device until saved.",
    localChangesSaved: "Changes are stored locally on this device for now.",
    ownerRef: "Owner ref. (ID)",
    workspaceQuickView: "Quick view of the elements that structure your space and its presentation level.",
    workspaceReadyText: "Your space is ready to use. The last visible elements to enrich mainly concern your brand presentation.",
    emailPlaceholder: "email@example.com",
    rolePlaceholder: "Role",
    logoAlt: "Workspace logo or avatar",
  },
  fr: {
    loading: "Chargement…",
    pageTitle: "Paramètres du workspace",
    pageSubtitle:
      "Gérez la configuration de votre workspace, vos intégrations et votre environnement d’optimisation.",
    workspaceProfile: "Profil du workspace",
    workspaceSummary: "Synthèse du workspace",
    owner: "Propriétaire",
    workspaceOwner: "Propriétaire du workspace",
    workspaceMember: "Membre du workspace",
    ownerRole: "Propriétaire",
    active: "Actif",
    pending: "En attente",
    provided: "Renseigné",
    enrich: "À enrichir",
    concierge: "Conciergerie",
    name: "Nom",
    conciergeName: "Nom de la conciergerie",
    conciergePlaceholder: "Nom de votre marque ou conciergerie",
    saveChanges: "{copy.saveChanges}",
    unavailable: "Indisponible",
    connected: "Connecté",
    activeWorkspace: "Workspace actif",
    createdAt: "Compte créé le",
    workspaceReady: "Workspace prêt",
    activeConfiguration: "Configuration active",
    space: "Espace",
    publicProfile: "Profil public",
    shortBio: "Bio courte",
    persistence: "Persistance",
    completed: "Complétée",
    toComplete: "À compléter",
    added: "Ajouté",
    notAdded: "Non ajouté",
    coherentBase: "Base cohérente — quelques éléments de présentation restent à enrichir.",
    identityComplete: "Présentation alignée — votre identité visible est complète sur cet appareil.",
    notProvided: "Non renseigné",
    profileSaved: "Profil enregistré.",
    profileSaveError: "Impossible d’enregistrer ce profil pour le moment.",
    preferencesSaved: "Préférences enregistrées.",
    preferencesSaveError: "Impossible d’enregistrer ces préférences pour le moment.",
    activityPlaceholder: "Décrivez brièvement votre activité ou votre positionnement.",
    publicIdentity: "Identité publique et coordonnées",
    displayedBrand: "Marque affichée",
    uploadLogo: "Importer un logo",
    firstName: "Prénom",
    phone: "Téléphone",
    role: "Rôle / fonction",
    shortPresentation: "Présentation courte",
    lastSignIn: "Dernière connexion",
    savedLocallyUntilSave: "stockés sur cet appareil jusqu’à l’enregistrement.",
    localChangesSaved: "Les modifications sont pour l’instant enregistrées localement sur cet appareil.",
    ownerRef: "Réf. propriétaire (ID)",
    workspaceQuickView: "Vue rapide des éléments qui structurent votre espace et de son niveau de présentation.",
    workspaceReadyText: "Votre espace est prêt à être utilisé. Les derniers éléments visibles à enrichir concernent surtout la présentation de votre marque.",
    emailPlaceholder: "email@exemple.com",
    rolePlaceholder: "Fonction",
    logoAlt: "Logo ou avatar du workspace",
  },
  es: {
    loading: "Cargando…",
    pageTitle: "Ajustes del espacio de trabajo",
    pageSubtitle:
      "Gestiona la configuración de tu espacio de trabajo, tus integraciones y tu entorno de optimización.",
    workspaceProfile: "Perfil del espacio",
    workspaceSummary: "Resumen del espacio",
    owner: "Propietario",
    workspaceOwner: "Propietario del espacio",
    workspaceMember: "Miembro del espacio",
    ownerRole: "Propietario",
    active: "Activo",
    pending: "Pendiente",
    provided: "Completado",
    enrich: "Por completar",
    concierge: "Gestión de propiedades",
    name: "Nombre",
    conciergeName: "Nombre de la gestoría",
    conciergePlaceholder: "Nombre de tu marca o gestoría",
    saveChanges: "Guardar cambios",
    unavailable: "No disponible",
    connected: "Conectado",
    activeWorkspace: "Workspace activo",
    createdAt: "Cuenta creada el",
    workspaceReady: "Workspace listo",
    activeConfiguration: "Configuración activa",
    space: "Espacio",
    publicProfile: "Perfil público",
    shortBio: "Bio breve",
    persistence: "Persistencia",
    completed: "Completada",
    toComplete: "Por completar",
    added: "Añadido",
    notAdded: "No añadido",
    coherentBase: "Base coherente — algunos elementos de presentación aún deben enriquecerse.",
    identityComplete: "Presentación alineada — tu identidad visible está completa en este dispositivo.",
    notProvided: "No indicado",
    profileSaved: "Perfil guardado.",
    profileSaveError: "No se puede guardar este perfil por el momento.",
    preferencesSaved: "Preferencias guardadas.",
    preferencesSaveError: "No se pueden guardar estas preferencias por el momento.",
    activityPlaceholder: "Describe brevemente tu actividad o posicionamiento.",
    publicIdentity: "Identidad pública y datos de contacto",
    displayedBrand: "Marca mostrada",
    uploadLogo: "Subir un logo",
    firstName: "Nombre",
    phone: "Teléfono",
    role: "Rol / función",
    shortPresentation: "Presentación breve",
    lastSignIn: "Última conexión",
    savedLocallyUntilSave: "guardados en este dispositivo hasta guardar.",
    localChangesSaved: "Los cambios se guardan localmente en este dispositivo por ahora.",
    ownerRef: "Ref. propietario (ID)",
    workspaceQuickView: "Vista rápida de los elementos que estructuran tu espacio y su nivel de presentación.",
    workspaceReadyText: "Tu espacio está listo para usarse. Los últimos elementos visibles a enriquecer se refieren sobre todo a la presentación de tu marca.",
    emailPlaceholder: "email@ejemplo.com",
    rolePlaceholder: "Función",
    logoAlt: "Logo o avatar del espacio",
  },
  de: {
    unavailable: "Nicht verfügbar",
    loading: "Wird geladen…",
    pageTitle: "Workspace-Einstellungen",
    pageSubtitle:
      "Verwalten Sie die Konfiguration Ihres Workspace, Ihre Integrationen und Ihre Optimierungsumgebung.",
    workspaceProfile: "Workspace-Profil",
    workspaceSummary: "Workspace-Übersicht",
    owner: "Eigentümer",
    workspaceOwner: "Eigentümer des Workspace",
    workspaceMember: "Mitglied des Workspace",
    ownerRole: "Eigentümer",
    active: "Aktiv",
    pending: "Ausstehend",
    provided: "Ausgefüllt",
    enrich: "Zu ergänzen",
    concierge: "Hausverwaltung",
    name: "Name",
    conciergeName: "Name der Hausverwaltung",
    conciergePlaceholder: "Name Ihrer Marke oder Hausverwaltung",
    saveChanges: "Änderungen speichern",
    activeWorkspace: "Aktiver Workspace",
    createdAt: "Konto erstellt am",
    workspaceReady: "Workspace bereit",
    activeConfiguration: "Aktive Konfiguration",
    space: "Bereich",
    publicProfile: "Öffentliches Profil",
    shortBio: "Kurzbiografie",
    persistence: "Persistenz",
    connected: "Verbunden",
    completed: "Abgeschlossen",
    toComplete: "Zu vervollständigen",
    added: "Hinzugefügt",
    notAdded: "Nicht hinzugefügt",
    coherentBase: "Stimmige Basis — einige Darstellungselemente müssen noch ergänzt werden.",
    identityComplete: "Abgestimmte Darstellung — Ihre sichtbare Identität ist auf diesem Gerät vollständig.",
    notProvided: "Nicht angegeben",
    profileSaved: "Profil gespeichert.",
    profileSaveError: "Dieses Profil kann derzeit nicht gespeichert werden.",
    preferencesSaved: "Einstellungen gespeichert.",
    preferencesSaveError: "Diese Einstellungen können derzeit nicht gespeichert werden.",
    activityPlaceholder: "Beschreiben Sie kurz Ihre Tätigkeit oder Positionierung.",
    publicIdentity: "Öffentliche Identität und Kontaktdaten",
    displayedBrand: "Angezeigte Marke",
    uploadLogo: "Logo hochladen",
    firstName: "Vorname",
    phone: "Telefon",
    role: "Rolle / Funktion",
    shortPresentation: "Kurze Vorstellung",
    lastSignIn: "Letzte Anmeldung",
    savedLocallyUntilSave: "bis zum Speichern auf diesem Gerät gespeichert.",
    localChangesSaved: "Die Änderungen werden vorerst lokal auf diesem Gerät gespeichert.",
    ownerRef: "Eigentümer-Ref. (ID)",
    workspaceQuickView: "Schnellansicht der Elemente, die Ihren Workspace und dessen Präsentationsniveau strukturieren.",
    workspaceReadyText: "Ihr Workspace ist einsatzbereit. Die letzten sichtbaren Elemente, die noch ergänzt werden sollten, betreffen vor allem die Darstellung Ihrer Marke.",
    emailPlaceholder: "email@beispiel.com",
    rolePlaceholder: "Funktion",
    logoAlt: "Logo oder Avatar des Workspace",
  },
  it: {
    unavailable: "Non disponibile",
    loading: "Caricamento…",
    pageTitle: "Impostazioni del workspace",
    pageSubtitle:
      "Gestisci la configurazione del tuo workspace, le tue integrazioni e il tuo ambiente di ottimizzazione.",
    workspaceProfile: "Profilo del workspace",
    workspaceSummary: "Sintesi del workspace",
    owner: "Proprietario",
    workspaceOwner: "Proprietario del workspace",
    workspaceMember: "Membro del workspace",
    ownerRole: "Proprietario",
    active: "Attivo",
    pending: "In attesa",
    provided: "Compilato",
    enrich: "Da arricchire",
    concierge: "Gestione immobiliare",
    name: "Nome",
    conciergeName: "Nome della gestione immobiliare",
    conciergePlaceholder: "Nome del tuo brand o della tua gestione immobiliare",
    saveChanges: "Salva modifiche",
    activeWorkspace: "Workspace attivo",
    createdAt: "Account creato il",
    workspaceReady: "Workspace pronto",
    activeConfiguration: "Configurazione attiva",
    space: "Spazio",
    publicProfile: "Profilo pubblico",
    shortBio: "Bio breve",
    persistence: "Persistenza",
    connected: "Connesso",
    completed: "Completata",
    toComplete: "Da completare",
    added: "Aggiunto",
    notAdded: "Non aggiunto",
    coherentBase: "Base coerente — alcuni elementi di presentazione devono ancora essere arricchiti.",
    identityComplete: "Presentazione allineata — la tua identità visibile è completa su questo dispositivo.",
    notProvided: "Non fornito",
    profileSaved: "Profilo salvato.",
    profileSaveError: "Impossibile salvare questo profilo al momento.",
    preferencesSaved: "Preferenze salvate.",
    preferencesSaveError: "Impossibile salvare queste preferenze al momento.",
    activityPlaceholder: "Descrivi brevemente la tua attività o il tuo posizionamento.",
    publicIdentity: "Identità pubblica e dati di contatto",
    displayedBrand: "Brand visualizzato",
    uploadLogo: "Carica un logo",
    firstName: "Nome",
    phone: "Telefono",
    role: "Ruolo / funzione",
    shortPresentation: "Presentazione breve",
    lastSignIn: "Ultimo accesso",
    savedLocallyUntilSave: "salvati su questo dispositivo fino al salvataggio.",
    localChangesSaved: "Le modifiche sono per ora salvate localmente su questo dispositivo.",
    ownerRef: "Rif. proprietario (ID)",
    workspaceQuickView: "Vista rapida degli elementi che strutturano il tuo spazio e del suo livello di presentazione.",
    workspaceReadyText: "Il tuo spazio è pronto all’uso. Gli ultimi elementi visibili da arricchire riguardano soprattutto la presentazione del tuo brand.",
    emailPlaceholder: "email@esempio.com",
    rolePlaceholder: "Funzione",
    logoAlt: "Logo o avatar del workspace",
  },
  pt: {
    unavailable: "Indisponível",
    loading: "A carregar…",
    pageTitle: "Definições do workspace",
    pageSubtitle:
      "Gira a configuração do seu workspace, as suas integrações e o seu ambiente de otimização.",
    workspaceProfile: "Perfil do workspace",
    workspaceSummary: "Síntese do workspace",
    owner: "Proprietário",
    workspaceOwner: "Proprietário do workspace",
    workspaceMember: "Membro do workspace",
    ownerRole: "Proprietário",
    active: "Ativo",
    pending: "Pendente",
    provided: "Preenchido",
    enrich: "A enriquecer",
    concierge: "Gestão de propriedades",
    name: "Nome",
    conciergeName: "Nome da gestão de propriedades",
    conciergePlaceholder: "Nome da sua marca ou gestão de propriedades",
    saveChanges: "Guardar alterações",
    activeWorkspace: "Workspace ativo",
    createdAt: "Conta criada em",
    workspaceReady: "Workspace pronto",
    activeConfiguration: "Configuração ativa",
    space: "Espaço",
    publicProfile: "Perfil público",
    shortBio: "Bio curta",
    persistence: "Persistência",
    connected: "Ligado",
    completed: "Completa",
    toComplete: "Por completar",
    added: "Adicionado",
    notAdded: "Não adicionado",
    coherentBase: "Base coerente — alguns elementos de apresentação ainda precisam de ser enriquecidos.",
    identityComplete: "Apresentação alinhada — a sua identidade visível está completa neste dispositivo.",
    notProvided: "Não indicado",
    profileSaved: "Perfil guardado.",
    profileSaveError: "Não é possível guardar este perfil neste momento.",
    preferencesSaved: "Preferências guardadas.",
    preferencesSaveError: "Não é possível guardar estas preferências neste momento.",
    activityPlaceholder: "Descreva brevemente a sua atividade ou posicionamento.",
    publicIdentity: "Identidade pública e contactos",
    displayedBrand: "Marca apresentada",
    uploadLogo: "Importar um logótipo",
    firstName: "Primeiro nome",
    phone: "Telefone",
    role: "Função / cargo",
    shortPresentation: "Apresentação curta",
    lastSignIn: "Último acesso",
    savedLocallyUntilSave: "guardados neste dispositivo até gravar.",
    localChangesSaved: "As alterações estão, por agora, guardadas localmente neste dispositivo.",
    ownerRef: "Ref. proprietário (ID)",
    workspaceQuickView: "Vista rápida dos elementos que estruturam o seu espaço e o seu nível de apresentação.",
    workspaceReadyText: "O seu espaço está pronto a ser utilizado. Os últimos elementos visíveis a enriquecer dizem sobretudo respeito à apresentação da sua marca.",
    emailPlaceholder: "email@exemplo.com",
    rolePlaceholder: "Função",
    logoAlt: "Logótipo ou avatar do workspace",
  },
  nl: {
    unavailable: "Niet beschikbaar",
    loading: "Laden…",
    pageTitle: "Workspace-instellingen",
    pageSubtitle:
      "Beheer de configuratie van je workspace, je integraties en je optimalisatieomgeving.",
    workspaceProfile: "Workspace-profiel",
    workspaceSummary: "Samenvatting van de workspace",
    owner: "Eigenaar",
    workspaceOwner: "Eigenaar van de workspace",
    workspaceMember: "Lid van de workspace",
    ownerRole: "Eigenaar",
    active: "Actief",
    pending: "In behandeling",
    provided: "Ingevuld",
    enrich: "Aan te vullen",
    concierge: "Property management",
    name: "Naam",
    conciergeName: "Naam van het property management",
    conciergePlaceholder: "Naam van je merk of property management",
    saveChanges: "Wijzigingen opslaan",
    activeWorkspace: "Actieve workspace",
    createdAt: "Account aangemaakt op",
    workspaceReady: "Workspace klaar",
    activeConfiguration: "Actieve configuratie",
    space: "Ruimte",
    publicProfile: "Openbaar profiel",
    shortBio: "Korte bio",
    persistence: "Persistentie",
    connected: "Verbonden",
    completed: "Voltooid",
    toComplete: "Aan te vullen",
    added: "Toegevoegd",
    notAdded: "Niet toegevoegd",
    coherentBase: "Samenhangende basis — enkele presentatie-elementen moeten nog worden aangevuld.",
    identityComplete: "Afgestemde presentatie — je zichtbare identiteit is volledig op dit apparaat.",
    notProvided: "Niet opgegeven",
    profileSaved: "Profiel opgeslagen.",
    profileSaveError: "Dit profiel kan momenteel niet worden opgeslagen.",
    preferencesSaved: "Voorkeuren opgeslagen.",
    preferencesSaveError: "Deze voorkeuren kunnen momenteel niet worden opgeslagen.",
    activityPlaceholder: "Beschrijf kort je activiteit of positionering.",
    publicIdentity: "Publieke identiteit en contactgegevens",
    displayedBrand: "Getoond merk",
    uploadLogo: "Logo uploaden",
    firstName: "Voornaam",
    phone: "Telefoon",
    role: "Rol / functie",
    shortPresentation: "Korte presentatie",
    lastSignIn: "Laatste aanmelding",
    savedLocallyUntilSave: "op dit apparaat opgeslagen tot je opslaat.",
    localChangesSaved: "Wijzigingen worden voorlopig lokaal op dit apparaat opgeslagen.",
    ownerRef: "Eigenaar-ref. (ID)",
    workspaceQuickView: "Snel overzicht van de elementen die je ruimte structureren en het presentatieniveau ervan.",
    workspaceReadyText: "Je ruimte is klaar voor gebruik. De laatste zichtbare elementen die nog verrijkt moeten worden, hebben vooral betrekking op de presentatie van je merk.",
    emailPlaceholder: "email@voorbeeld.com",
    rolePlaceholder: "Functie",
    logoAlt: "Logo of avatar van de workspace",
  },
} as const;


function buildProfileStorageKey(accountId?: string | null, workspaceId?: string | null) {
  if (!accountId) return null;
  return buildOwnerProfileStorageKey(accountId, workspaceId ?? "no-workspace");
}

function buildPreferencesStorageKey(accountId?: string | null, workspaceId?: string | null) {
  if (!accountId) return null;
  return `settings-preferences:${accountId}:${workspaceId ?? "no-workspace"}`;
}

function formatDateLabel(value: string | null | undefined, locale: string) {
  if (!value) return "–";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SettingsPage() {
  const { copy, locale } = useTranslation(settingsCopy);
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
    loading && !workspace ? copy.loading : visibleDisplayName || "–";
  const accountCreatedAt = formatDateLabel(account.createdAt, locale);
  const lastSignInAt = formatDateLabel(account.lastSignInAt, locale);
  const storageKey = buildProfileStorageKey(account.id, workspace?.id);
  const preferencesStorageKey = buildPreferencesStorageKey(account.id, workspace?.id);
  const roleLabel = workspace
    ? workspace.owner_user_id === account.id
      ? copy.workspaceOwner
      : copy.workspaceMember
    : copy.unavailable;
  const statusLabel = account.id ? copy.connected : copy.unavailable;

  const ownerInfo = useMemo(() => {
    if (!workspace?.owner_user_id) return copy.unavailable;
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
      jobTitle: roleLabel !== copy.unavailable ? roleLabel : "",
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
      setSaveMessage(copy.profileSaveError);
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(profileDraft));
      window.dispatchEvent(new CustomEvent(NORIXO_OWNER_PROFILE_UPDATED_EVENT));
      setSaveMessage(copy.profileSaved);
    } catch (error) {
      console.warn("Failed to save owner profile draft", error);
      setSaveMessage(copy.profileSaveError);
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
      setPreferencesMessage(copy.preferencesSaveError);
      return;
    }

    try {
      window.localStorage.setItem(
        preferencesStorageKey,
        JSON.stringify({ notifications: preferencesDraft.notifications })
      );
      setPreferencesMessage(copy.preferencesSaved);
    } catch (error) {
      console.warn("Failed to save preferences draft", error);
      setPreferencesMessage(copy.preferencesSaveError);
    }
  }

  const profileLogoSrc = profileDraft.logoDataUrl || account.avatarUrl || "";
  const profileCoreComplete =
    Boolean(profileDraft.firstName.trim()) &&
    Boolean(profileDraft.lastName.trim()) &&
    Boolean(profileDraft.email.trim()) &&
    Boolean(profileDraft.conciergeName.trim());
  const profilePublicStatusLabel = profileCoreComplete ? copy.provided : copy.enrich;
  const bioStatusLabel = profileDraft.bio.trim() ? copy.completed : copy.toComplete;
  const logoStatusLabel =
    profileDraft.logoDataUrl || account.avatarUrl ? copy.added : copy.notAdded;
  const spaceStatusLabel = workspace ? copy.active : copy.pending;

  return (
    <div className="space-y-8 text-sm md:space-y-10">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:flex md:items-center md:justify-between md:gap-10 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-3">
          <p className="nk-kicker-muted text-[11px] font-semibold tracking-[0.22em] text-slate-500">
            WORKSPACE
          </p>
          <h1 className="nk-page-title nk-page-title-dashboard">{copy.pageTitle}</h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted max-w-2xl text-[15px] leading-7 text-slate-600">
            {copy.pageSubtitle}
          </p>
        </div>

        <div className="mt-6 w-full shrink-0 md:mt-0 md:max-w-[340px]">
          <div className="nk-card-soft rounded-2xl border border-slate-200/70 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {copy.activeWorkspace}
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
                {spaceStatusLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)] lg:gap-8">
        <div className="nk-card nk-card-hover rounded-2xl p-6 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset] md:p-8">
          <div className="border-b border-slate-200/70 pb-5">
            <p className="nk-section-title">{copy.workspaceProfile}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {copy.publicIdentity}
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-600">
              {copy.workspaceReadyText}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/95 to-white/90 p-5 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-base font-semibold text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                {profileLogoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileLogoSrc}
                    alt={copy.logoAlt}
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
                      {copy.owner}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.displayedBrand}
                </p>
                <p className="text-[13px] leading-6 text-slate-600">
                  {workspace ? copy.concierge : copy.unavailable}
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
                    {copy.uploadLogo}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.firstName}
              </label>
              <input
                type="text"
                value={profileDraft.firstName}
                onChange={(event) => updateProfileField("firstName", event.target.value)}
                placeholder={copy.notProvided}
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.name}
              </label>
              <input
                type="text"
                value={profileDraft.lastName}
                onChange={(event) => updateProfileField("lastName", event.target.value)}
                placeholder={copy.notProvided}
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.conciergeName}
              </label>
              <input
                type="text"
                value={profileDraft.conciergeName}
                onChange={(event) => updateProfileField("conciergeName", event.target.value)}
                placeholder={copy.conciergePlaceholder}
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
                placeholder={copy.emailPlaceholder}
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.phone}
              </label>
              <input
                type="tel"
                value={profileDraft.phone}
                onChange={(event) => updateProfileField("phone", event.target.value)}
                placeholder={copy.notProvided}
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.role}
              </label>
              <input
                type="text"
                value={profileDraft.jobTitle}
                onChange={(event) => updateProfileField("jobTitle", event.target.value)}
                placeholder={copy.rolePlaceholder}
                className="nk-form-field"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.shortPresentation}
              </label>
              <textarea
                value={profileDraft.bio}
                onChange={(event) => updateProfileField("bio", event.target.value)}
                placeholder={copy.activityPlaceholder}
                rows={5}
                className="nk-form-textarea min-h-[140px] resize-y rounded-2xl border-slate-200/90 bg-white/95 text-[15px] leading-7 text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:px-5">
            <p className="text-xs leading-relaxed text-slate-500">
              {copy.localChangesSaved}
            </p>
            <button
              type="button"
              onClick={handleSaveProfile}
              className="nk-primary-btn shrink-0 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] shadow-[0_14px_32px_rgba(15,23,42,0.18)] transition-all duration-200 hover:scale-[1.02] hover:brightness-105"
            >
              {copy.saveChanges}
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
                {copy.createdAt}
              </p>
              <p className="mt-1.5 font-medium text-slate-900">{accountCreatedAt}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/95 px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.lastSignIn}
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
                {copy.workspaceSummary}
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                {copy.activeConfiguration}
              </h2>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-slate-600">
                {copy.workspaceQuickView}
              </p>
            </div>

            <div className="nk-card-soft mt-6 rounded-2xl border border-slate-200/65 bg-white/75 px-4 py-3.5 shadow-[0_8px_28px_rgba(15,23,42,0.06)] md:px-5 md:py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800/90">
                {copy.workspaceReady}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">
                {profilePublicStatusLabel === copy.enrich ||
                bioStatusLabel === copy.toComplete ||
                logoStatusLabel === copy.notAdded
                  ? copy.coherentBase
                  : copy.identityComplete}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/50 to-emerald-50/15 p-4 shadow-[0_6px_22px_rgba(15,23,42,0.05)] md:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {copy.space}
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
                  {copy.publicProfile}
                </p>
                <div className="mt-3">
                  <span
                    className={
                      profilePublicStatusLabel === copy.provided
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
                  {copy.shortBio}
                </p>
                <div className="mt-3">
                  <span
                    className={
                      bioStatusLabel === copy.completed
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
                      logoStatusLabel === copy.added
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
                  {copy.persistence}
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-sky-950 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
                    {copy.savedLocallyUntilSave}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200/70 pt-5">
              <p className="text-[13px] leading-relaxed text-slate-600">
                {copy.workspaceReadyText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
