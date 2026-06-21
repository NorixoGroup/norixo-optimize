import { readFile } from "node:fs/promises";
import path from "node:path";

type MarketingAiRegistryScenario = {
  id?: unknown;
  campaign?: unknown;
  status?: unknown;
  readiness?: unknown;
};

type MarketingAiDashboardScenario = {
  id: string;
  campaign: string;
  status: string;
  readiness: string;
};

export type MarketingAiAgentSettings = {
  slug:
    | "marketing-brain"
    | "campaign"
    | "content"
    | "localization"
    | "image"
    | "video"
    | "publication"
    | "analytics"
    | "learning";
  name: string;
  description: string;
  role: string;
  nextStep: string;
  provider: string;
  configurationMode: "Lecture seule" | "Simulation UI";
  futureSettings: string[];
  plannedFeatures: string[];
  configurationPreview: Array<{
    label: string;
    value: string;
    type?: "text" | "toggle";
  }>;
};

type MarketingAiRegistryPayload = {
  globalStatus?: unknown;
  summary?: {
    scenarios?: unknown;
    healthy?: unknown;
    warnings?: unknown;
    errors?: unknown;
  };
  scenarios?: MarketingAiRegistryScenario[];
};

export type MarketingAiDashboardData = {
  globalStatus: string;
  scenarios: number;
  healthy: number;
  warnings: number;
  errors: number;
  readyScenario: string;
  readiness: string;
  scenariosList: MarketingAiDashboardScenario[];
  available: boolean;
  message?: string;
};

const DASHBOARD_DATA_PATH = path.join(
  process.cwd(),
  "marketing-agent",
  "dashboard-data",
  "scenario-registry.json"
);

const FALLBACK_DATA: MarketingAiDashboardData = {
  globalStatus: "UNAVAILABLE",
  scenarios: 0,
  healthy: 0,
  warnings: 0,
  errors: 0,
  readyScenario: "UNAVAILABLE",
  readiness: "UNAVAILABLE",
  scenariosList: [],
  available: false,
  message: "Dashboard data unavailable. Run dashboard export.",
};

