import type { Locale } from "@/data/i18n";

/**
 * Copy of the guest/paywall page `/audit/new` (S5.4-AB). English and French are written; every other locale falls back
 * to English through `useTranslation` (it uses the default locale when a dictionary entry is missing).
 * Amounts, offer codes and plan mapping stay in the page: this file holds only display text.
 * The French entries reproduce the text the page showed before this change.
 */

export type AuditNewErrorCode =
  | "url_incomplete"
  | "url_invalid"
  | "platform_unsupported"
  | "page_unusable"
  | "airbnb_invalid"
  | "airbnb_short_link"
  | "property_type_required"
  | "unknown_error"
  | "session_not_found"
  | "workspace_load_failed"
  | "workspace_not_found"
  | "checkout_unavailable"
  | "checkout_session_unavailable";

type OfferCopy = {
  /** Display name (also used in the checkout button's accessible label). */
  name: string;
  /** Summary label of the "selected offer" banner. */
  summaryLabel: string;
  price: string;
  detail: string;
  note: string;
  listings: string;
};

export type AuditNewCopy = {
  loadingSteps: readonly [string, string, string, string];
  offers: { audit_test: OfferCopy; pack_5: OfferCopy; pack_15: OfferCopy };
  errors: Record<AuditNewErrorCode, string>;
  kicker: string;
  heroTitle: string;
  heroDescription: string;
  modeConnected: string;
  modeGuest: string;
  adminUnlimited: string;
  connectedSaved: string;
  guestInstant: string;
  selectedOffer: string;
  selectedOfferHint: string;
  changeOffer: string;
  formTitle: string;
  formDescription: string;
  urlLabel: string;
  urlPlaceholder: string;
  propertyTypeLabel: string;
  required: string;
  propertyTypeHint: string;
  titleLabel: string;
  titlePlaceholder: string;
  platformDetected: string;
  platformHint: string;
  platformPending: string;
  platformUnknown: string;
  launchBusy: string;
  launch: string;
  submitHintConnected: string;
  submitHintGuest: string;
  analyzesTitle: string;
  analyzesItems: readonly { strong: string; rest: string }[];
  whyGuestTitle: string;
  whyGuestItems: readonly [string, string];
  previewLabel: string;
  blockedTitle: string;
  blockedBody: string;
  valueAvailableTitle: string;
  valueAvailableItems: readonly [string, string, string];
  unlockFull: string;
  quickPreviewNote: string;
  untitledListing: string;
  analyzedAutomatically: string;
  estimated: string;
  losingBookings: string;
  trustPartial: string;
  visibleRating: (rating: string) => string;
  trustUnavailable: string;
  fallbackInsights: readonly [string, string];
  viewAnalyzedListing: string;
  whatYouGetTitle: string;
  whatYouGetBody: string;
  impactVisible: string;
  impactSubWithGain: string;
  impactSubNoGain: string;
  statScoreTitle: string;
  statScoreSub: string;
  statPotentialTitle: string;
  statSignalsTitle: string;
  statSignalsSub: string;
  statActionsTitle: string;
  statActionsSub: string;
  lockedBlock: string;
  locked: string;
  lockedItems: readonly [string, string, string];
  premiumKicker: string;
  premiumHeadingAdmin: string;
  premiumHeadingAuthenticated: string;
  premiumHeadingGuest: string;
  premiumDescriptionAdmin: string;
  premiumDescriptionAuthenticated: string;
  premiumDescriptionGuest: string;
  benefitPartialTitle: string;
  benefitPartialBody: string;
  benefitFullTitleAdmin: string;
  benefitFullTitle: string;
  benefitFullBodyAdmin: string;
  benefitFullBody: string;
  benefitFastTitle: string;
  benefitFastBody: string;
  features: readonly { title: string; body: string }[];
  adminPanelTitle: string;
  adminPanelBody: string;
  adminPanelHelp: string;
  adminPanelOpen: string;
  seenButCompetitors: string;
  fewOptimizations: string;
  offerIncluded: string;
  recommended: string;
  recommendedNote: string;
  closingLine: string;
  immediateAccess: string;
  unlockCta: string;
  unlockAria: (offerName: string) => string;
  alreadyAccount: string;
  trustItems: readonly [string, string, string];
  securePayment: string;
};

