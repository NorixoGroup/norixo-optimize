export type MarketingAiRegistryStatus =
  | "Non connecté"
  | "Simulation UI"
  | "Prévu"
  | "Lecture seule"
  | "Non actif";

export type MarketingAiProvider = {
  name: string;
  type: string;
  scope: string;
  status: MarketingAiRegistryStatus;
};

export type MarketingAiModel = {
  name: string;
  category: "LLM" | "Image" | "Vidéo" | "Voix";
  provider: string;
  usage: string;
  status: MarketingAiRegistryStatus;
};

export type MarketingAiWorkflowStep = {
  name: string;
  role: string;
  input: string;
  output: string;
  status: MarketingAiRegistryStatus;
};

export type MarketingAiSandboxScenario = {
  name: string;
  description: string;
  model: string;
  provider: string;
  status: MarketingAiRegistryStatus;
};

export const MARKETING_AI_PROVIDERS: MarketingAiProvider[] = [
  { name: "OpenAI", type: "LLM", scope: "Contenu, stratégie, analyse", status: "Non connecté" },
  { name: "Anthropic", type: "LLM", scope: "Rédaction longue, contrôle qualité", status: "Non connecté" },
  { name: "Google Gemini", type: "LLM", scope: "Analyse multimodale, recherche", status: "Non connecté" },
  { name: "xAI", type: "LLM", scope: "Analyse temps réel future", status: "Non connecté" },
  { name: "Stability AI", type: "Image", scope: "Génération visuelle", status: "Non connecté" },
  { name: "Fal.ai", type: "Image / Vidéo", scope: "Création média rapide", status: "Non connecté" },
  { name: "Meta Facebook", type: "Publication", scope: "Pages, groupes, campagnes sociales", status: "Non connecté" },
  { name: "Instagram", type: "Publication", scope: "Posts, stories, reels", status: "Non connecté" },
  { name: "LinkedIn", type: "Publication", scope: "Posts professionnels", status: "Non connecté" },
  { name: "X", type: "Publication", scope: "Posts courts et veille", status: "Non connecté" },
  { name: "YouTube", type: "Vidéo", scope: "Publication vidéo future", status: "Non connecté" },
  { name: "Brevo", type: "Email", scope: "Campagnes email et notifications", status: "Non connecté" },
];

export const MARKETING_AI_MODELS: MarketingAiModel[] = [
  { name: "GPT-5.5", category: "LLM", provider: "OpenAI", usage: "Stratégie, contenu, analyse", status: "Non connecté" },
  { name: "GPT-5.5 mini", category: "LLM", provider: "OpenAI", usage: "Tâches rapides et brouillons", status: "Non connecté" },
  { name: "Claude Sonnet", category: "LLM", provider: "Anthropic", usage: "Rédaction longue et QA", status: "Non connecté" },
  { name: "Claude Opus", category: "LLM", provider: "Anthropic", usage: "Raisonnement avancé", status: "Non connecté" },
  { name: "Gemini 2.5 Pro", category: "LLM", provider: "Google", usage: "Analyse multimodale future", status: "Non connecté" },
  { name: "Gemini Flash", category: "LLM", provider: "Google", usage: "Réponses rapides", status: "Non connecté" },
  { name: "Grok", category: "LLM", provider: "xAI", usage: "Veille et analyse temps réel future", status: "Non connecté" },
  { name: "GPT Image", category: "Image", provider: "OpenAI", usage: "Création visuelle marketing", status: "Simulation UI" },
  { name: "Stable Diffusion", category: "Image", provider: "Stability AI", usage: "Variantes visuelles", status: "Non connecté" },
  { name: "Flux", category: "Image", provider: "Black Forest Labs", usage: "Visuels haute qualité", status: "Non connecté" },
  { name: "Ideogram", category: "Image", provider: "Ideogram", usage: "Images avec texte", status: "Non connecté" },
  { name: "Veo", category: "Vidéo", provider: "Google", usage: "Vidéos génératives futures", status: "Non connecté" },
  { name: "Runway", category: "Vidéo", provider: "Runway", usage: "Montage et génération vidéo", status: "Non connecté" },
  { name: "Kling", category: "Vidéo", provider: "Kling AI", usage: "Clips promotionnels", status: "Non connecté" },
  { name: "Pika", category: "Vidéo", provider: "Pika", usage: "Vidéos courtes", status: "Non connecté" },
  { name: "Luma", category: "Vidéo", provider: "Luma AI", usage: "Séquences vidéo réalistes", status: "Non connecté" },
  { name: "OpenAI TTS", category: "Voix", provider: "OpenAI", usage: "Voix off multilingue", status: "Non connecté" },
  { name: "ElevenLabs", category: "Voix", provider: "ElevenLabs", usage: "Voix naturelles et narration", status: "Non connecté" },
];