export const MARKETING_AI_AGENTS: MarketingAiAgentSettings[] = [
  {
    slug: "marketing-brain",
    name: "Marketing Brain",
    description: "Cerveau stratégique du système Marketing IA Norixo.",
    role: "Analyse et stratégie marketing",
    nextStep: "Connecter les vrais providers",
    provider: "Provider stratégique interne prévu",
    configurationMode: "Simulation UI",
    futureSettings: [
      "Objectifs marketing prioritaires",
      "Règles de décision",
      "Priorités par canal",
    ],
    plannedFeatures: [
      "Arbitrage des campagnes",
      "Priorisation des sujets",
      "Boucle de validation humaine",
    ],
    configurationPreview: [
      { label: "Provider", value: "Norixo Strategic Core" },
      { label: "Modèle IA", value: "GPT-5.5" },
      { label: "Température", value: "Auto" },
      { label: "Langue principale", value: "Français" },
      { label: "Exécution automatique", value: "Désactivée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Priorité", value: "Élevée" },
      { label: "Niveau de qualité", value: "Haute qualité" },
    ],
  },
  {
    slug: "campaign",
    name: "Campagne",
    description: "Orchestration des campagnes et découpage en items exécutables.",
    role: "Planification et orchestration des campagnes",
    nextStep: "Générer plusieurs items",
    provider: "Aucun provider externe",
    configurationMode: "Lecture seule",
    futureSettings: [
      "Templates de campagne",
      "Durée par campagne",
      "Ordre de diffusion",
    ],
    plannedFeatures: [
      "Génération multi-items",
      "Calendrier de campagne",
      "Priorisation par objectif",
    ],
    configurationPreview: [
      { label: "Provider", value: "Orchestrateur interne" },
      { label: "Template principal", value: "Lancement produit SaaS" },
      { label: "Langue principale", value: "Français" },
      { label: "Langues supportées", value: "fr, en, es" },
      { label: "Exécution automatique", value: "Désactivée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Priorité", value: "Moyenne" },
      { label: "Limite quotidienne", value: "12 items" },
    ],
  },
  {
    slug: "content",
    name: "Contenu",
    description: "Production du contenu marketing source pour les items de campagne.",
    role: "Génération des contenus marketing",
    nextStep: "Utiliser OpenAI en production",
    provider: "OpenAI prévu",
    configurationMode: "Simulation UI",
    futureSettings: [
      "Choix du modèle",
      "Longueur de contenu",
      "Niveau de variation",
    ],
    plannedFeatures: [
      "Génération réelle du master content",
      "Déclinaisons par plateforme",
      "QA éditoriale étendue",
    ],
    configurationPreview: [
      { label: "Provider", value: "OpenAI" },
      { label: "Modèle IA", value: "GPT-5.5" },
      { label: "Température", value: "0.7" },
      { label: "Langue principale", value: "Français" },
      { label: "Langues supportées", value: "fr, en, es, de" },
      { label: "Exécution automatique", value: "Désactivée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Niveau de qualité", value: "Premium" },
    ],
  },
  {
    slug: "localization",
    name: "Localisation",
    description: "Adaptation multilingue structurée des contenus générés.",
    role: "Adaptation multilingue",
    nextStep: "QA humaine par langue",
    provider: "Provider LLM multilingue prévu",
    configurationMode: "Simulation UI",
    futureSettings: [
      "Locales prioritaires",
      "Règles culturelles",
      "Niveau de validation humaine",
    ],
    plannedFeatures: [
      "Workflow par langue",
      "Contrôle qualité par locale",
      "Plan batch localisations",
    ],
    configurationPreview: [
      { label: "Provider", value: "LLM multilingue Norixo" },
      { label: "Langue source", value: "Français" },
      { label: "Langues supportées", value: "en, es, de, it" },
      { label: "Traduction automatique", value: "Activée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Priorité", value: "Élevée" },
      { label: "Limite quotidienne", value: "24 localisations" },
      { label: "Niveau de qualité", value: "Relecture renforcée" },
    ],
  },
  {
    slug: "image",
    name: "Image",
    description: "Préparation des prompts visuels et pilotage des assets image.",
    role: "Prompts visuels et provider image",
    nextStep: "Brancher un vrai provider image",
    provider: "Mock image actif, provider réel prévu",
    configurationMode: "Simulation UI",
    futureSettings: [
      "Formats cibles",
      "Direction visuelle",
      "Règles overlays",
    ],
    plannedFeatures: [
      "Connexion provider image",
      "Gestion variantes",
      "Validation assets",
    ],
    configurationPreview: [
      { label: "Provider", value: "mock-image / provider réel à brancher" },
      { label: "Modèle IA", value: "Image Model TBD" },
      { label: "Température", value: "N/A" },
      { label: "Langue principale", value: "Français" },
      { label: "Langues supportées", value: "fr, en" },
      { label: "Exécution automatique", value: "Désactivée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Niveau de qualité", value: "Brand-safe" },
    ],
  },
  {
    slug: "video",
    name: "Vidéo",
    description: "Préparation des scripts, storyboards et flux vidéo.",
    role: "Script, storyboard et provider vidéo",
    nextStep: "Brancher un vrai provider vidéo",
    provider: "Mock vidéo actif, provider réel prévu",
    configurationMode: "Simulation UI",
    futureSettings: [
      "Formats vidéo",
      "Voix et sous-titres",
      "Durées cibles",
    ],
    plannedFeatures: [
      "Connexion provider vidéo",
      "Montage guidé",
      "Validation storyboard",
    ],
    configurationPreview: [
      { label: "Provider", value: "mock-video / provider réel à brancher" },
      { label: "Mode vidéo", value: "Storyboard prioritaire" },
      { label: "Durée cible", value: "90 secondes" },
      { label: "Voix", value: "Voix féminine FR" },
      { label: "Sous-titres", value: "Activés", type: "toggle" },
      { label: "Exécution automatique", value: "Désactivée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Niveau de qualité", value: "Studio" },
    ],
  },
  {
    slug: "publication",
    name: "Publication",
    description: "Préparation des publications et des déclinaisons multi-plateformes.",
    role: "Préparation des publications",
    nextStep: "Connecter les plateformes",
    provider: "Mock publication actif, plateformes réelles prévues",
    configurationMode: "Lecture seule",
    futureSettings: [
      "Plateformes actives",
      "Variantes de publication",
      "Fenêtres horaires",
    ],
    plannedFeatures: [
      "Connexion réseaux sociaux",
      "Planification réelle",
      "Statut de diffusion",
    ],
    configurationPreview: [
      { label: "Provider", value: "mock-publication / plateformes réelles" },
      { label: "Plateforme principale", value: "Website" },
      { label: "Langue principale", value: "Français" },
      { label: "Langues supportées", value: "fr, en" },
      { label: "Exécution automatique", value: "Désactivée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Priorité", value: "Planifiée" },
      { label: "Limite quotidienne", value: "8 publications" },
    ],
  },
  {
    slug: "analytics",
    name: "Analytics",
    description: "Collecte et normalisation des métriques de performance.",
    role: "Collecte et normalisation des métriques",
    nextStep: "Connecter les sources réelles",
    provider: "Mock analytics actif, sources réelles prévues",
    configurationMode: "Simulation UI",
    futureSettings: [
      "Sources de données",
      "Fenêtres d'analyse",
      "Métriques prioritaires",
    ],
    plannedFeatures: [
      "Connexion analytics réelle",
      "Normalisation des données",
      "Rapports consolidés",
    ],
    configurationPreview: [
      { label: "Provider", value: "mock-analytics / sources réelles" },
      { label: "Fréquence d'analyse", value: "Toutes les 24h" },
      { label: "Fenêtre temporelle", value: "7 jours glissants" },
      { label: "KPI suivis", value: "CTR, conversions, ROI" },
      { label: "Exécution automatique", value: "Désactivée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Priorité", value: "Moyenne" },
      { label: "Niveau de qualité", value: "Consolidé" },
    ],
  },
  {
    slug: "learning",
    name: "Learning",
    description: "Transformation des résultats en recommandations pilotables.",
    role: "Transformation des résultats en recommandations",
    nextStep: "Activer les signaux réels",
    provider: "Mock learning actif, moteur réel prévu",
    configurationMode: "Simulation UI",
    futureSettings: [
      "Seuils de confiance",
      "Familles de signaux",
      "Règles d'escalade humaine",
    ],
    plannedFeatures: [
      "Détection de signaux réels",
      "Recommandations actionnables",
      "Préparation du feedback vers Marketing Brain",
    ],
    configurationPreview: [
      { label: "Provider", value: "mock-learning / moteur réel" },
      { label: "Modèle IA", value: "Hybride règles + LLM" },
      { label: "Température", value: "0.2" },
      { label: "Langue principale", value: "Français" },
      { label: "Exécution automatique", value: "Désactivée", type: "toggle" },
      { label: "Validation humaine", value: "Activée", type: "toggle" },
      { label: "Priorité", value: "Stratégique" },
      { label: "Niveau de qualité", value: "Explicable" },
    ],
  },
];