const fr: AuditNewCopy = {
  loadingSteps: ["Extraction du logement...", "Recherche des concurrents comparables...", "Analyse IA de l’annonce...", "Préparation de l’aperçu..."],
  offers: {
    audit_test: { name: "Starter", summaryLabel: "Audit unique", price: "9 €", detail: "1 audit ponctuel", note: "Ideal pour tester la valeur du rapport", listings: "1 annonce" },
    pack_5: { name: "Pack 5 audits", summaryLabel: "Pack 5 audits", price: "39 €", detail: "5 audits, soit 7,80 € / audit", note: "Recommande pour comparer plusieurs annonces ou suivre vos optimisations", listings: "5 annonces" },
    pack_15: { name: "Pack 15 audits", summaryLabel: "Pack 15 audits", price: "99 €", detail: "15 audits, soit 6,60 € / audit", note: "Pense pour les usages reguliers ou multi-biens", listings: "15 annonces" },
  },
  errors: {
    url_incomplete: "URL incomplete : merci de coller l'URL publique complete de l'annonce.",
    url_invalid: "URL invalide : cette adresse ne correspond pas a une page d'annonce exploitable.",
    platform_unsupported: "Plateforme non reconnue : seules certaines pages Airbnb / Booking / Vrbo / Agoda sont acceptees.",
    page_unusable: "Page non exploitable : les donnees necessaires n'ont pas pu etre extraites.",
    airbnb_invalid: [
      "Lien non valide. Merci de coller le lien complet de l'annonce Airbnb.",
      "Exemples de liens valides :",
      "https://www.airbnb.com/rooms/12345",
      "https://www.airbnb.fr/rooms/12345",
    ].join("\n"),
    airbnb_short_link: [
      "Lien non valide. Merci de coller le lien complet de l'annonce Airbnb.",
      "Exemples de liens valides :",
      "https://www.airbnb.com/rooms/12345",
      "https://www.airbnb.fr/rooms/12345",
      "Les liens courts Airbnb ne sont pas supportes. Ouvrez l'annonce et copiez l'URL complete depuis votre navigateur.",
    ].join("\n"),
    property_type_required: "Veuillez choisir le type de logement.",
    unknown_error: "Une erreur inconnue est survenue",
    session_not_found: "Session introuvable. Reconnectez-vous puis réessayez.",
    workspace_load_failed: "Impossible de charger votre espace de travail.",
    workspace_not_found: "Workspace introuvable. Réessayez ou ouvrez la page Facturation.",
    checkout_unavailable: "Impossible d'ouvrir le checkout Stripe pour le moment.",
    checkout_session_unavailable: "Session Stripe indisponible, merci de réessayer.",
  },
  kicker: "Lancer un audit",
  heroTitle: "Lancez l’audit de votre annonce",
  heroDescription: "Indiquez l’URL publique de votre annonce. L’audit se lance depuis votre tableau de bord avec un crédit d’audit et produit un rapport avec des recommandations priorisées.",
  modeConnected: "Mode compte connecté",
  modeGuest: "Mode invité",
  adminUnlimited: "Admin plateforme — audits illimités. Les analyses complètes ne sont pas limitées par les crédits ni les quotas depuis le tableau de bord.",
  connectedSaved: "Les audits se lancent depuis votre tableau de bord et y restent accessibles.",
  guestInstant: "Connectez-vous ou créez un compte pour lancer un audit.",
  selectedOffer: "Offre sélectionnée",
  selectedOfferHint: "L’achat se fait depuis la page Facturation ; vous lancez ensuite l’audit depuis votre tableau de bord.",
  changeOffer: "Aller à la facturation",
  formTitle: "Paramètres de l’annonce",
  formDescription: "Utilisez l’URL publique exacte de votre annonce pour générer un audit cohérent, comparable et directement exploitable.",
  urlLabel: "URL de l’annonce",
  urlPlaceholder: "https://www.airbnb.com/rooms/123456789",
  propertyTypeLabel: "Type de logement",
  required: "(obligatoire)",
  propertyTypeHint: "Choisissez le type réel du logement pour obtenir des comparables fiables.",
  titleLabel: "Titre personnalisé (optionnel)",
  titlePlaceholder: "Studio moderne au centre de Guéliz avec balcon",
  platformDetected: "Plateforme détectée",
  platformHint: "Détection automatique depuis l’URL. Cette valeur est verrouillée.",
  platformPending: "Détection en attente",
  platformUnknown: "Non reconnue",
  launchBusy: "Analyse en cours...",
  launch: "Continuer",
  submitHintConnected: "Ouvre votre tableau de bord pour lancer l’audit",
  submitHintGuest: "Vous serez d’abord invité à vous connecter",
  analyzesTitle: "Ce que l’outil analyse",
  analyzesItems: [
    { strong: "Qualité, ordre et lisibilité", rest: "de la galerie photo" },
    { strong: "Clarté de la promesse", rest: "et qualité de la description" },
    { strong: "Positionnement", rest: "de l’annonce face aux offres proches" },
    { strong: "Leviers d’optimisation", rest: "à plus fort impact sur la conversion" },
  ],
  whyGuestTitle: "Comment ça marche",
  whyGuestItems: ["Connectez-vous ou créez un compte.", "Ajoutez votre annonce dans le tableau de bord et lancez l’audit avec un crédit d’audit."],
  previewLabel: "APERÇU DU RÉSULTAT",
  blockedTitle: "Votre annonce est bien visible… mais certaines données avancées sont protégées",
  blockedBody: "Nous avons détecté votre annonce, mais Airbnb limite l'accès à certaines informations détaillées.",
  valueAvailableTitle: "Valeur déjà disponible",
  valueAvailableItems: ["Analyse partielle déjà disponible", "Benchmark complet accessible dans la version complète", "Recommandations personnalisées pour augmenter vos réservations"],
  unlockFull: "Débloquer l’analyse complète",
  quickPreviewNote: "Aperçu rapide affiché pendant l’analyse complète.",
  untitledListing: "Annonce sans titre",
  analyzedAutomatically: "Annonce analysée automatiquement",
  estimated: "Estimé",
  losingBookings: "Vous perdez des réservations chaque semaine",
  trustPartial: "Confiance partielle",
  visibleRating: (rating) => `Note visible : ${rating} / 5`,
  trustUnavailable: "Certaines données de confiance ne sont pas disponibles",
  fallbackInsights: ["Analyse partielle basée sur des signaux visibles.", "Le rapport complet priorise les actions à impact."],
  viewAnalyzedListing: "Voir l’annonce analysée",
  whatYouGetTitle: "Ce que vous allez récupérer",
  whatYouGetBody: "Le rapport complet vous aide à transformer une annonce correcte en annonce qui convertit mieux.",
  impactVisible: "+ visible",
  impactSubWithGain: "Vision rapide du potentiel identifié avant rapport complet",
  impactSubNoGain: "Premiers leviers visibles avant analyse complète",
  statScoreTitle: "Score aperçu",
  statScoreSub: "Première lecture de la qualité visible de votre annonce",
  statPotentialTitle: "Potentiel détecté",
  statSignalsTitle: "Signaux détectés",
  statSignalsSub: "Indices publics visibles récupérés sur l’annonce",
  statActionsTitle: "Actions prioritaires",
  statActionsSub: "Pistes concrètes visibles avant déblocage complet",
  lockedBlock: "Bloc verrouillé",
  locked: "Verrouillé",
  lockedItems: ["Sous-scores détaillés", "Benchmark local complet", "Recommandations actionnables"],
  premiumKicker: "Plan d’action premium",
  premiumHeadingAdmin: "Compte administrateur — aucun paiement requis pour auditer",
  premiumHeadingAuthenticated: "Votre analyse calculée a été retrouvée",
  premiumHeadingGuest: "Débloquez le plan d’action complet de votre annonce",
  premiumDescriptionAdmin: "Utilisez vos annonces dans le dashboard pour lancer des analyses complètes : le gating crédits/quota est désactivé côté serveur pour votre email admin privé.",
  premiumDescriptionAuthenticated: "Nous avons réaffiché votre résultat local sans relancer une analyse complète.",
  premiumDescriptionGuest: "Ce que vous débloquez :",
  benefitPartialTitle: "Analyse partielle visible",
  benefitPartialBody: "Basée sur les signaux publics détectés sur votre annonce.",
  benefitFullTitleAdmin: "Rapport complet sans achat",
  benefitFullTitle: "Rapport complet après paiement",
  benefitFullBodyAdmin: "Depuis vos annonces, un audit utilise le bypass administrativement autorisé.",
  benefitFullBody: "Débloque le plan d’action détaillé.",
  benefitFastTitle: "Un résultat exploitable",
  benefitFastBody: "Une lecture claire et priorisée de ce qu’il faut corriger en premier.",
  features: [
    { title: "Plan d’action complet", body: "Ordre exact des actions à appliquer pour améliorer la conversion." },
    { title: "Priorisation claire", body: "Quoi faire maintenant, quoi faire ensuite, et pourquoi." },
    { title: "Rapport complet actionnable", body: "Au-delà de l’aperçu affiché à gauche." },
    { title: "Suivi historique", body: "Pour suivre vos progrès annonce par annonce." },
  ],
  adminPanelTitle: "Admin plateforme — audits illimités",
  adminPanelBody: "Aucun paiement ni quota requis depuis cette page ou le tableau de bord.",
  adminPanelHelp: "Pour lancer une analyse complète, ajoutez l’URL dans vos annonces et exécutez un audit depuis votre espace habituel — les gardes quotas/crédits sont désactivés côté API pour votre compte administrateur privé uniquement.",
  adminPanelOpen: "Ouvrir mes annonces",
  seenButCompetitors: "Votre annonce est vue… mais vos concurrents convertissent mieux.",
  fewOptimizations: "Quelques optimisations peuvent augmenter vos revenus rapidement.",
  offerIncluded: "Toutes les fonctionnalités incluses. Seule la quantité d’annonces change.",
  recommended: "Recommandé",
  recommendedNote: "Choisi par les hôtes qui veulent maximiser leurs revenus",
  closingLine: "Sans plan d’action clair, vous laissez des réservations à vos concurrents.",
  immediateAccess: "Accès activé une fois le paiement confirmé",
  unlockCta: "Débloquer mes réservations maintenant",
  unlockAria: (offerName) => `Débloquer mes réservations maintenant - ${offerName}`,
  alreadyAccount: "J'ai déjà un compte",
  trustItems: ["Accès une fois le paiement confirmé", "Aucune compétence technique requise", "Un rapport structuré avec des recommandations concrètes"],
  securePayment: "Paiement sécurisé • Sans engagement",
};