export const MARKETING_WORKFLOW_STEPS: MarketingAiWorkflowStep[] = [
  {
    name: "Marketing Manager",
    role: "Décision stratégique",
    input: "Objectifs business, contexte produit, priorités",
    output: "Brief stratégique et arbitrages",
    status: "Prévu",
  },
  {
    name: "Campaign",
    role: "Orchestration",
    input: "Brief stratégique",
    output: "Plan de campagne structuré",
    status: "Lecture seule",
  },
  {
    name: "Content",
    role: "Production éditoriale",
    input: "Plan de campagne",
    output: "Contenu source et variations",
    status: "Prévu",
  },
  {
    name: "Localization",
    role: "Adaptation multilingue",
    input: "Contenu source",
    output: "Versions localisées",
    status: "Prévu",
  },
  {
    name: "Image",
    role: "Création visuelle",
    input: "Prompts visuels et guidelines",
    output: "Assets image prêts à valider",
    status: "Non actif",
  },
  {
    name: "Video",
    role: "Création vidéo",
    input: "Storyboard, voix, visuels",
    output: "Vidéo marketing préparée",
    status: "Non actif",
  },
  {
    name: "Publication",
    role: "Diffusion contrôlée",
    input: "Contenus validés",
    output: "Publications planifiées",
    status: "Non actif",
  },
  {
    name: "Analytics",
    role: "Mesure de performance",
    input: "Résultats et signaux",
    output: "Indicateurs et recommandations",
    status: "Lecture seule",
  },
  {
    name: "Learning",
    role: "Amélioration continue",
    input: "Résultats analytics",
    output: "Ajustements futurs",
    status: "Prévu",
  },
];

export const MARKETING_SANDBOX_SCENARIOS: MarketingAiSandboxScenario[] = [
  {
    name: "Génération de contenu",
    description: "Prévisualiser un futur test de création de contenu marketing.",
    model: "GPT-5.5",
    provider: "OpenAI",
    status: "Simulation UI",
  },
  {
    name: "Traduction multilingue",
    description: "Préparer un futur scénario de localisation en plusieurs langues.",
    model: "LLM multilingue",
    provider: "Provider prévu",
    status: "Simulation UI",
  },
  {
    name: "Génération d'image",
    description: "Préparer un futur test de création de visuels pour campagne.",
    model: "GPT Image / Flux",
    provider: "Provider image prévu",
    status: "Simulation UI",
  },
  {
    name: "Génération vidéo",
    description: "Préparer un futur test de storyboard et vidéo courte.",
    model: "Veo / Runway",
    provider: "Provider vidéo prévu",
    status: "Simulation UI",
  },
  {
    name: "Publication sociale",
    description: "Préparer un futur test de diffusion contrôlée sur réseaux sociaux.",
    model: "Publication Agent",
    provider: "Meta / LinkedIn prévu",
    status: "Simulation UI",
  },
  {
    name: "Analyse marketing",
    description: "Préparer un futur test d'analyse de performance et recommandations.",
    model: "Analytics Agent",
    provider: "Sources analytics prévues",
    status: "Simulation UI",
  },
];