export function getMarketingAiAgentBySlug(slug: string) {
  return MARKETING_AI_AGENTS.find((agent) => agent.slug === slug);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function getMarketingAiDashboard(): Promise<MarketingAiDashboardData> {
  try {
    const raw = await readFile(DASHBOARD_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as MarketingAiRegistryPayload;

    const globalStatus = isString(parsed.globalStatus)
      ? parsed.globalStatus
      : FALLBACK_DATA.globalStatus;

    const scenariosCount = isNumber(parsed.summary?.scenarios)
      ? parsed.summary.scenarios
      : 0;
    const healthyCount = isNumber(parsed.summary?.healthy) ? parsed.summary.healthy : 0;
    const warningsCount = isNumber(parsed.summary?.warnings) ? parsed.summary.warnings : 0;
    const errorsCount = isNumber(parsed.summary?.errors) ? parsed.summary.errors : 0;

    const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
    const scenariosList = scenarios
      .filter(
        (
          scenario
        ): scenario is {
          id: string;
          campaign: string;
          status: string;
          readiness: string;
        } =>
          isString(scenario.id) &&
          isString(scenario.campaign) &&
          isString(scenario.status) &&
          isString(scenario.readiness)
      )
      .map((scenario) => ({
        id: scenario.id,
        campaign: scenario.campaign,
        status: scenario.status,
        readiness: scenario.readiness,
      }));

    const readyScenarioEntry =
      scenariosList.find(
        (scenario) =>
          scenario.readiness === "READY FOR REAL PROVIDERS"
      ) ?? scenariosList[0];

    return {
      globalStatus,
      scenarios: scenariosCount,
      healthy: healthyCount,
      warnings: warningsCount,
      errors: errorsCount,
      readyScenario: readyScenarioEntry ? readyScenarioEntry.id : "NONE",
      readiness: readyScenarioEntry ? readyScenarioEntry.readiness : "BLOCKED",
      scenariosList,
      available: true,
    };
  } catch {
    return FALLBACK_DATA;
  }
}