const en: AuditNewCopy = {
  loadingSteps: ["Extracting the property...", "Searching for comparable competitors...", "AI analysis of the listing...", "Preparing the preview..."],
  offers: {
    audit_test: { name: "Starter", summaryLabel: "Single audit", price: "€9", detail: "1 one-time audit", note: "Ideal to test the value of the report", listings: "1 listing" },
    pack_5: { name: "5-audit pack", summaryLabel: "5-audit pack", price: "€39", detail: "5 audits, i.e. €7.80 / audit", note: "Recommended to compare several listings or track your optimizations", listings: "5 listings" },
    pack_15: { name: "15-audit pack", summaryLabel: "15-audit pack", price: "€99", detail: "15 audits, i.e. €6.60 / audit", note: "Designed for regular use or multi-property portfolios", listings: "15 listings" },
  },
  errors: {
    url_incomplete: "Incomplete URL: please paste the full public URL of the listing.",
    url_invalid: "Invalid URL: this address does not match a usable listing page.",
    platform_unsupported: "Unrecognized platform: only some Airbnb / Booking / Vrbo / Agoda pages are accepted.",
    page_unusable: "Unusable page: the required data could not be extracted.",
    airbnb_invalid: [
      "Invalid link. Please paste the full link of the Airbnb listing.",
      "Examples of valid links:",
      "https://www.airbnb.com/rooms/12345",
      "https://www.airbnb.fr/rooms/12345",
    ].join("\n"),
    airbnb_short_link: [
      "Invalid link. Please paste the full link of the Airbnb listing.",
      "Examples of valid links:",
      "https://www.airbnb.com/rooms/12345",
      "https://www.airbnb.fr/rooms/12345",
      "Short Airbnb links are not supported. Open the listing and copy the full URL from your browser.",
    ].join("\n"),
    property_type_required: "Please choose the property type.",
    unknown_error: "An unknown error occurred",
    session_not_found: "Session not found. Sign in again, then try again.",
    workspace_load_failed: "Unable to load your workspace.",
    workspace_not_found: "Workspace not found. Try again or open the Billing page.",
    checkout_unavailable: "Unable to open Stripe checkout right now.",
    checkout_session_unavailable: "Stripe session unavailable, please try again.",
  },
  kicker: "Start an audit",
  heroTitle: "Start an audit of your listing",
  heroDescription: "Enter the public URL of your listing. The audit runs from your dashboard with an audit credit and produces a report with prioritized recommendations.",
  modeConnected: "Signed-in mode",
  modeGuest: "Guest mode",
  adminUnlimited: "Platform admin — unlimited audits. Full analyses are not limited by credits or quotas from the dashboard.",
  connectedSaved: "Audits run from your dashboard and stay available there.",
  guestInstant: "Sign in or create an account to run an audit.",
  selectedOffer: "Selected offer",
  selectedOfferHint: "You buy this offer from the Billing page, then launch the audit from your dashboard.",
  changeOffer: "Go to billing",
  formTitle: "Listing settings",
  formDescription: "Use the exact public URL of your listing to generate a consistent, comparable and directly usable audit.",
  urlLabel: "Listing URL",
  urlPlaceholder: "https://www.airbnb.com/rooms/123456789",
  propertyTypeLabel: "Property type",
  required: "(required)",
  propertyTypeHint: "Choose the actual property type to get reliable comparables.",
  titleLabel: "Custom title (optional)",
  titlePlaceholder: "Modern studio in central Guéliz with a balcony",
  platformDetected: "Detected platform",
  platformHint: "Automatic detection from the URL. This value is locked.",
  platformPending: "Detection pending",
  platformUnknown: "Not recognized",
  launchBusy: "Analysis in progress...",
  launch: "Continue",
  submitHintConnected: "Opens your dashboard to launch the audit",
  submitHintGuest: "You will be asked to sign in first",
  analyzesTitle: "What the tool analyzes",
  analyzesItems: [
    { strong: "Quality, order and readability", rest: "of the photo gallery" },
    { strong: "Clarity of the promise", rest: "and quality of the description" },
    { strong: "Positioning", rest: "of the listing against nearby offers" },
    { strong: "Optimization levers", rest: "with the highest impact on conversion" },
  ],
  whyGuestTitle: "How it works",
  whyGuestItems: ["Sign in or create an account.", "Add your listing in the dashboard and launch the audit with an audit credit."],
  previewLabel: "RESULT PREVIEW",
  blockedTitle: "Your listing is clearly visible… but some advanced data is protected",
  blockedBody: "We detected your listing, but Airbnb limits access to some detailed information.",
  valueAvailableTitle: "Value already available",
  valueAvailableItems: ["Partial analysis already available", "Full benchmark available in the full version", "Personalized recommendations to increase your bookings"],
  unlockFull: "Unlock the full analysis",
  quickPreviewNote: "Quick preview shown while the full analysis runs.",
  untitledListing: "Untitled listing",
  analyzedAutomatically: "Automatically analyzed listing",
  estimated: "Estimated",
  losingBookings: "You are losing bookings every week",
  trustPartial: "Partial confidence",
  visibleRating: (rating) => `Visible rating: ${rating} / 5`,
  trustUnavailable: "Some trust data is not available",
  fallbackInsights: ["Partial analysis based on visible signals.", "The full report prioritizes high-impact actions."],
  viewAnalyzedListing: "View the analyzed listing",
  whatYouGetTitle: "What you will get",
  whatYouGetBody: "The full report helps you turn a decent listing into one that converts better.",
  impactVisible: "+ visible",
  impactSubWithGain: "Quick view of the potential identified before the full report",
  impactSubNoGain: "First visible levers before the full analysis",
  statScoreTitle: "Preview score",
  statScoreSub: "First reading of the visible quality of your listing",
  statPotentialTitle: "Detected potential",
  statSignalsTitle: "Detected signals",
  statSignalsSub: "Visible public clues retrieved from the listing",
  statActionsTitle: "Priority actions",
  statActionsSub: "Concrete leads visible before the full unlock",
  lockedBlock: "Locked block",
  locked: "Locked",
  lockedItems: ["Detailed sub-scores", "Complete local benchmark", "Actionable recommendations"],
  premiumKicker: "Premium action plan",
  premiumHeadingAdmin: "Admin account — no payment required to audit",
  premiumHeadingAuthenticated: "Your calculated analysis was found",
  premiumHeadingGuest: "Unlock the full action plan for your listing",
  premiumDescriptionAdmin: "Use your listings in the dashboard to run full analyses: credit/quota gating is disabled server-side for your private admin email.",
  premiumDescriptionAuthenticated: "We redisplayed your local result without rerunning a full analysis.",
  premiumDescriptionGuest: "What you unlock:",
  benefitPartialTitle: "Partial analysis visible",
  benefitPartialBody: "Based on the public signals detected on your listing.",
  benefitFullTitleAdmin: "Full report without purchase",
  benefitFullTitle: "Full report after payment",
  benefitFullBodyAdmin: "From your listings, an audit uses the administratively authorized bypass.",
  benefitFullBody: "Unlocks the detailed action plan.",
  benefitFastTitle: "A result you can act on",
  benefitFastBody: "A clear, prioritized reading of what to fix first.",
  features: [
    { title: "Complete action plan", body: "Exact order of the actions to apply to improve conversion." },
    { title: "Clear prioritization", body: "What to do now, what to do next, and why." },
    { title: "Actionable full report", body: "Beyond the preview shown on the left." },
    { title: "History tracking", body: "To track your progress listing by listing." },
  ],
  adminPanelTitle: "Platform admin — unlimited audits",
  adminPanelBody: "No payment or quota required from this page or the dashboard.",
  adminPanelHelp: "To run a full analysis, add the URL to your listings and run an audit from your usual workspace — quota/credit guards are disabled on the API side for your private admin account only.",
  adminPanelOpen: "Open my listings",
  seenButCompetitors: "Your listing is seen… but your competitors convert better.",
  fewOptimizations: "A few optimizations can increase your revenue quickly.",
  offerIncluded: "All features included. Only the number of listings changes.",
  recommended: "Recommended",
  recommendedNote: "Chosen by hosts who want to maximize their revenue",
  closingLine: "Without a clear action plan, you leave bookings to your competitors.",
  immediateAccess: "Access is activated once your payment is confirmed",
  unlockCta: "Unlock my bookings now",
  unlockAria: (offerName) => `Unlock my bookings now - ${offerName}`,
  alreadyAccount: "I already have an account",
  trustItems: ["Access once your payment is confirmed", "No technical skills required", "A structured report with concrete recommendations"],
  securePayment: "Secure payment • No commitment",
};

/** Dictionary read by `useTranslation`; locales without an entry use English. */
export const auditNewCopy: Partial<Record<Locale, AuditNewCopy>> & { en: AuditNewCopy; fr: AuditNewCopy } = { en, fr };

/** Same fallback rule as `useTranslation`, usable without React. */
export function getAuditNewCopy(locale: string): AuditNewCopy {
  return (auditNewCopy as Record<string, AuditNewCopy | undefined>)[locale] ?? en;
}
