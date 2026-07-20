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
    workspaceKicker: "Workspace",
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
    emailLabel: "E-mail",
    statusLabel: "Status",
    logoLabel: "Logo",
    emailPlaceholder: "email@example.com",
    rolePlaceholder: "Role",
    logoAlt: "Workspace logo or avatar",
  },
  fr: {
    loading: "Chargement…",
    pageTitle: "Paramètres du workspace",
    pageSubtitle:
      "Gérez la configuration de votre workspace, vos intégrations et votre environnement d’optimisation.",
    workspaceKicker: "Workspace",
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
    saveChanges: "Enregistrer les modifications",
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
    emailLabel: "E-mail",
    statusLabel: "Statut",
    logoLabel: "Logo",
    emailPlaceholder: "email@exemple.com",
    rolePlaceholder: "Fonction",
    logoAlt: "Logo ou avatar du workspace",
  },
  es: {
    loading: "Cargando…",
    pageTitle: "Ajustes del espacio de trabajo",
    pageSubtitle:
      "Gestiona la configuración de tu espacio de trabajo, tus integraciones y tu entorno de optimización.",
    workspaceKicker: "Espacio de trabajo",
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
    emailLabel: "Correo electrónico",
    statusLabel: "Estado",
    logoLabel: "Logo",
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
    workspaceKicker: "Arbeitsbereich",
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
    emailLabel: "E-Mail",
    statusLabel: "Status",
    logoLabel: "Logo",
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
    workspaceKicker: "Workspace",
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
    emailLabel: "E-mail",
    statusLabel: "Stato",
    logoLabel: "Logo",
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
    workspaceKicker: "Espaço de trabalho",
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
    emailLabel: "E-mail",
    statusLabel: "Estado",
    logoLabel: "Logótipo",
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
    workspaceKicker: "Werkruimte",
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
    emailLabel: "E-mail",
    statusLabel: "Status",
    logoLabel: "Logo",
    emailPlaceholder: "email@voorbeeld.com",
    rolePlaceholder: "Functie",
    logoAlt: "Logo of avatar van de workspace",
  },
  ja: {
    unavailable: "利用不可",
    loading: "読み込み中…",
    pageTitle: "ワークスペース設定",
    pageSubtitle:
      "ワークスペースの設定、連携、最適化環境を管理します。",
    workspaceKicker: "ワークスペース",
    workspaceProfile: "ワークスペースプロフィール",
    workspaceSummary: "ワークスペース概要",
    owner: "所有者",
    workspaceOwner: "ワークスペース所有者",
    workspaceMember: "ワークスペースメンバー",
    ownerRole: "所有者",
    active: "有効",
    pending: "保留中",
    provided: "入力済み",
    enrich: "要補完",
    concierge: "物件管理",
    name: "名前",
    conciergeName: "物件管理名",
    conciergePlaceholder: "ブランド名または物件管理名",
    saveChanges: "変更を保存",
    activeWorkspace: "アクティブなワークスペース",
    createdAt: "アカウント作成日",
    workspaceReady: "ワークスペース準備完了",
    activeConfiguration: "有効な設定",
    space: "スペース",
    publicProfile: "公開プロフィール",
    shortBio: "短い紹介文",
    persistence: "保持状況",
    connected: "接続済み",
    completed: "完了",
    toComplete: "未完了",
    added: "追加済み",
    notAdded: "未追加",
    coherentBase: "整った基盤 — いくつかの表示要素はまだ補完が必要です。",
    identityComplete: "表示内容は整っています — この端末上で公開アイデンティティは完成しています。",
    notProvided: "未入力",
    profileSaved: "プロフィールを保存しました。",
    profileSaveError: "現在このプロフィールを保存できません。",
    preferencesSaved: "設定を保存しました。",
    preferencesSaveError: "現在これらの設定を保存できません。",
    activityPlaceholder: "活動内容やポジショニングを簡単に説明してください。",
    publicIdentity: "公開情報と連絡先",
    displayedBrand: "表示ブランド",
    uploadLogo: "ロゴをアップロード",
    firstName: "名",
    phone: "電話番号",
    role: "役割 / 職種",
    shortPresentation: "短い紹介",
    lastSignIn: "最終ログイン",
    savedLocallyUntilSave: "保存されるまでこの端末にローカル保存されます。",
    localChangesSaved: "変更は現在この端末にローカル保存されています。",
    ownerRef: "所有者参照 (ID)",
    workspaceQuickView: "スペースを構成する要素と表示レベルをすばやく確認できます。",
    workspaceReadyText: "このスペースは利用可能です。補完が必要な最後の表示要素は主にブランド表現に関するものです。",
    emailLabel: "E-mail",
    statusLabel: "ステータス",
    logoLabel: "ロゴ",
    emailPlaceholder: "email@example.com",
    rolePlaceholder: "役割",
    logoAlt: "ワークスペースのロゴまたはアバター",
  },
  zh: {
    unavailable: "不可用",
    loading: "加载中…",
    pageTitle: "工作区设置",
    pageSubtitle:
      "管理你的工作区配置、集成和优化环境。",
    workspaceKicker: "工作区",
    workspaceProfile: "工作区资料",
    workspaceSummary: "工作区摘要",
    owner: "所有者",
    workspaceOwner: "工作区所有者",
    workspaceMember: "工作区成员",
    ownerRole: "所有者",
    active: "已启用",
    pending: "处理中",
    provided: "已填写",
    enrich: "待完善",
    concierge: "物业管理",
    name: "名称",
    conciergeName: "物业管理名称",
    conciergePlaceholder: "你的品牌名或物业管理名称",
    saveChanges: "保存更改",
    activeWorkspace: "当前工作区",
    createdAt: "账户创建于",
    workspaceReady: "工作区已准备就绪",
    activeConfiguration: "当前配置",
    space: "空间",
    publicProfile: "公开资料",
    shortBio: "简短介绍",
    persistence: "保存状态",
    connected: "已连接",
    completed: "已完成",
    toComplete: "待完成",
    added: "已添加",
    notAdded: "未添加",
    coherentBase: "基础结构清晰 —— 仍有一些展示元素需要完善。",
    identityComplete: "展示内容已对齐 —— 你的可见身份信息已在此设备上完整配置。",
    notProvided: "未提供",
    profileSaved: "资料已保存。",
    profileSaveError: "当前无法保存此资料。",
    preferencesSaved: "偏好设置已保存。",
    preferencesSaveError: "当前无法保存这些偏好设置。",
    activityPlaceholder: "简要描述你的业务或定位。",
    publicIdentity: "公开身份与联系方式",
    displayedBrand: "显示品牌",
    uploadLogo: "上传 Logo",
    firstName: "名字",
    phone: "电话",
    role: "角色 / 职位",
    shortPresentation: "简短介绍",
    lastSignIn: "上次登录",
    savedLocallyUntilSave: "在保存前会先存储在此设备上。",
    localChangesSaved: "更改目前暂时保存在此设备本地。",
    ownerRef: "所有者参考 (ID)",
    workspaceQuickView: "快速查看构成你的空间及其展示层级的关键元素。",
    workspaceReadyText: "你的空间已可使用。最后需要完善的可见元素主要与品牌展示有关。",
    emailLabel: "电子邮箱",
    statusLabel: "状态",
    logoLabel: "Logo",
    emailPlaceholder: "email@example.com",
    rolePlaceholder: "职位",
    logoAlt: "工作区 Logo 或头像",
  },
  ko: {
    unavailable: "사용 불가",
    loading: "불러오는 중…",
    pageTitle: "워크스페이스 설정",
    pageSubtitle:
      "워크스페이스 구성, 연동, 최적화 환경을 관리하세요.",
    workspaceKicker: "워크스페이스",
    workspaceProfile: "워크스페이스 프로필",
    workspaceSummary: "워크스페이스 요약",
    owner: "소유자",
    workspaceOwner: "워크스페이스 소유자",
    workspaceMember: "워크스페이스 멤버",
    ownerRole: "소유자",
    active: "활성",
    pending: "대기 중",
    provided: "입력 완료",
    enrich: "보완 필요",
    concierge: "숙소 운영 관리",
    name: "이름",
    conciergeName: "운영 관리 이름",
    conciergePlaceholder: "브랜드명 또는 운영 관리 이름",
    saveChanges: "변경 사항 저장",
    activeWorkspace: "활성 워크스페이스",
    createdAt: "계정 생성일",
    workspaceReady: "워크스페이스 준비 완료",
    activeConfiguration: "활성 구성",
    space: "공간",
    publicProfile: "공개 프로필",
    shortBio: "짧은 소개",
    persistence: "저장 상태",
    connected: "연결됨",
    completed: "완료됨",
    toComplete: "작성 필요",
    added: "추가됨",
    notAdded: "추가되지 않음",
    coherentBase: "기반은 잘 갖춰져 있습니다 — 몇 가지 표시 요소만 더 보완하면 됩니다.",
    identityComplete: "표시 내용이 정렬되었습니다 — 이 기기에서 보이는 정체성이 완성되었습니다.",
    notProvided: "미입력",
    profileSaved: "프로필이 저장되었습니다.",
    profileSaveError: "현재 이 프로필을 저장할 수 없습니다.",
    preferencesSaved: "설정이 저장되었습니다.",
    preferencesSaveError: "현재 이 설정을 저장할 수 없습니다.",
    activityPlaceholder: "활동 내용이나 포지셔닝을 간단히 설명해 주세요.",
    publicIdentity: "공개 정보 및 연락처",
    displayedBrand: "표시 브랜드",
    uploadLogo: "로고 업로드",
    firstName: "이름",
    phone: "전화번호",
    role: "역할 / 직무",
    shortPresentation: "짧은 소개",
    lastSignIn: "마지막 로그인",
    savedLocallyUntilSave: "저장 전까지 이 기기에 로컬로 보관됩니다.",
    localChangesSaved: "변경 사항은 현재 이 기기에 로컬로 저장되어 있습니다.",
    ownerRef: "소유자 참조 (ID)",
    workspaceQuickView: "공간을 구성하는 요소와 현재 표시 수준을 빠르게 확인하세요.",
    workspaceReadyText: "이 공간은 사용할 준비가 되었습니다. 마지막으로 보완할 표시 요소는 주로 브랜드 표현과 관련되어 있습니다.",
    emailLabel: "이메일",
    statusLabel: "상태",
    logoLabel: "로고",
    emailPlaceholder: "email@example.com",
    rolePlaceholder: "직무",
    logoAlt: "워크스페이스 로고 또는 아바타",
  },
  ar: {
    unavailable: "غير متاح",
    loading: "جارٍ التحميل…",
    pageTitle: "إعدادات مساحة العمل",
    pageSubtitle:
      "أدر إعدادات مساحة العمل والتكاملات وبيئة التحسين الخاصة بك.",
    workspaceKicker: "مساحة العمل",
    workspaceProfile: "ملف مساحة العمل",
    workspaceSummary: "ملخص مساحة العمل",
    owner: "المالك",
    workspaceOwner: "مالك مساحة العمل",
    workspaceMember: "عضو مساحة العمل",
    ownerRole: "المالك",
    active: "نشط",
    pending: "قيد الانتظار",
    provided: "مكتمل",
    enrich: "بحاجة إلى إثراء",
    concierge: "إدارة العقارات",
    name: "الاسم",
    conciergeName: "اسم إدارة العقارات",
    conciergePlaceholder: "اسم علامتك التجارية أو اسم إدارة العقارات",
    saveChanges: "حفظ التعديلات",
    activeWorkspace: "مساحة العمل النشطة",
    createdAt: "تم إنشاء الحساب في",
    workspaceReady: "مساحة العمل جاهزة",
    activeConfiguration: "الإعداد النشط",
    space: "المساحة",
    publicProfile: "الملف العام",
    shortBio: "نبذة قصيرة",
    persistence: "الحفظ",
    connected: "متصل",
    completed: "مكتمل",
    toComplete: "بحاجة إلى استكمال",
    added: "تمت الإضافة",
    notAdded: "غير مضاف",
    coherentBase: "قاعدة متماسكة — ما زالت بعض عناصر العرض بحاجة إلى إثراء.",
    identityComplete: "العرض متناسق — هويتك الظاهرة مكتملة على هذا الجهاز.",
    notProvided: "غير مُدخل",
    profileSaved: "تم حفظ الملف.",
    profileSaveError: "يتعذر حفظ هذا الملف حاليًا.",
    preferencesSaved: "تم حفظ التفضيلات.",
    preferencesSaveError: "يتعذر حفظ هذه التفضيلات حاليًا.",
    activityPlaceholder: "صف نشاطك أو تموضعك باختصار.",
    publicIdentity: "الهوية العامة وبيانات الاتصال",
    displayedBrand: "العلامة المعروضة",
    uploadLogo: "رفع شعار",
    firstName: "الاسم الأول",
    phone: "الهاتف",
    role: "الدور / المنصب",
    shortPresentation: "تقديم قصير",
    lastSignIn: "آخر تسجيل دخول",
    savedLocallyUntilSave: "محفوظة محليًا على هذا الجهاز حتى يتم الحفظ.",
    localChangesSaved: "يتم حاليًا حفظ التعديلات محليًا على هذا الجهاز.",
    ownerRef: "مرجع المالك (ID)",
    workspaceQuickView: "عرض سريع للعناصر التي تنظّم مساحتك ومستوى عرضها.",
    workspaceReadyText: "مساحتك جاهزة للاستخدام. آخر العناصر المرئية التي تحتاج إلى إثراء تتعلق أساسًا بطريقة عرض علامتك.",
    emailLabel: "البريد الإلكتروني",
    statusLabel: "الحالة",
    logoLabel: "الشعار",
    emailPlaceholder: "email@example.com",
    rolePlaceholder: "المنصب",
    logoAlt: "شعار أو صورة مساحة العمل",
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
            {copy.workspaceKicker}
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
                {copy.emailLabel}
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
                {copy.statusLabel}
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
                {copy.ownerRef}
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
                  {copy.logoLabel}
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
