"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/i18n/useTranslation";
import { useRouter, useSearchParams } from "next/navigation";
import { pricingPlans } from "@/lib/billing/pricingPlans";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import { loadGuestAuditDraft, saveGuestAuditDraft } from "@/lib/guestAuditDraft";
import { resolvePostPaymentState, waitForPostPaymentConfirmation, type PostPaymentState } from "@/lib/billing/postPayment";
import { supabase } from "@/lib/supabase";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { ensureWorkspaceSubscription } from "@/lib/billing/ensureWorkspaceSubscription";
import {
  getBillingUpsellState,
  OFFER_CREDIT_TOTALS,
  type UpsellAction,
} from "@/lib/billing/productStrategy";

type CheckoutResult = { ok: true } | { ok: false; message: string };

const billingCopy = {
  en: {
    checkoutLoading: "Opening payment...",
    heading: "Billing",
    conversionReading: "Listing conversion analysis",
    subtitle:
      "Buy 1, 5 or 15 audit credits whenever you need them. Each purchase adds to your existing balance. One-time payments, no subscription.",
    paymentProcessing:
      "Payment is being validated… your credits will be added once the payment is confirmed.",
    adminUnlimited: "Platform admin — unlimited audits",
    availableCredits: "Available credits",
    averageBookings: "Conversion potential analysis",
    revenueActions: "Identify the actions that generate revenue",
    realDataAnalysis: "Analysis based on your real data",
    recommendedOffer: "Recommended offer",
    mostPopular: "Most popular",
    checking: "Checking...",
    paymentSuccessStarter: "Payment successful. 1 credit has been added.",
    paymentSuccessScale: "Payment successful. Your Scale pack (15 audits) is available.",
    paymentSuccessPro: "Payment successful. Your Pro pack (5 audits) is available.",
    paymentSuccessGeneric: "Payment successful. Your purchase is confirmed.",
    paymentCancelAuditTest: "The test audit payment was canceled. You can try again anytime.",
    paymentCancelStarter: "The Starter pack purchase was canceled. You can try again from this page.",
    paymentCancelScale: "The Scale pack purchase was canceled. You can try again from this page.",
    paymentCancelPro: "The Pro pack purchase was canceled. You can try again from this page.",
    paymentCancelGeneric: "The payment was canceled. You can try again from this page.",
    loginRequired: "You must be signed in to continue.",
    workspaceNotFound: "Workspace not found. Try again later.",
    paymentStartError: "Error while starting payment. Try again later.",
    checkoutOpenStarterError:
      "The Starter pack checkout could not be opened right now. Please try again in a few moments.",
    checkoutOpenProError:
      "The Pro pack checkout could not be opened right now. Please try again in a few moments.",
    checkoutOpenScaleError:
      "The Scale pack checkout could not be opened right now. Please try again in a few moments or contact us if the problem persists.",
    checkoutOpenGenericError:
      "The payment page could not be opened right now. Please try again in a few moments.",
    upsellSoftMessage:
      "Only 2 audits left. You can buy more audit credits at any time.",
    upsellCriticalMessage:
      "Last audit available. You can buy more audit credits whenever you need them.",
    upsellEmptyFreeMessage:
      "You have no credits left. Buy audit credits whenever you need them: Starter (1 audit), Pro (5 audits) or Scale (15 audits). Larger packs cost less per audit.",
    upsellEmptyProMessage:
      "You have no credits left. Buy audit credits whenever you need them: Starter (1 audit), Pro (5 audits) or Scale (15 audits). Larger packs cost less per audit.",
    upsellEmptyScaleMessage:
      "You have no audits left. Buy more audit credits whenever you need them.",
    upsellBalanceText:
      "Balance for new audits: {remaining} credits (not the number of reports already in your history). Each purchase adds to your existing balance.",
    starter: {
      name: "Starter",
      audience: "Best for testing the platform",
      subtitle: "single audit",
      description:
        "Best for a one-off need, but quickly expensive if you audit regularly.",
      bulletOne: "1 audit on the listing of your choice",
      conversionReading: "Listing conversion analysis",
      bulletThree: "Priority recommendations",
      bulletTwo: "One-off purchase",
      cta: "Buy 1 audit",
    },
    pro: {
      name: "Pro",
      subtitle: "5-audit pack (one-time payment)",
      description: "One-time pack, no subscription.",
      bulletOne: "5 audits to use after purchase",
      conversionReading: "Listing conversion analysis",
      cta: "Buy Pro pack (5 audits)",
      audience: "The best balance for comparing several listings",
      savings: "One-time pack, no subscription. Around {unit} per audit, with {savings} saved vs {total} one-off purchases.",
      bulletTwo: "Compare several listings",
      bulletThree: "Clear action prioritization",
      bulletFour: "Fewer one-off purchases, more continuity",
    },
    scale: {
      name: "Scale",
      subtitle: "15-audit pack (one-time payment)",
      description: "One-time pack, no subscription.",
      bulletOne: "15 audits to use after purchase",
      conversionReading: "Listing conversion analysis",
      cta: "Buy Scale pack (15 audits)",
      audience: "Designed for larger portfolios",
      savings: "One-time pack, no subscription. Around {unit} per audit, with {savings} saved vs {total} one-off purchases.",
      bulletTwo: "Optimized unit cost ({reduction}% less than Pro)",
      bulletThree: "Simplified multi-listing tracking",
      bulletFour: "Built for teams and property managers",
    },
    heroTitle: "Choose your audit pack",
    sessionExpired: "Your session has expired. Sign in again and try once more.",
    workspaceBillingNotFound:
      "Workspace or billing profile could not be found. Reload the page or sign in again.",
    workspaceBillingMissing:
      "The billing workspace was not transmitted. Reload the Billing page and try again.",
    paymentServiceUnavailable:
      "The payment service is temporarily unavailable. Please try again later.",
    planLoadingMessage: "Your plan is still loading. Please try again in a moment.",
    paymentValidationHoldMessage:
      "Payment is being validated. Your credits will be added once the payment is confirmed — please wait before making another purchase.",
    paymentAlreadyInProgressMessage:
      "A payment is already in progress. Please wait a few seconds.",
    incompletePaymentResponse: "Incomplete payment response (missing redirect URL).",
    auditTestUnlockedVisible: "Test audit purchased and visible in your audits",
    auditTestUnlocked: "Test audit purchased",
    duplicateAuditUnlockedLocal: "This test audit is already unlocked for this listing.",
    duplicateAuditUnlockedPersisted:
      "This test audit has already been purchased for this listing.",
    behaviorUpsellStarterPurchaseMessage:
      "You buy single audits often. Larger packs cost less per audit: Pro (5 audits, one-time payment). You can still buy any offer at any time.",
    behaviorUpsellHighPaceMessage:
      "Your usage pace is high. Scale (15 audits, one-time payment) costs less per audit, and you can buy any offer at any time.",
    behaviorUpsellScaleDepletedMessage:
      "Your credits are used up. Buy more audit credits whenever you need them.",
    paymentSuccessAuditTest: "Payment successful. Your test audit is now unlocked.",
    viewListings: "View listings",
    behaviorUpsellFooter:
      "Based on your recent usage (balance for new audits: {remaining} credits).",
    behaviorUpsellFooterScaleNote:
      "The button above triggers the same purchase as the Scale card (pack, one-time payment).",
  },
  fr: {
    checkoutLoading: "Ouverture du paiement...",
    heading: "Facturation",
    conversionReading: "Analyse de conversion de l’annonce",
    subtitle:
      "Achetez 1, 5 ou 15 crédits d’audit quand vous en avez besoin. Chaque achat s’ajoute à votre solde existant. Paiements uniques, sans abonnement.",
    paymentProcessing:
      "Paiement en cours de validation… vos crédits seront ajoutés une fois le paiement confirmé.",
    adminUnlimited: "Administrateur de la plateforme — audits illimités",
    availableCredits: "Crédits disponibles",
    averageBookings: "Analyse du potentiel de conversion",
    revenueActions: "Identifiez les actions qui génèrent des revenus",
    realDataAnalysis: "Analyse basée sur vos données réelles",
    recommendedOffer: "Offre recommandée",
    mostPopular: "Le plus populaire",
    checking: "Vérification...",
    paymentSuccessStarter: "Paiement réussi. 1 crédit a été ajouté.",
    paymentSuccessScale: "Paiement réussi. Votre pack Scale (15 audits) est disponible.",
    paymentSuccessPro: "Paiement réussi. Votre pack Pro (5 audits) est disponible.",
    paymentSuccessGeneric: "Paiement réussi. Votre achat est confirmé.",
    paymentCancelAuditTest: "Le paiement de l'audit test a ete annule. Vous pourrez reessayer a tout moment.",
    paymentCancelStarter: "L’achat du pack Starter a été annulé. Vous pouvez réessayer depuis cette page.",
    paymentCancelScale: "L’achat du pack Scale a été annulé. Vous pouvez réessayer depuis cette page.",
    paymentCancelPro: "L’achat du pack Pro a été annulé. Vous pouvez réessayer depuis cette page.",
    paymentCancelGeneric: "Le paiement a été annulé. Vous pouvez réessayer depuis cette page.",
    loginRequired: "Vous devez être connecté pour continuer.",
    workspaceNotFound: "Espace de travail introuvable. Réessayez plus tard.",
    paymentStartError: "Erreur lors du démarrage du paiement. Réessayez plus tard.",
    checkoutOpenStarterError:
      "Le paiement du pack Starter n’a pas pu s’ouvrir pour le moment. Réessayez dans quelques instants.",
    checkoutOpenProError:
      "Le paiement du pack Pro n’a pas pu s’ouvrir pour le moment. Réessayez dans quelques instants.",
    checkoutOpenScaleError:
      "Le paiement du pack Scale n’a pas pu s’ouvrir pour le moment. Réessayez dans quelques instants ou contactez-nous si le problème persiste.",
    checkoutOpenGenericError:
      "Impossible d’ouvrir la page de paiement pour le moment. Réessayez dans quelques instants.",
    upsellSoftMessage:
      "Plus que 2 audits restants. Vous pouvez acheter des crédits d’audit supplémentaires à tout moment.",
    upsellCriticalMessage:
      "Dernier audit disponible. Vous pouvez acheter des crédits d’audit supplémentaires quand vous en avez besoin.",
    upsellEmptyFreeMessage:
      "Vous n’avez plus de crédits. Achetez des crédits d’audit quand vous en avez besoin : Starter (1 audit), Pro (5 audits) ou Scale (15 audits). Les packs plus grands coûtent moins cher par audit.",
    upsellEmptyProMessage:
      "Vous n’avez plus de crédits. Achetez des crédits d’audit quand vous en avez besoin : Starter (1 audit), Pro (5 audits) ou Scale (15 audits). Les packs plus grands coûtent moins cher par audit.",
    upsellEmptyScaleMessage:
      "Vous n’avez plus d’audits disponibles. Achetez des crédits d’audit supplémentaires quand vous en avez besoin.",
    upsellBalanceText:
      "Solde pour de nouveaux audits : {remaining} crédits (et non le nombre de rapports déjà dans l’historique). Chaque achat s’ajoute à votre solde existant.",
    starter: {
      name: "Starter",
      audience: "Idéal pour tester la plateforme",
      subtitle: "audit unique",
      description:
        "Idéal pour un besoin ponctuel, mais vite coûteux si vous auditez régulièrement.",
      bulletOne: "1 audit sur l’annonce de votre choix",
      conversionReading: "Analyse de conversion de l’annonce",
      bulletThree: "Recommandations prioritaires",
      bulletTwo: "Achat unitaire",
      cta: "Acheter 1 audit",
    },
    pro: {
      name: "Pro",
      subtitle: "Pack 5 audits (paiement unique)",
      description: "Pack ponctuel, sans abonnement.",
      bulletOne: "5 audits à utiliser après achat",
      conversionReading: "Analyse de conversion de l’annonce",
      cta: "Acheter le pack Pro (5 audits)",
      audience: "Le meilleur équilibre pour comparer plusieurs annonces",
      savings: "Pack ponctuel, sans abonnement. Soit ~{unit} par audit, avec {savings} € économisés vs {total} achats unitaires.",
      bulletTwo: "Comparaison entre plusieurs annonces",
      bulletThree: "Priorisation claire des actions",
      bulletFour: "Moins de rachats unitaires, plus de continuité",
    },
    scale: {
      name: "Scale",
      subtitle: "Pack 15 audits (paiement unique)",
      description: "Pack ponctuel, sans abonnement.",
      bulletOne: "15 audits à utiliser après achat",
      conversionReading: "Analyse de conversion de l’annonce",
      cta: "Acheter le pack Scale (15 audits)",
      audience: "Pensé pour les portefeuilles plus larges",
      savings: "Pack ponctuel, sans abonnement. Soit ~{unit} par audit, avec {savings} € économisés vs {total} achats unitaires.",
      bulletTwo: "Coût unitaire optimisé ({reduction}% de moins qu’en Pro)",
      bulletThree: "Suivi multi-annonces simplifié",
      bulletFour: "Adapté aux équipes et conciergeries",
    },
    heroTitle: "Choisissez votre pack d’audits",
    sessionExpired: "Votre session a expiré. Reconnectez-vous puis réessayez.",
    workspaceBillingNotFound:
      "Espace de travail ou facturation introuvable. Rechargez la page ou reconnectez-vous.",
    workspaceBillingMissing:
      "L’espace de travail de facturation n’a pas été transmis. Rechargez la page Facturation et réessayez.",
    paymentServiceUnavailable:
      "Le service de paiement est momentanément indisponible. Réessayez plus tard.",
    planLoadingMessage: "Chargement du plan en cours. Réessayez dans un instant.",
    paymentValidationHoldMessage:
      "Paiement en cours de validation. Vos crédits seront ajoutés une fois le paiement confirmé — patientez avant un nouvel achat.",
    paymentAlreadyInProgressMessage:
      "Un paiement est déjà en cours. Patientez quelques secondes.",
    incompletePaymentResponse:
      "Réponse de paiement incomplète (URL de redirection manquante).",
    auditTestUnlockedVisible: "Audit test acheté et visible dans vos audits",
    auditTestUnlocked: "Audit test acheté",
    duplicateAuditUnlockedLocal:
      "Cet audit test est déjà débloqué pour cette annonce.",
    duplicateAuditUnlockedPersisted:
      "Cet audit test a déjà été acheté pour cette annonce.",
    behaviorUpsellStarterPurchaseMessage:
      "Vous achetez souvent des audits unitaires. Les packs plus grands coûtent moins cher par audit : Pro (5 audits, paiement unique). Vous pouvez acheter n’importe quelle offre à tout moment.",
    behaviorUpsellHighPaceMessage:
      "Votre cadence est élevée. Scale (15 audits, paiement unique) coûte moins cher par audit, et vous pouvez acheter n’importe quelle offre à tout moment.",
    behaviorUpsellScaleDepletedMessage:
      "Vos crédits sont épuisés. Achetez des crédits d’audit supplémentaires quand vous en avez besoin.",
    paymentSuccessAuditTest:
      "Paiement réussi. Votre audit test est maintenant débloqué.",
    viewListings: "Voir les annonces",
    behaviorUpsellFooter:
      "Selon votre utilisation récente (solde pour de nouveaux audits : {remaining} crédits).",
    behaviorUpsellFooterScaleNote:
      "Le bouton ci-dessus déclenche le même achat que sur la carte Scale (pack, paiement unique).",
  },
  es: {
    checkoutLoading: "Abriendo el pago...",
    heading: "Facturación",
    conversionReading: "Análisis de conversión del anuncio",
    subtitle:
      "Compra 1, 5 o 15 créditos de auditoría cuando los necesites. Cada compra se suma a tu saldo existente. Pagos únicos, sin suscripción.",
    paymentProcessing:
      "Pago en validación… tus créditos se añadirán cuando se confirme el pago.",
    adminUnlimited: "Admin plataforma — auditorías ilimitadas",
    availableCredits: "Créditos disponibles",
    averageBookings: "Análisis del potencial de conversión",
    revenueActions: "Identifica las acciones que generan ingresos",
    realDataAnalysis: "Análisis basado en tus datos reales",
    recommendedOffer: "Oferta recomendada",
    mostPopular: "Más popular",
    checking: "Verificación...",
    paymentSuccessStarter: "Pago realizado. Se ha añadido 1 crédito.",
    paymentSuccessScale: "Pago realizado. Tu pack Scale (15 auditorías) está disponible.",
    paymentSuccessPro: "Pago realizado. Tu pack Pro (5 auditorías) está disponible.",
    paymentSuccessGeneric: "Pago realizado. Tu compra está confirmada.",
    paymentCancelAuditTest: "El pago de la auditoría de prueba fue cancelado. Puedes intentarlo de nuevo en cualquier momento.",
    paymentCancelStarter: "La compra del pack Starter fue cancelada. Puedes intentarlo de nuevo desde esta página.",
    paymentCancelScale: "La compra del pack Scale fue cancelada. Puedes intentarlo de nuevo desde esta página.",
    paymentCancelPro: "La compra del pack Pro fue cancelada. Puedes intentarlo de nuevo desde esta página.",
    paymentCancelGeneric: "El pago fue cancelado. Puedes intentarlo de nuevo desde esta página.",
    loginRequired: "Debes iniciar sesión para continuar.",
    workspaceNotFound: "Espacio de trabajo no encontrado. Inténtalo más tarde.",
    paymentStartError: "Error al iniciar el pago. Inténtalo más tarde.",
    checkoutOpenStarterError:
      "No se pudo abrir el pago del pack Starter por el momento. Vuelve a intentarlo en unos instantes.",
    checkoutOpenProError:
      "No se pudo abrir el pago del pack Pro por el momento. Vuelve a intentarlo en unos instantes.",
    checkoutOpenScaleError:
      "No se pudo abrir el pago del pack Scale por el momento. Vuelve a intentarlo en unos instantes o contáctanos si el problema persiste.",
    checkoutOpenGenericError:
      "No se pudo abrir la página de pago por el momento. Vuelve a intentarlo en unos instantes.",
    upsellSoftMessage:
      "Solo te quedan 2 auditorías. Puedes comprar más créditos de auditoría en cualquier momento.",
    upsellCriticalMessage:
      "Última auditoría disponible. Puedes comprar más créditos de auditoría cuando los necesites.",
    upsellEmptyFreeMessage:
      "Ya no te quedan créditos. Compra créditos de auditoría cuando los necesites: Starter (1 auditoría), Pro (5 auditorías) o Scale (15 auditorías). Los packs más grandes cuestan menos por auditoría.",
    upsellEmptyProMessage:
      "Ya no te quedan créditos. Compra créditos de auditoría cuando los necesites: Starter (1 auditoría), Pro (5 auditorías) o Scale (15 auditorías). Los packs más grandes cuestan menos por auditoría.",
    upsellEmptyScaleMessage:
      "Ya no tienes auditorías disponibles. Compra más créditos de auditoría cuando los necesites.",
    upsellBalanceText:
      "Saldo para nuevas auditorías: {remaining} créditos (no el número de informes ya presentes en tu historial). Cada compra se suma a tu saldo existente.",
    starter: {
      name: "Starter",
      audience: "Ideal para probar la plataforma",
      subtitle: "auditoría única",
      description:
        "Ideal para una necesidad puntual, pero se vuelve caro si auditas con frecuencia.",
      bulletOne: "1 auditoría sobre el anuncio que elijas",
      conversionReading: "Análisis de conversión del anuncio",
      bulletThree: "Recomendaciones prioritarias",
      bulletTwo: "Compra unitaria",
      cta: "Comprar 1 auditoría",
    },
    pro: {
      name: "Pro",
      subtitle: "Pack de 5 auditorías (pago único)",
      description: "Pack puntual, sin suscripción.",
      bulletOne: "5 auditorías para usar después de la compra",
      conversionReading: "Análisis de conversión del anuncio",
      cta: "Comprar pack Pro (5 auditorías)",
      audience: "El mejor equilibrio para comparar varios anuncios",
      savings: "Pack puntual, sin suscripción. Aproximadamente {unit} por auditoría, con {savings} € ahorrados frente a {total} compras unitarias.",
      bulletTwo: "Comparación entre varios anuncios",
      bulletThree: "Priorización clara de acciones",
      bulletFour: "Menos compras unitarias, más continuidad",
    },
    scale: {
      name: "Scale",
      subtitle: "Pack de 15 auditorías (pago único)",
      description: "Pack puntual, sin suscripción.",
      bulletOne: "15 auditorías para usar después de la compra",
      conversionReading: "Análisis de conversión del anuncio",
      cta: "Comprar pack Scale (15 auditorías)",
      audience: "Diseñado para portafolios más amplios",
      savings: "Pack puntual, sin suscripción. Aproximadamente {unit} por auditoría, con {savings} € ahorrados frente a {total} compras unitarias.",
      bulletTwo: "Coste unitario optimizado ({reduction}% menos que Pro)",
      bulletThree: "Seguimiento multi-anuncio simplificado",
      bulletFour: "Pensado para equipos y gestores de propiedades",
    },
    heroTitle: "Elige tu pack de auditorías",
    sessionExpired:
      "Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.",
    workspaceBillingNotFound:
      "No se pudo encontrar el espacio de trabajo o la facturación. Recarga la página o vuelve a iniciar sesión.",
    workspaceBillingMissing:
      "No se transmitió el espacio de trabajo de facturación. Recarga la página de Facturación e inténtalo de nuevo.",
    paymentServiceUnavailable:
      "El servicio de pago está temporalmente no disponible. Inténtalo más tarde.",
    planLoadingMessage:
      "Tu plan todavía se está cargando. Inténtalo de nuevo en un momento.",
    paymentValidationHoldMessage:
      "El pago se está validando. Tus créditos se añadirán cuando se confirme el pago; espera antes de hacer otra compra.",
    paymentAlreadyInProgressMessage:
      "Ya hay un pago en curso. Espera unos segundos.",
    incompletePaymentResponse:
      "Respuesta de pago incompleta (falta la URL de redirección).",
    auditTestUnlockedVisible:
      "Auditoría de prueba comprada y visible en tus auditorías",
    auditTestUnlocked: "Auditoría de prueba comprada",
    duplicateAuditUnlockedLocal:
      "Esta auditoría de prueba ya está desbloqueada para este anuncio.",
    duplicateAuditUnlockedPersisted:
      "Esta auditoría de prueba ya se compró para este anuncio.",
    behaviorUpsellStarterPurchaseMessage:
      "Compras auditorías individuales con frecuencia. Los packs más grandes cuestan menos por auditoría: Pro (5 auditorías, pago único). Puedes comprar cualquier oferta en cualquier momento.",
    behaviorUpsellHighPaceMessage:
      "Tu ritmo de uso es alto. Scale (15 auditorías, pago único) cuesta menos por auditoría, y puedes comprar cualquier oferta en cualquier momento.",
    behaviorUpsellScaleDepletedMessage:
      "Tus créditos se han agotado. Compra más créditos de auditoría cuando los necesites.",
    paymentSuccessAuditTest:
      "Pago realizado. Tu auditoría de prueba ya está desbloqueada.",
    viewListings: "Ver anuncios",
    behaviorUpsellFooter:
      "Según tu uso reciente (saldo para nuevas auditorías: {remaining} créditos).",
    behaviorUpsellFooterScaleNote:
      "El botón de arriba activa la misma compra que la tarjeta Scale (pack, pago único).",
  },
  de: {
    checkoutLoading: "Zahlung wird geöffnet...",
    heading: "Abrechnung",
    conversionReading: "Conversion-Analyse des Inserats",
    subtitle:
      "Kaufe 1, 5 oder 15 Audit-Credits, wann immer du sie brauchst. Jeder Kauf wird deinem bestehenden Guthaben hinzugefügt. Einmalzahlungen, kein Abonnement.",
    paymentProcessing:
      "Die Zahlung wird bestätigt… deine Credits werden hinzugefügt, sobald die Zahlung bestätigt ist.",
    adminUnlimited: "Plattform-Administrator — unbegrenzte Audits",
    availableCredits: "Verfügbare Credits",
    averageBookings: "+20 % mehr Buchungen im Durchschnitt",
    revenueActions: "Identifiziere die Maßnahmen, die Umsatz generieren",
    realDataAnalysis: "Analyse auf Basis deiner echten Daten",
    recommendedOffer: "Empfohlenes Angebot",
    mostPopular: "Am beliebtesten",
    checking: "Überprüfung...",
    paymentSuccessStarter: "Zahlung erfolgreich. 1 Credit wurde hinzugefügt.",
    paymentSuccessScale: "Zahlung erfolgreich. Dein Scale-Paket (15 Audits) ist verfügbar.",
    paymentSuccessPro: "Zahlung erfolgreich. Dein Pro-Paket (5 Audits) ist verfügbar.",
    paymentSuccessGeneric: "Zahlung erfolgreich. Dein Kauf wurde bestätigt.",
    paymentCancelAuditTest: "Die Zahlung für das Test-Audit wurde abgebrochen. Du kannst es jederzeit erneut versuchen.",
    paymentCancelStarter: "Der Kauf des Starter-Pakets wurde abgebrochen. Du kannst es auf dieser Seite erneut versuchen.",
    paymentCancelScale: "Der Kauf des Scale-Pakets wurde abgebrochen. Du kannst es auf dieser Seite erneut versuchen.",
    paymentCancelPro: "Der Kauf des Pro-Pakets wurde abgebrochen. Du kannst es auf dieser Seite erneut versuchen.",
    paymentCancelGeneric: "Die Zahlung wurde abgebrochen. Du kannst es auf dieser Seite erneut versuchen.",
    loginRequired: "Du musst angemeldet sein, um fortzufahren.",
    workspaceNotFound: "Arbeitsbereich nicht gefunden. Versuche es später erneut.",
    paymentStartError: "Fehler beim Starten der Zahlung. Versuche es später erneut.",
    checkoutOpenStarterError:
      "Die Zahlung für das Starter-Paket konnte im Moment nicht geöffnet werden. Bitte versuche es in wenigen Augenblicken erneut.",
    checkoutOpenProError:
      "Die Zahlung für das Pro-Paket konnte im Moment nicht geöffnet werden. Bitte versuche es in wenigen Augenblicken erneut.",
    checkoutOpenScaleError:
      "Die Zahlung für das Scale-Paket konnte im Moment nicht geöffnet werden. Bitte versuche es in wenigen Augenblicken erneut oder kontaktiere uns, wenn das Problem bestehen bleibt.",
    checkoutOpenGenericError:
      "Die Zahlungsseite konnte im Moment nicht geöffnet werden. Bitte versuche es in wenigen Augenblicken erneut.",
    upsellSoftMessage:
      "Nur noch 2 Audits verfügbar. Du kannst jederzeit weitere Audit-Credits kaufen.",
    upsellCriticalMessage:
      "Letztes Audit verfügbar. Du kannst weitere Audit-Credits kaufen, wann immer du sie brauchst.",
    upsellEmptyFreeMessage:
      "Du hast keine Credits mehr. Kaufe Audit-Credits, wann immer du sie brauchst: Starter (1 Audit), Pro (5 Audits) oder Scale (15 Audits). Größere Pakete kosten pro Audit weniger.",
    upsellEmptyProMessage:
      "Du hast keine Credits mehr. Kaufe Audit-Credits, wann immer du sie brauchst: Starter (1 Audit), Pro (5 Audits) oder Scale (15 Audits). Größere Pakete kosten pro Audit weniger.",
    upsellEmptyScaleMessage:
      "Du hast keine Audits mehr verfügbar. Kaufe weitere Audit-Credits, wann immer du sie brauchst.",
    upsellBalanceText:
      "Guthaben für neue Audits: {remaining} Credits (nicht die Anzahl der Berichte, die bereits im Verlauf vorhanden sind). Jeder Kauf wird deinem bestehenden Guthaben hinzugefügt.",
    starter: {
      name: "Starter",
      audience: "Ideal zum Testen der Plattform",
      subtitle: "einzelnes Audit",
      description:
        "Ideal für einen einmaligen Bedarf, aber schnell teuer, wenn du regelmäßig Audits durchführst.",
      bulletOne: "1 Audit für das Inserat deiner Wahl",
      conversionReading: "Conversion-Analyse des Inserats",
      bulletThree: "Priorisierte Empfehlungen",
      bulletTwo: "Einzelkauf",
      cta: "1 Audit kaufen",
    },
    pro: {
      name: "Pro",
      subtitle: "5-Audit-Paket (Einmalzahlung)",
      description: "Einmaliges Paket, kein Abonnement.",
      bulletOne: "5 Audits zur Nutzung nach dem Kauf",
      conversionReading: "Conversion-Analyse des Inserats",
      cta: "Pro-Paket kaufen (5 Audits)",
      audience: "Die beste Balance zum Vergleichen mehrerer Inserate",
      savings: "Einmaliges Paket, kein Abonnement. Etwa {unit} pro Audit, mit {savings} € Ersparnis gegenüber {total} Einzelkäufen.",
      bulletTwo: "Vergleich mehrerer Inserate",
      bulletThree: "Klare Priorisierung der Maßnahmen",
      bulletFour: "Weniger Einzelkäufe, mehr Kontinuität",
    },
    scale: {
      name: "Scale",
      subtitle: "15-Audit-Paket (Einmalzahlung)",
      description: "Einmaliges Paket, kein Abonnement.",
      bulletOne: "15 Audits zur Nutzung nach dem Kauf",
      conversionReading: "Conversion-Analyse des Inserats",
      cta: "Scale-Paket kaufen (15 Audits)",
      audience: "Entwickelt für größere Portfolios",
      savings: "Einmaliges Paket, kein Abonnement. Etwa {unit} pro Audit, mit {savings} € Ersparnis gegenüber {total} Einzelkäufen.",
      bulletTwo: "Optimierte Stückkosten ({reduction}% weniger als Pro)",
      bulletThree: "Vereinfachtes Multi-Listing-Tracking",
      bulletFour: "Für Teams und Property Manager entwickelt",
    },
    heroTitle: "Wähle dein Audit-Paket",
    sessionExpired:
      "Deine Sitzung ist abgelaufen. Melde dich erneut an und versuche es noch einmal.",
    workspaceBillingNotFound:
      "Arbeitsbereich oder Abrechnungsprofil konnten nicht gefunden werden. Lade die Seite neu oder melde dich erneut an.",
    workspaceBillingMissing:
      "Der Abrechnungs-Arbeitsbereich wurde nicht übermittelt. Lade die Abrechnungsseite neu und versuche es erneut.",
    paymentServiceUnavailable:
      "Der Zahlungsdienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.",
    planLoadingMessage:
      "Dein Tarif wird noch geladen. Bitte versuche es gleich noch einmal.",
    paymentValidationHoldMessage:
      "Die Zahlung wird bestätigt. Deine Credits werden hinzugefügt, sobald die Zahlung bestätigt ist — warte bitte, bevor du einen weiteren Kauf startest.",
    paymentAlreadyInProgressMessage:
      "Eine Zahlung ist bereits im Gange. Bitte warte ein paar Sekunden.",
    incompletePaymentResponse:
      "Unvollständige Zahlungsantwort (Weiterleitungs-URL fehlt).",
    auditTestUnlockedVisible:
      "Test-Audit gekauft und in deinen Audits sichtbar",
    auditTestUnlocked: "Test-Audit gekauft",
    duplicateAuditUnlockedLocal:
      "Dieses Test-Audit ist für dieses Inserat bereits freigeschaltet.",
    duplicateAuditUnlockedPersisted:
      "Dieses Test-Audit wurde für dieses Inserat bereits gekauft.",
    behaviorUpsellStarterPurchaseMessage:
      "Du kaufst häufig Einzel-Audits. Größere Pakete kosten pro Audit weniger: Pro (5 Audits, Einmalzahlung). Du kannst jederzeit jedes Angebot kaufen.",
    behaviorUpsellHighPaceMessage:
      "Dein Nutzungstempo ist hoch. Scale (15 Audits, Einmalzahlung) kostet pro Audit weniger, und du kannst jederzeit jedes Angebot kaufen.",
    behaviorUpsellScaleDepletedMessage:
      "Deine Credits sind aufgebraucht. Kaufe weitere Audit-Credits, wann immer du sie brauchst.",
    paymentSuccessAuditTest:
      "Zahlung erfolgreich. Dein Test-Audit ist jetzt freigeschaltet.",
    viewListings: "Inserate ansehen",
    behaviorUpsellFooter:
      "Basierend auf deiner letzten Nutzung (Guthaben für neue Audits: {remaining} Credits).",
    behaviorUpsellFooterScaleNote:
      "Die Schaltfläche oben startet denselben Kauf wie die Scale-Karte (Paket, Einmalzahlung).",
  },
  it: {
    checkoutLoading: "Apertura del pagamento...",
    heading: "Fatturazione",
    conversionReading: "Analisi della conversione dell’annuncio",
    subtitle:
      "Acquista 1, 5 o 15 crediti audit quando ti servono. Ogni acquisto si aggiunge al tuo saldo esistente. Pagamenti unici, nessun abbonamento.",
    paymentProcessing:
      "Pagamento in fase di convalida… i tuoi crediti saranno aggiunti una volta confermato il pagamento.",
    adminUnlimited: "Amministratore della piattaforma — audit illimitati",
    availableCredits: "Crediti disponibili",
    averageBookings: "Analisi del potenziale di conversione",
    revenueActions: "Identifica le azioni che generano ricavi",
    realDataAnalysis: "Analisi basata sui tuoi dati reali",
    recommendedOffer: "Offerta consigliata",
    mostPopular: "La più popolare",
    checking: "Verifica...",
    paymentSuccessStarter: "Pagamento riuscito. È stato aggiunto 1 credito.",
    paymentSuccessScale: "Pagamento riuscito. Il tuo pacchetto Scale (15 audit) è disponibile.",
    paymentSuccessPro: "Pagamento riuscito. Il tuo pacchetto Pro (5 audit) è disponibile.",
    paymentSuccessGeneric: "Pagamento riuscito. Il tuo acquisto è confermato.",
    paymentCancelAuditTest: "Il pagamento dell’audit di prova è stato annullato. Puoi riprovare in qualsiasi momento.",
    paymentCancelStarter: "L’acquisto del pacchetto Starter è stato annullato. Puoi riprovare da questa pagina.",
    paymentCancelScale: "L’acquisto del pacchetto Scale è stato annullato. Puoi riprovare da questa pagina.",
    paymentCancelPro: "L’acquisto del pacchetto Pro è stato annullato. Puoi riprovare da questa pagina.",
    paymentCancelGeneric: "Il pagamento è stato annullato. Puoi riprovare da questa pagina.",
    loginRequired: "Devi essere connesso per continuare.",
    workspaceNotFound: "Spazio di lavoro non trovato. Riprova più tardi.",
    paymentStartError: "Errore durante l’avvio del pagamento. Riprova più tardi.",
    checkoutOpenStarterError:
      "Non è stato possibile aprire il pagamento del pacchetto Starter in questo momento. Riprova tra qualche istante.",
    checkoutOpenProError:
      "Non è stato possibile aprire il pagamento del pacchetto Pro in questo momento. Riprova tra qualche istante.",
    checkoutOpenScaleError:
      "Non è stato possibile aprire il pagamento del pacchetto Scale in questo momento. Riprova tra qualche istante o contattaci se il problema persiste.",
    checkoutOpenGenericError:
      "Non è stato possibile aprire la pagina di pagamento in questo momento. Riprova tra qualche istante.",
    upsellSoftMessage:
      "Ti restano solo 2 audit. Puoi acquistare altri crediti audit in qualsiasi momento.",
    upsellCriticalMessage:
      "Ultimo audit disponibile. Puoi acquistare altri crediti audit quando ti servono.",
    upsellEmptyFreeMessage:
      "Non hai più crediti. Acquista crediti audit quando ti servono: Starter (1 audit), Pro (5 audit) o Scale (15 audit). I pacchetti più grandi costano meno per audit.",
    upsellEmptyProMessage:
      "Non hai più crediti. Acquista crediti audit quando ti servono: Starter (1 audit), Pro (5 audit) o Scale (15 audit). I pacchetti più grandi costano meno per audit.",
    upsellEmptyScaleMessage:
      "Non hai più audit disponibili. Acquista altri crediti audit quando ti servono.",
    upsellBalanceText:
      "Saldo per nuovi audit: {remaining} crediti (non il numero di report già presenti nello storico). Ogni acquisto si aggiunge al tuo saldo esistente.",
    starter: {
      name: "Starter",
      audience: "Ideale per testare la piattaforma",
      subtitle: "audit singolo",
      description:
        "Ideale per un’esigenza occasionale, ma rapidamente costoso se esegui audit regolarmente.",
      bulletOne: "1 audit sull’annuncio che preferisci",
      conversionReading: "Analisi della conversione dell’annuncio",
      bulletThree: "Raccomandazioni prioritarie",
      bulletTwo: "Acquisto singolo",
      cta: "Acquista 1 audit",
    },
    pro: {
      name: "Pro",
      subtitle: "Pacchetto da 5 audit (pagamento unico)",
      description: "Pacchetto una tantum, senza abbonamento.",
      bulletOne: "5 audit da utilizzare dopo l’acquisto",
      conversionReading: "Analisi della conversione dell’annuncio",
      cta: "Acquista pacchetto Pro (5 audit)",
      audience: "Il miglior equilibrio per confrontare più annunci",
      savings: "Pacchetto una tantum, senza abbonamento. Circa {unit} per audit, con {savings} € risparmiati rispetto a {total} acquisti singoli.",
      bulletTwo: "Confronto tra più annunci",
      bulletThree: "Prioritizzazione chiara delle azioni",
      bulletFour: "Meno acquisti singoli, più continuità",
    },
    scale: {
      name: "Scale",
      subtitle: "Pacchetto da 15 audit (pagamento unico)",
      description: "Pacchetto una tantum, senza abbonamento.",
      bulletOne: "15 audit da utilizzare dopo l’acquisto",
      conversionReading: "Analisi della conversione dell’annuncio",
      cta: "Acquista pacchetto Scale (15 audit)",
      audience: "Pensato per portafogli più ampi",
      savings: "Pacchetto una tantum, senza abbonamento. Circa {unit} per audit, con {savings} € risparmiati rispetto a {total} acquisti singoli.",
      bulletTwo: "Costo unitario ottimizzato ({reduction}% in meno rispetto a Pro)",
      bulletThree: "Monitoraggio multi-annuncio semplificato",
      bulletFour: "Pensato per team e gestori di proprietà",
    },
    heroTitle: "Scegli il tuo pacchetto di audit",
    sessionExpired:
      "La tua sessione è scaduta. Accedi di nuovo e riprova.",
    workspaceBillingNotFound:
      "Impossibile trovare lo spazio di lavoro o il profilo di fatturazione. Ricarica la pagina o accedi di nuovo.",
    workspaceBillingMissing:
      "Lo spazio di lavoro di fatturazione non è stato trasmesso. Ricarica la pagina Fatturazione e riprova.",
    paymentServiceUnavailable:
      "Il servizio di pagamento è temporaneamente non disponibile. Riprova più tardi.",
    planLoadingMessage:
      "Il tuo piano è ancora in caricamento. Riprova tra un momento.",
    paymentValidationHoldMessage:
      "Il pagamento è in fase di convalida. I tuoi crediti saranno aggiunti una volta confermato il pagamento — attendi prima di effettuare un altro acquisto.",
    paymentAlreadyInProgressMessage:
      "È già in corso un pagamento. Attendi qualche secondo.",
    incompletePaymentResponse:
      "Risposta di pagamento incompleta (manca l’URL di reindirizzamento).",
    auditTestUnlockedVisible:
      "Audit di prova acquistato e visibile nei tuoi audit",
    auditTestUnlocked: "Audit di prova acquistato",
    duplicateAuditUnlockedLocal:
      "Questo audit di prova è già sbloccato per questo annuncio.",
    duplicateAuditUnlockedPersisted:
      "Questo audit di prova è già stato acquistato per questo annuncio.",
    behaviorUpsellStarterPurchaseMessage:
      "Acquisti spesso audit singoli. I pacchetti più grandi costano meno per audit: Pro (5 audit, pagamento unico). Puoi acquistare qualsiasi offerta in qualsiasi momento.",
    behaviorUpsellHighPaceMessage:
      "Il tuo ritmo di utilizzo è elevato. Scale (15 audit, pagamento unico) costa meno per audit, e puoi acquistare qualsiasi offerta in qualsiasi momento.",
    behaviorUpsellScaleDepletedMessage:
      "I tuoi crediti sono esauriti. Acquista altri crediti audit quando ti servono.",
    paymentSuccessAuditTest:
      "Pagamento riuscito. Il tuo audit di prova è ora sbloccato.",
    viewListings: "Vedi annunci",
    behaviorUpsellFooter:
      "In base al tuo utilizzo recente (saldo per nuovi audit: {remaining} crediti).",
    behaviorUpsellFooterScaleNote:
      "Il pulsante qui sopra attiva lo stesso acquisto della card Scale (pacchetto, pagamento unico).",
  },
  pt: {
    checkoutLoading: "A abrir o pagamento...",
    heading: "Faturação",
    conversionReading: "Análise de conversão do anúncio",
    subtitle:
      "Compre 1, 5 ou 15 créditos de auditoria sempre que precisar. Cada compra soma-se ao seu saldo existente. Pagamentos únicos, sem subscrição.",
    paymentProcessing:
      "Pagamento em validação… os seus créditos serão adicionados assim que o pagamento for confirmado.",
    adminUnlimited: "Administrador da plataforma — auditorias ilimitadas",
    availableCredits: "Créditos disponíveis",
    averageBookings: "Análise do potencial de conversão",
    revenueActions: "Identifique as ações que geram receitas",
    realDataAnalysis: "Análise baseada nos seus dados reais",
    recommendedOffer: "Oferta recomendada",
    mostPopular: "Mais popular",
    checking: "Verificação...",
    paymentSuccessStarter: "Pagamento efetuado com sucesso. Foi adicionado 1 crédito.",
    paymentSuccessScale: "Pagamento efetuado com sucesso. O seu pack Scale (15 auditorias) está disponível.",
    paymentSuccessPro: "Pagamento efetuado com sucesso. O seu pack Pro (5 auditorias) está disponível.",
    paymentSuccessGeneric: "Pagamento efetuado com sucesso. A sua compra foi confirmada.",
    paymentCancelAuditTest: "O pagamento da auditoria de teste foi cancelado. Pode voltar a tentar a qualquer momento.",
    paymentCancelStarter: "A compra do pack Starter foi cancelada. Pode voltar a tentar a partir desta página.",
    paymentCancelScale: "A compra do pack Scale foi cancelada. Pode voltar a tentar a partir desta página.",
    paymentCancelPro: "A compra do pack Pro foi cancelada. Pode voltar a tentar a partir desta página.",
    paymentCancelGeneric: "O pagamento foi cancelado. Pode voltar a tentar a partir desta página.",
    loginRequired: "Tem de iniciar sessão para continuar.",
    workspaceNotFound: "Área de trabalho não encontrada. Tente novamente mais tarde.",
    paymentStartError: "Erro ao iniciar o pagamento. Tente novamente mais tarde.",
    checkoutOpenStarterError:
      "Não foi possível abrir o pagamento do pack Starter neste momento. Tente novamente dentro de instantes.",
    checkoutOpenProError:
      "Não foi possível abrir o pagamento do pack Pro neste momento. Tente novamente dentro de instantes.",
    checkoutOpenScaleError:
      "Não foi possível abrir o pagamento do pack Scale neste momento. Tente novamente dentro de instantes ou contacte-nos se o problema persistir.",
    checkoutOpenGenericError:
      "Não foi possível abrir a página de pagamento neste momento. Tente novamente dentro de instantes.",
    upsellSoftMessage:
      "Restam apenas 2 auditorias. Pode comprar mais créditos de auditoria a qualquer momento.",
    upsellCriticalMessage:
      "Última auditoria disponível. Pode comprar mais créditos de auditoria sempre que precisar.",
    upsellEmptyFreeMessage:
      "Já não tem créditos. Compre créditos de auditoria sempre que precisar: Starter (1 auditoria), Pro (5 auditorias) ou Scale (15 auditorias). Os packs maiores custam menos por auditoria.",
    upsellEmptyProMessage:
      "Já não tem créditos. Compre créditos de auditoria sempre que precisar: Starter (1 auditoria), Pro (5 auditorias) ou Scale (15 auditorias). Os packs maiores custam menos por auditoria.",
    upsellEmptyScaleMessage:
      "Já não tem auditorias disponíveis. Compre mais créditos de auditoria sempre que precisar.",
    upsellBalanceText:
      "Saldo para novas auditorias: {remaining} créditos (e não o número de relatórios já presentes no histórico). Cada compra soma-se ao seu saldo existente.",
    starter: {
      name: "Starter",
      audience: "Ideal para testar a plataforma",
      subtitle: "auditoria única",
      description:
        "Ideal para uma necessidade pontual, mas rapidamente caro se fizer auditorias com regularidade.",
      bulletOne: "1 auditoria no anúncio à sua escolha",
      conversionReading: "Análise de conversão do anúncio",
      bulletThree: "Recomendações prioritárias",
      bulletTwo: "Compra unitária",
      cta: "Comprar 1 auditoria",
    },
    pro: {
      name: "Pro",
      subtitle: "Pack de 5 auditorias (pagamento único)",
      description: "Pack pontual, sem subscrição.",
      bulletOne: "5 auditorias para utilizar após a compra",
      conversionReading: "Análise de conversão do anúncio",
      cta: "Comprar pack Pro (5 auditorias)",
      audience: "O melhor equilíbrio para comparar vários anúncios",
      savings: "Pack pontual, sem subscrição. Cerca de {unit} por auditoria, com {savings} € poupados face a {total} compras unitárias.",
      bulletTwo: "Comparação entre vários anúncios",
      bulletThree: "Priorização clara das ações",
      bulletFour: "Menos compras unitárias, mais continuidade",
    },
    scale: {
      name: "Scale",
      subtitle: "Pack de 15 auditorias (pagamento único)",
      description: "Pack pontual, sem subscrição.",
      bulletOne: "15 auditorias para utilizar após a compra",
      conversionReading: "Análise de conversão do anúncio",
      cta: "Comprar pack Scale (15 auditorias)",
      audience: "Pensado para portefólios maiores",
      savings: "Pack pontual, sem subscrição. Cerca de {unit} por auditoria, com {savings} € poupados face a {total} compras unitárias.",
      bulletTwo: "Custo unitário otimizado ({reduction}% menos do que Pro)",
      bulletThree: "Acompanhamento multi-anúncio simplificado",
      bulletFour: "Criado para equipas e gestores de propriedades",
    },
    heroTitle: "Escolha o seu pack de auditorias",
    sessionExpired:
      "A sua sessão expirou. Inicie sessão novamente e volte a tentar.",
    workspaceBillingNotFound:
      "Não foi possível encontrar a área de trabalho ou o perfil de faturação. Recarregue a página ou volte a iniciar sessão.",
    workspaceBillingMissing:
      "A área de trabalho de faturação não foi transmitida. Recarregue a página de Faturação e tente novamente.",
    paymentServiceUnavailable:
      "O serviço de pagamento está temporariamente indisponível. Tente novamente mais tarde.",
    planLoadingMessage:
      "O seu plano ainda está a carregar. Tente novamente dentro de instantes.",
    paymentValidationHoldMessage:
      "O pagamento está em validação. Os seus créditos serão adicionados assim que o pagamento for confirmado — aguarde antes de fazer outra compra.",
    paymentAlreadyInProgressMessage:
      "Já existe um pagamento em curso. Aguarde alguns segundos.",
    incompletePaymentResponse:
      "Resposta de pagamento incompleta (falta o URL de redirecionamento).",
    auditTestUnlockedVisible:
      "Auditoria de teste comprada e visível nas suas auditorias",
    auditTestUnlocked: "Auditoria de teste comprada",
    duplicateAuditUnlockedLocal:
      "Esta auditoria de teste já está desbloqueada para este anúncio.",
    duplicateAuditUnlockedPersisted:
      "Esta auditoria de teste já foi comprada para este anúncio.",
    behaviorUpsellStarterPurchaseMessage:
      "Compra auditorias unitárias com frequência. Os packs maiores custam menos por auditoria: Pro (5 auditorias, pagamento único). Pode comprar qualquer oferta a qualquer momento.",
    behaviorUpsellHighPaceMessage:
      "O seu ritmo de utilização é elevado. O Scale (15 auditorias, pagamento único) custa menos por auditoria, e pode comprar qualquer oferta a qualquer momento.",
    behaviorUpsellScaleDepletedMessage:
      "Os seus créditos esgotaram-se. Compre mais créditos de auditoria sempre que precisar.",
    paymentSuccessAuditTest:
      "Pagamento efetuado com sucesso. A sua auditoria de teste está agora desbloqueada.",
    viewListings: "Ver anúncios",
    behaviorUpsellFooter:
      "Com base na sua utilização recente (saldo para novas auditorias: {remaining} créditos).",
    behaviorUpsellFooterScaleNote:
      "O botão acima aciona a mesma compra do cartão Scale (pack, pagamento único).",
  },
  nl: {
    checkoutLoading: "Betaling openen...",
    heading: "Facturatie",
    conversionReading: "Conversieanalyse van de advertentie",
    subtitle:
      "Koop 1, 5 of 15 auditcredits wanneer je ze nodig hebt. Elke aankoop wordt toegevoegd aan je bestaande saldo. Eenmalige betalingen, geen abonnement.",
    paymentProcessing:
      "Betaling wordt gevalideerd… je credits worden toegevoegd zodra de betaling is bevestigd.",
    adminUnlimited: "Platformbeheerder — onbeperkte audits",
    availableCredits: "Beschikbare credits",
    averageBookings: "Analyse van conversiepotentieel",
    revenueActions: "Identificeer de acties die omzet genereren",
    realDataAnalysis: "Analyse op basis van je echte gegevens",
    recommendedOffer: "Aanbevolen aanbod",
    mostPopular: "Meest populair",
    checking: "Controleren...",
    paymentSuccessStarter: "Betaling geslaagd. 1 credit werd toegevoegd.",
    paymentSuccessScale: "Betaling geslaagd. Je Scale-pakket (15 audits) is beschikbaar.",
    paymentSuccessPro: "Betaling geslaagd. Je Pro-pakket (5 audits) is beschikbaar.",
    paymentSuccessGeneric: "Betaling geslaagd. Je aankoop is bevestigd.",
    paymentCancelAuditTest: "De betaling van de testaudit is geannuleerd. Je kunt het op elk moment opnieuw proberen.",
    paymentCancelStarter: "De aankoop van het Starter-pakket is geannuleerd. Je kunt het opnieuw proberen vanaf deze pagina.",
    paymentCancelScale: "De aankoop van het Scale-pakket is geannuleerd. Je kunt het opnieuw proberen vanaf deze pagina.",
    paymentCancelPro: "De aankoop van het Pro-pakket is geannuleerd. Je kunt het opnieuw proberen vanaf deze pagina.",
    paymentCancelGeneric: "De betaling is geannuleerd. Je kunt het opnieuw proberen vanaf deze pagina.",
    loginRequired: "Je moet ingelogd zijn om verder te gaan.",
    workspaceNotFound: "Werkruimte niet gevonden. Probeer het later opnieuw.",
    paymentStartError: "Fout bij het starten van de betaling. Probeer het later opnieuw.",
    checkoutOpenStarterError:
      "De betaling voor het Starter-pakket kon op dit moment niet worden geopend. Probeer het over enkele ogenblikken opnieuw.",
    checkoutOpenProError:
      "De betaling voor het Pro-pakket kon op dit moment niet worden geopend. Probeer het over enkele ogenblikken opnieuw.",
    checkoutOpenScaleError:
      "De betaling voor het Scale-pakket kon op dit moment niet worden geopend. Probeer het over enkele ogenblikken opnieuw of neem contact met ons op als het probleem blijft bestaan.",
    checkoutOpenGenericError:
      "De betaalpagina kon op dit moment niet worden geopend. Probeer het over enkele ogenblikken opnieuw.",
    upsellSoftMessage:
      "Je hebt nog maar 2 audits over. Je kunt op elk moment extra auditcredits kopen.",
    upsellCriticalMessage:
      "Laatste audit beschikbaar. Je kunt extra auditcredits kopen wanneer je ze nodig hebt.",
    upsellEmptyFreeMessage:
      "Je hebt geen credits meer. Koop auditcredits wanneer je ze nodig hebt: Starter (1 audit), Pro (5 audits) of Scale (15 audits). Grotere pakketten kosten minder per audit.",
    upsellEmptyProMessage:
      "Je hebt geen credits meer. Koop auditcredits wanneer je ze nodig hebt: Starter (1 audit), Pro (5 audits) of Scale (15 audits). Grotere pakketten kosten minder per audit.",
    upsellEmptyScaleMessage:
      "Je hebt geen audits meer beschikbaar. Koop extra auditcredits wanneer je ze nodig hebt.",
    upsellBalanceText:
      "Saldo voor nieuwe audits: {remaining} credits (niet het aantal rapporten dat al in je geschiedenis staat). Elke aankoop wordt toegevoegd aan je bestaande saldo.",
    starter: {
      name: "Starter",
      audience: "Ideaal om het platform te testen",
      subtitle: "enkele audit",
      description:
        "Ideaal voor een eenmalige behoefte, maar snel duur als je regelmatig audits uitvoert.",
      bulletOne: "1 audit voor de advertentie van jouw keuze",
      conversionReading: "Conversieanalyse van de advertentie",
      bulletThree: "Prioritaire aanbevelingen",
      bulletTwo: "Losse aankoop",
      cta: "Koop 1 audit",
    },
    pro: {
      name: "Pro",
      subtitle: "Pakket van 5 audits (eenmalige betaling)",
      description: "Eenmalig pakket, zonder abonnement.",
      bulletOne: "5 audits te gebruiken na aankoop",
      conversionReading: "Conversieanalyse van de advertentie",
      cta: "Koop Pro-pakket (5 audits)",
      audience: "De beste balans om meerdere advertenties te vergelijken",
      savings: "Eenmalig pakket, zonder abonnement. Ongeveer {unit} per audit, met {savings} € besparing ten opzichte van {total} losse aankopen.",
      bulletTwo: "Vergelijk meerdere advertenties",
      bulletThree: "Duidelijke prioritering van acties",
      bulletFour: "Minder losse aankopen, meer continuïteit",
    },
    scale: {
      name: "Scale",
      subtitle: "Pakket van 15 audits (eenmalige betaling)",
      description: "Eenmalig pakket, zonder abonnement.",
      bulletOne: "15 audits te gebruiken na aankoop",
      conversionReading: "Conversieanalyse van de advertentie",
      cta: "Koop Scale-pakket (15 audits)",
      audience: "Ontworpen voor grotere portefeuilles",
      savings: "Eenmalig pakket, zonder abonnement. Ongeveer {unit} per audit, met {savings} € besparing ten opzichte van {total} losse aankopen.",
      bulletTwo: "Geoptimaliseerde kost per audit ({reduction}% minder dan Pro)",
      bulletThree: "Vereenvoudigde multi-listing opvolging",
      bulletFour: "Gebouwd voor teams en property managers",
    },
    heroTitle: "Kies je auditpakket",
    sessionExpired:
      "Je sessie is verlopen. Meld je opnieuw aan en probeer het nog eens.",
    workspaceBillingNotFound:
      "Werkruimte of facturatieprofiel kon niet worden gevonden. Herlaad de pagina of meld je opnieuw aan.",
    workspaceBillingMissing:
      "De facturatiewerkruimte werd niet meegestuurd. Herlaad de facturatiepagina en probeer het opnieuw.",
    paymentServiceUnavailable:
      "De betaaldienst is tijdelijk niet beschikbaar. Probeer het later opnieuw.",
    planLoadingMessage:
      "Je plan is nog aan het laden. Probeer het zo meteen opnieuw.",
    paymentValidationHoldMessage:
      "De betaling wordt gevalideerd. Je credits worden toegevoegd zodra de betaling is bevestigd — wacht even voordat je opnieuw koopt.",
    paymentAlreadyInProgressMessage:
      "Er is al een betaling bezig. Wacht een paar seconden.",
    incompletePaymentResponse:
      "Onvolledige betaalrespons (ontbrekende doorverwijzings-URL).",
    auditTestUnlockedVisible:
      "Testaudit gekocht en zichtbaar in je audits",
    auditTestUnlocked: "Testaudit gekocht",
    duplicateAuditUnlockedLocal:
      "Deze testaudit is al ontgrendeld voor deze listing.",
    duplicateAuditUnlockedPersisted:
      "Deze testaudit werd al gekocht voor deze listing.",
    behaviorUpsellStarterPurchaseMessage:
      "Je koopt vaak losse audits. Grotere pakketten kosten minder per audit: Pro (5 audits, eenmalige betaling). Je kunt op elk moment elk aanbod kopen.",
    behaviorUpsellHighPaceMessage:
      "Je gebruiksritme ligt hoog. Scale (15 audits, eenmalige betaling) kost minder per audit, en je kunt op elk moment elk aanbod kopen.",
    behaviorUpsellScaleDepletedMessage:
      "Je credits zijn opgebruikt. Koop extra auditcredits wanneer je ze nodig hebt.",
    paymentSuccessAuditTest:
      "Betaling geslaagd. Je testaudit is nu ontgrendeld.",
    viewListings: "Bekijk listings",
    behaviorUpsellFooter:
      "Op basis van je recente gebruik (saldo voor nieuwe audits: {remaining} credits).",
    behaviorUpsellFooterScaleNote:
      "De knop hierboven start dezelfde aankoop als op de Scale-kaart (pakket, eenmalige betaling).",
  },
  ja: {
    checkoutLoading: "決済を開いています...",
    heading: "請求",
    conversionReading: "掲載のコンバージョン分析",
    subtitle:
      "必要なときに、1・5・15件分の監査クレジットを購入できます。購入のたびに既存の残高に追加されます。単発決済で、サブスクリプションはありません。",
    paymentProcessing:
      "決済を確認中です… 決済が確認され次第、クレジットが追加されます。",
    adminUnlimited: "プラットフォーム管理者 — 無制限の監査",
    availableCredits: "利用可能なクレジット",
    averageBookings: "コンバージョン可能性の分析",
    revenueActions: "収益を生むアクションを特定",
    realDataAnalysis: "実データに基づく分析",
    recommendedOffer: "おすすめプラン",
    mostPopular: "最も人気",
    checking: "確認中...",
    paymentSuccessStarter: "決済が完了しました。1クレジットが追加されました。",
    paymentSuccessScale: "決済が完了しました。Scale パック（15監査）が利用可能です。",
    paymentSuccessPro: "決済が完了しました。Pro パック（5監査）が利用可能です。",
    paymentSuccessGeneric: "決済が完了しました。購入が確定しました。",
    paymentCancelAuditTest: "テスト監査の決済はキャンセルされました。いつでも再試行できます。",
    paymentCancelStarter:
      "Starter パックの購入はキャンセルされました。このページから再試行できます。",
    paymentCancelScale:
      "Scale パックの購入はキャンセルされました。このページから再試行できます。",
    paymentCancelPro:
      "Pro パックの購入はキャンセルされました。このページから再試行できます。",
    paymentCancelGeneric: "決済はキャンセルされました。このページから再試行できます。",
    loginRequired: "続行するにはサインインが必要です。",
    workspaceNotFound: "ワークスペースが見つかりません。後でもう一度お試しください。",
    paymentStartError: "決済の開始中にエラーが発生しました。後でもう一度お試しください。",
    checkoutOpenStarterError:
      "Starter パックの決済ページを現在開けません。しばらくしてからもう一度お試しください。",
    checkoutOpenProError:
      "Pro パックの決済ページを現在開けません。しばらくしてからもう一度お試しください。",
    checkoutOpenScaleError:
      "Scale パックの決済ページを現在開けません。しばらくしてからもう一度お試しいただくか、問題が続く場合はご連絡ください。",
    checkoutOpenGenericError:
      "決済ページを現在開けません。しばらくしてからもう一度お試しください。",
    upsellSoftMessage:
      "残り監査数はあと 2 件です。監査クレジットはいつでも追加購入できます。",
    upsellCriticalMessage:
      "利用可能な監査はあと 1 件です。必要なときに監査クレジットを追加購入できます。",
    upsellEmptyFreeMessage:
      "クレジットがありません。必要なときに監査クレジットを購入できます：Starter（1件）、Pro（5件）、Scale（15件）。大きいパックほど1件あたりの価格は下がります。",
    upsellEmptyProMessage:
      "クレジットがありません。必要なときに監査クレジットを購入できます：Starter（1件）、Pro（5件）、Scale（15件）。大きいパックほど1件あたりの価格は下がります。",
    upsellEmptyScaleMessage:
      "利用可能な監査がありません。必要なときに監査クレジットを追加購入できます。",
    upsellBalanceText:
      "新しい監査向け残高: {remaining} クレジット（履歴内にあるレポート数ではありません）。購入のたびに既存の残高に追加されます。",
    starter: {
      name: "Starter",
      audience: "プラットフォームを試すのに最適",
      subtitle: "単発監査",
      description:
        "一時的なニーズには最適ですが、頻繁に監査するとすぐに高コストになります。",
      bulletOne: "選択した掲載に対して 1 件の監査",
      conversionReading: "掲載のコンバージョン分析",
      bulletThree: "優先度の高い提案",
      bulletTwo: "単発購入",
      cta: "1件の監査を購入",
    },
    pro: {
      name: "Pro",
      subtitle: "5件監査パック（単発決済）",
      description: "サブスクリプションなしの単発パックです。",
      bulletOne: "購入後に利用できる 5 件の監査",
      conversionReading: "掲載のコンバージョン分析",
      cta: "Pro パックを購入（5件の監査）",
      audience: "複数の掲載を比較するのに最適なバランス",
      savings:
        "サブスクリプションなしの単発パックです。1件あたり約 {unit}、単発購入 {total} 回と比べて {savings} 節約できます。",
      bulletTwo: "複数掲載を比較",
      bulletThree: "アクションの明確な優先順位付け",
      bulletFour: "単発購入を減らし、継続性を高める",
    },
    scale: {
      name: "Scale",
      subtitle: "15件監査パック（単発決済）",
      description: "サブスクリプションなしの単発パックです。",
      bulletOne: "購入後に利用できる 15 件の監査",
      conversionReading: "掲載のコンバージョン分析",
      cta: "Scale パックを購入（15件の監査）",
      audience: "より大きなポートフォリオ向け",
      savings:
        "サブスクリプションなしの単発パックです。1件あたり約 {unit}、単発購入 {total} 回と比べて {savings} 節約できます。",
      bulletTwo: "最適化された単価（Pro より {reduction}% 低い）",
      bulletThree: "複数掲載の追跡を簡素化",
      bulletFour: "チームや不動産管理者向けに設計",
    },
    heroTitle: "監査パックを選ぶ",
    sessionExpired:
      "セッションの有効期限が切れました。再度サインインしてもう一度お試しください。",
    workspaceBillingNotFound:
      "ワークスペースまたは請求情報が見つかりません。ページを再読み込みするか、再度サインインしてください。",
    workspaceBillingMissing:
      "請求用ワークスペースが渡されませんでした。請求ページを再読み込みしてもう一度お試しください。",
    paymentServiceUnavailable:
      "決済サービスは一時的に利用できません。しばらくしてからもう一度お試しください。",
    planLoadingMessage:
      "プランを読み込み中です。しばらくしてからもう一度お試しください。",
    paymentValidationHoldMessage:
      "決済を確認中です。決済が確認され次第、クレジットが追加されます。次の購入の前に少しお待ちください。",
    paymentAlreadyInProgressMessage:
      "すでに決済処理が進行中です。数秒お待ちください。",
    incompletePaymentResponse:
      "決済レスポンスが不完全です（リダイレクト URL がありません）。",
    auditTestUnlockedVisible:
      "テスト監査を購入済みで、監査一覧に表示されています",
    auditTestUnlocked: "テスト監査を購入済みです",
    duplicateAuditUnlockedLocal:
      "この掲載のテスト監査はすでにアンロックされています。",
    duplicateAuditUnlockedPersisted:
      "この掲載のテスト監査はすでに購入されています。",
    behaviorUpsellStarterPurchaseMessage:
      "単発監査を頻繁に購入しています。大きいパックほど1件あたりの価格は下がります：Pro（5件の監査、単発決済）。どのオファーもいつでも購入できます。",
    behaviorUpsellHighPaceMessage:
      "利用ペースが高めです。Scale（15件の監査、単発決済）は1件あたりの価格が下がります。どのオファーもいつでも購入できます。",
    behaviorUpsellScaleDepletedMessage:
      "クレジットを使い切りました。必要なときに監査クレジットを追加購入できます。",
    paymentSuccessAuditTest:
      "決済が完了しました。テスト監査がアンロックされました。",
    viewListings: "掲載を見る",
    behaviorUpsellFooter:
      "最近の利用状況に基づく表示です（新しい監査向け残高: {remaining} クレジット）。",
    behaviorUpsellFooterScaleNote:
      "上のボタンは Scale カードと同じ購入（パック、単発決済）を開始します。",
  },
  zh: {
    checkoutLoading: "正在打开支付...",
    heading: "账单",
    conversionReading: "房源转化分析",
    subtitle:
      "需要时可购买 1、5 或 15 次审计额度。每次购买都会累加到你现有的余额中。一次性付款，无需订阅。",
    paymentProcessing:
      "支付正在验证中… 支付确认后，你的额度将被添加。",
    adminUnlimited: "平台管理员 — 无限审计",
    availableCredits: "可用额度",
    averageBookings: "转化潜力分析",
    revenueActions: "识别带来收入的行动",
    realDataAnalysis: "基于你的真实数据分析",
    recommendedOffer: "推荐方案",
    mostPopular: "最受欢迎",
    checking: "检查中...",
    paymentSuccessStarter: "支付成功。已添加 1 个额度。",
    paymentSuccessScale: "支付成功。你的 Scale 套餐（15 次审计）已可用。",
    paymentSuccessPro: "支付成功。你的 Pro 套餐（5 次审计）已可用。",
    paymentSuccessGeneric: "支付成功。你的购买已确认。",
    paymentCancelAuditTest: "测试审计支付已取消。你可以随时重试。",
    paymentCancelStarter: "Starter 套餐购买已取消。你可以在此页面重新尝试。",
    paymentCancelScale: "Scale 套餐购买已取消。你可以在此页面重新尝试。",
    paymentCancelPro: "Pro 套餐购买已取消。你可以在此页面重新尝试。",
    paymentCancelGeneric: "支付已取消。你可以在此页面重新尝试。",
    loginRequired: "你必须登录后才能继续。",
    workspaceNotFound: "未找到工作区。请稍后再试。",
    paymentStartError: "启动支付时出错。请稍后再试。",
    checkoutOpenStarterError:
      "目前无法打开 Starter 套餐的支付页面。请稍后再试。",
    checkoutOpenProError:
      "目前无法打开 Pro 套餐的支付页面。请稍后再试。",
    checkoutOpenScaleError:
      "目前无法打开 Scale 套餐的支付页面。请稍后再试；如果问题持续，请联系我们。",
    checkoutOpenGenericError:
      "目前无法打开支付页面。请稍后再试。",
    upsellSoftMessage:
      "你只剩下 2 次审计。你可以随时购买更多审计额度。",
    upsellCriticalMessage:
      "只剩最后一次审计。需要时可购买更多审计额度。",
    upsellEmptyFreeMessage:
      "你已没有额度。需要时可购买审计额度：Starter（1 次审计）、Pro（5 次审计）或 Scale（15 次审计）。套餐越大，单次审计成本越低。",
    upsellEmptyProMessage:
      "你已没有额度。需要时可购买审计额度：Starter（1 次审计）、Pro（5 次审计）或 Scale（15 次审计）。套餐越大，单次审计成本越低。",
    upsellEmptyScaleMessage:
      "你已没有可用审计。需要时可购买更多审计额度。",
    upsellBalanceText:
      "新审计余额：{remaining} 次额度（并非历史中已有的报告数量）。每次购买都会累加到你现有的余额中。",
    starter: {
      name: "Starter",
      audience: "适合测试平台",
      subtitle: "单次审计",
      description:
        "适合一次性需求，但如果你经常审计，很快就会变贵。",
      bulletOne: "对你选择的房源进行 1 次审计",
      conversionReading: "房源转化分析",
      bulletThree: "优先建议",
      bulletTwo: "单次购买",
      cta: "购买 1 次审计",
    },
    pro: {
      name: "Pro",
      subtitle: "5 次审计套餐（一次性支付）",
      description: "一次性套餐，无订阅。",
      bulletOne: "购买后可使用 5 次审计",
      conversionReading: "房源转化分析",
      cta: "购买 Pro 套餐（5 次审计）",
      audience: "比较多个房源的最佳平衡方案",
      savings:
        "一次性套餐，无订阅。每次审计约 {unit}，相比 {total} 次单次购买可节省 {savings}。",
      bulletTwo: "比较多个房源",
      bulletThree: "清晰的行动优先级",
      bulletFour: "减少单次购买，提升连续性",
    },
    scale: {
      name: "Scale",
      subtitle: "15 次审计套餐（一次性支付）",
      description: "一次性套餐，无订阅。",
      bulletOne: "购买后可使用 15 次审计",
      conversionReading: "房源转化分析",
      cta: "购买 Scale 套餐（15 次审计）",
      audience: "为更大规模的资产组合而设计",
      savings:
        "一次性套餐，无订阅。每次审计约 {unit}，相比 {total} 次单次购买可节省 {savings}。",
      bulletTwo: "优化后的单次成本（比 Pro 低 {reduction}%）",
      bulletThree: "简化多房源跟踪",
      bulletFour: "专为团队和物业管理者打造",
    },
    heroTitle: "选择你的审计套餐",
    sessionExpired:
      "你的会话已过期。请重新登录后再试一次。",
    workspaceBillingNotFound:
      "未找到工作区或账单资料。请刷新页面或重新登录。",
    workspaceBillingMissing:
      "账单工作区未被传递。请刷新账单页面后重试。",
    paymentServiceUnavailable:
      "支付服务暂时不可用。请稍后再试。",
    planLoadingMessage:
      "你的套餐仍在加载中。请稍后再试。",
    paymentValidationHoldMessage:
      "支付正在验证中。支付确认后，你的额度将被添加，请稍等后再进行新的购买。",
    paymentAlreadyInProgressMessage:
      "已有支付正在进行中。请等待几秒钟。",
    incompletePaymentResponse:
      "支付响应不完整（缺少跳转 URL）。",
    auditTestUnlockedVisible:
      "测试审计已购买，并已显示在你的审计列表中",
    auditTestUnlocked: "测试审计已购买",
    duplicateAuditUnlockedLocal:
      "该房源的测试审计已解锁。",
    duplicateAuditUnlockedPersisted:
      "该房源的测试审计已购买。",
    behaviorUpsellStarterPurchaseMessage:
      "你经常购买单次审计。套餐越大，单次审计成本越低：Pro（5 次审计，一次性支付）。你可以随时购买任意方案。",
    behaviorUpsellHighPaceMessage:
      "你的使用节奏较高。Scale（15 次审计，一次性支付）单次审计成本更低，你也可以随时购买任意方案。",
    behaviorUpsellScaleDepletedMessage:
      "你的额度已用尽。需要时可购买更多审计额度。",
    paymentSuccessAuditTest:
      "支付成功。你的测试审计现已解锁。",
    viewListings: "查看房源",
    behaviorUpsellFooter:
      "基于你最近的使用情况（新审计余额：{remaining} 次额度）。",
    behaviorUpsellFooterScaleNote:
      "上方按钮触发的购买与 Scale 卡片相同（套餐，一次性支付）。",
  },
  ko: {
    checkoutLoading: "결제를 여는 중...",
    heading: "청구",
    conversionReading: "숙소 전환 분석",
    subtitle:
      "필요할 때 감사 크레딧 1, 5 또는 15개를 구매하세요. 구매할 때마다 기존 잔액에 추가됩니다. 일회성 결제이며 구독은 없습니다.",
    paymentProcessing:
      "결제를 확인하는 중입니다… 결제가 확인되면 크레딧이 추가됩니다.",
    adminUnlimited: "플랫폼 관리자 — 무제한 감사",
    availableCredits: "사용 가능한 크레딧",
    averageBookings: "전환 잠재력 분석",
    revenueActions: "수익을 만드는 액션 식별",
    realDataAnalysis: "실제 데이터를 기반으로 한 분석",
    recommendedOffer: "추천 오퍼",
    mostPopular: "가장 인기 있음",
    checking: "확인 중...",
    paymentSuccessStarter: "결제가 완료되었습니다. 크레딧 1개가 추가되었습니다.",
    paymentSuccessScale: "결제가 완료되었습니다. Scale 팩(감사 15회)을 사용할 수 있습니다.",
    paymentSuccessPro: "결제가 완료되었습니다. Pro 팩(감사 5회)을 사용할 수 있습니다.",
    paymentSuccessGeneric: "결제가 완료되었습니다. 구매가 확인되었습니다.",
    paymentCancelAuditTest: "테스트 감사 결제가 취소되었습니다. 언제든 다시 시도할 수 있습니다.",
    paymentCancelStarter: "Starter 팩 구매가 취소되었습니다. 이 페이지에서 다시 시도할 수 있습니다.",
    paymentCancelScale: "Scale 팩 구매가 취소되었습니다. 이 페이지에서 다시 시도할 수 있습니다.",
    paymentCancelPro: "Pro 팩 구매가 취소되었습니다. 이 페이지에서 다시 시도할 수 있습니다.",
    paymentCancelGeneric: "결제가 취소되었습니다. 이 페이지에서 다시 시도할 수 있습니다.",
    loginRequired: "계속하려면 로그인해야 합니다.",
    workspaceNotFound: "워크스페이스를 찾을 수 없습니다. 나중에 다시 시도하세요.",
    paymentStartError: "결제를 시작하는 중 오류가 발생했습니다. 나중에 다시 시도하세요.",
    checkoutOpenStarterError:
      "현재 Starter 팩 결제 페이지를 열 수 없습니다. 잠시 후 다시 시도해 주세요.",
    checkoutOpenProError:
      "현재 Pro 팩 결제 페이지를 열 수 없습니다. 잠시 후 다시 시도해 주세요.",
    checkoutOpenScaleError:
      "현재 Scale 팩 결제 페이지를 열 수 없습니다. 잠시 후 다시 시도하시거나 문제가 계속되면 문의해 주세요.",
    checkoutOpenGenericError:
      "현재 결제 페이지를 열 수 없습니다. 잠시 후 다시 시도해 주세요.",
    upsellSoftMessage:
      "감사가 2회만 남았습니다. 감사 크레딧은 언제든지 추가로 구매할 수 있습니다.",
    upsellCriticalMessage:
      "마지막 감사만 남았습니다. 필요할 때 감사 크레딧을 추가로 구매할 수 있습니다.",
    upsellEmptyFreeMessage:
      "크레딧이 없습니다. 필요할 때 감사 크레딧을 구매하세요: Starter(감사 1회), Pro(감사 5회) 또는 Scale(감사 15회). 큰 패키지일수록 감사당 비용이 낮아집니다.",
    upsellEmptyProMessage:
      "크레딧이 없습니다. 필요할 때 감사 크레딧을 구매하세요: Starter(감사 1회), Pro(감사 5회) 또는 Scale(감사 15회). 큰 패키지일수록 감사당 비용이 낮아집니다.",
    upsellEmptyScaleMessage:
      "사용 가능한 감사가 없습니다. 필요할 때 감사 크레딧을 추가로 구매하세요.",
    upsellBalanceText:
      "새 감사용 잔액: 크레딧 {remaining}개 (히스토리에 이미 있는 보고서 수가 아닙니다). 구매할 때마다 기존 잔액에 추가됩니다.",
    starter: {
      name: "Starter",
      audience: "플랫폼을 테스트하기에 적합",
      subtitle: "단일 감사",
      description:
        "일회성 필요에는 적합하지만, 자주 감사를 하면 금방 비싸집니다.",
      bulletOne: "선택한 숙소에 대한 감사 1회",
      conversionReading: "숙소 전환 분석",
      bulletThree: "우선 권장사항",
      bulletTwo: "단건 구매",
      cta: "감사 1회 구매",
    },
    pro: {
      name: "Pro",
      subtitle: "감사 5회 팩(일회성 결제)",
      description: "구독 없는 일회성 팩입니다.",
      bulletOne: "구매 후 사용할 수 있는 감사 5회",
      conversionReading: "숙소 전환 분석",
      cta: "Pro 팩 구매(감사 5회)",
      audience: "여러 숙소를 비교하기에 가장 좋은 균형",
      savings:
        "구독 없는 일회성 팩입니다. 감사당 약 {unit}, 단건 구매 {total}회 대비 {savings} 절감됩니다.",
      bulletTwo: "여러 숙소 비교",
      bulletThree: "명확한 액션 우선순위",
      bulletFour: "단건 구매를 줄이고 연속성 강화",
    },
    scale: {
      name: "Scale",
      subtitle: "감사 15회 팩(일회성 결제)",
      description: "구독 없는 일회성 팩입니다.",
      bulletOne: "구매 후 사용할 수 있는 감사 15회",
      conversionReading: "숙소 전환 분석",
      cta: "Scale 팩 구매(감사 15회)",
      audience: "더 큰 포트폴리오를 위해 설계",
      savings:
        "구독 없는 일회성 팩입니다. 감사당 약 {unit}, 단건 구매 {total}회 대비 {savings} 절감됩니다.",
      bulletTwo: "최적화된 단가(Pro 대비 {reduction}% 낮음)",
      bulletThree: "멀티 숙소 추적 간소화",
      bulletFour: "팀과 자산 관리자용으로 설계",
    },
    heroTitle: "감사 패키지 선택",
    sessionExpired:
      "세션이 만료되었습니다. 다시 로그인한 후 다시 시도해 주세요.",
    workspaceBillingNotFound:
      "워크스페이스 또는 결제 정보를 찾을 수 없습니다. 페이지를 새로고침하거나 다시 로그인해 주세요.",
    workspaceBillingMissing:
      "청구용 워크스페이스가 전달되지 않았습니다. 청구 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    paymentServiceUnavailable:
      "결제 서비스가 일시적으로 이용할 수 없습니다. 나중에 다시 시도해 주세요.",
    planLoadingMessage:
      "요금제를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.",
    paymentValidationHoldMessage:
      "결제를 확인하는 중입니다. 결제가 확인되면 크레딧이 추가되니, 다음 구매 전 잠시만 기다려 주세요.",
    paymentAlreadyInProgressMessage:
      "이미 결제가 진행 중입니다. 몇 초만 기다려 주세요.",
    incompletePaymentResponse:
      "불완전한 결제 응답입니다(리디렉션 URL 누락).",
    auditTestUnlockedVisible:
      "테스트 감사가 구매되었고 감사 목록에 표시됩니다",
    auditTestUnlocked: "테스트 감사가 구매되었습니다",
    duplicateAuditUnlockedLocal:
      "이 숙소의 테스트 감사는 이미 잠금 해제되었습니다.",
    duplicateAuditUnlockedPersisted:
      "이 숙소의 테스트 감사는 이미 구매되었습니다.",
    behaviorUpsellStarterPurchaseMessage:
      "단건 감사를 자주 구매하고 있습니다. 큰 패키지일수록 감사당 비용이 낮아집니다: Pro(감사 5회, 일회성 결제). 어떤 상품이든 언제든지 구매할 수 있습니다.",
    behaviorUpsellHighPaceMessage:
      "사용 속도가 높습니다. Scale(감사 15회, 일회성 결제)은 감사당 비용이 더 낮으며, 어떤 상품이든 언제든지 구매할 수 있습니다.",
    behaviorUpsellScaleDepletedMessage:
      "크레딧을 모두 사용했습니다. 필요할 때 감사 크레딧을 추가로 구매하세요.",
    paymentSuccessAuditTest:
      "결제가 완료되었습니다. 테스트 감사가 이제 잠금 해제되었습니다.",
    viewListings: "숙소 보기",
    behaviorUpsellFooter:
      "최근 사용 내역 기준입니다 (새 감사용 잔액: 크레딧 {remaining}개).",
    behaviorUpsellFooterScaleNote:
      "위 버튼은 Scale 카드와 동일한 구매(팩, 일회성 결제)를 실행합니다.",
  },
  ar: {
    checkoutLoading: "جارٍ فتح الدفع...",
    heading: "الفوترة",
    conversionReading: "تحليل تحويل الإعلان",
    subtitle:
      "اشترِ 1 أو 5 أو 15 رصيد تدقيق متى احتجت إليه. كل عملية شراء تُضاف إلى رصيدك الحالي. دفعات لمرة واحدة، بدون اشتراك.",
    paymentProcessing:
      "يتم التحقق من الدفع… ستُضاف أرصدتك بمجرد تأكيد الدفع.",
    adminUnlimited: "مسؤول المنصة — عمليات تدقيق غير محدودة",
    availableCredits: "الأرصدة المتاحة",
    averageBookings: "تحليل إمكانات التحويل",
    revenueActions: "حدّد الإجراءات التي تولّد الإيرادات",
    realDataAnalysis: "تحليل مبني على بياناتك الفعلية",
    recommendedOffer: "العرض الموصى به",
    mostPopular: "الأكثر شعبية",
    checking: "جارٍ التحقق...",
    paymentSuccessStarter: "تم الدفع بنجاح. تمت إضافة رصيد واحد.",
    paymentSuccessScale: "تم الدفع بنجاح. أصبحت باقة Scale (15 عملية تدقيق) متاحة لك.",
    paymentSuccessPro: "تم الدفع بنجاح. أصبحت باقة Pro (5 عمليات تدقيق) متاحة لك.",
    paymentSuccessGeneric: "تم الدفع بنجاح. تم تأكيد عملية الشراء.",
    paymentCancelAuditTest: "تم إلغاء دفع التدقيق التجريبي. يمكنك المحاولة مرة أخرى في أي وقت.",
    paymentCancelStarter: "تم إلغاء شراء باقة Starter. يمكنك إعادة المحاولة من هذه الصفحة.",
    paymentCancelScale: "تم إلغاء شراء باقة Scale. يمكنك إعادة المحاولة من هذه الصفحة.",
    paymentCancelPro: "تم إلغاء شراء باقة Pro. يمكنك إعادة المحاولة من هذه الصفحة.",
    paymentCancelGeneric: "تم إلغاء الدفع. يمكنك إعادة المحاولة من هذه الصفحة.",
    loginRequired: "يجب تسجيل الدخول للمتابعة.",
    workspaceNotFound: "تعذر العثور على مساحة العمل. حاول مرة أخرى لاحقًا.",
    paymentStartError: "حدث خطأ أثناء بدء الدفع. حاول مرة أخرى لاحقًا.",
    checkoutOpenStarterError:
      "تعذر فتح صفحة دفع باقة Starter في الوقت الحالي. يُرجى إعادة المحاولة بعد لحظات.",
    checkoutOpenProError:
      "تعذر فتح صفحة دفع باقة Pro في الوقت الحالي. يُرجى إعادة المحاولة بعد لحظات.",
    checkoutOpenScaleError:
      "تعذر فتح صفحة دفع باقة Scale في الوقت الحالي. يُرجى إعادة المحاولة بعد لحظات أو تواصل معنا إذا استمرت المشكلة.",
    checkoutOpenGenericError:
      "تعذر فتح صفحة الدفع في الوقت الحالي. يُرجى إعادة المحاولة بعد لحظات.",
    upsellSoftMessage:
      "لم يتبقَّ سوى عمليتي تدقيق. يمكنك شراء المزيد من رصيد التدقيق في أي وقت.",
    upsellCriticalMessage:
      "آخر عملية تدقيق متاحة. يمكنك شراء المزيد من رصيد التدقيق متى احتجت إليه.",
    upsellEmptyFreeMessage:
      "لم يعد لديك أي أرصدة. اشترِ رصيد تدقيق متى احتجت إليه: Starter (تدقيق واحد) أو Pro (5 عمليات تدقيق) أو Scale (15 عملية تدقيق). كلما كبرت الباقة انخفضت تكلفة التدقيق الواحد.",
    upsellEmptyProMessage:
      "لم يعد لديك أي أرصدة. اشترِ رصيد تدقيق متى احتجت إليه: Starter (تدقيق واحد) أو Pro (5 عمليات تدقيق) أو Scale (15 عملية تدقيق). كلما كبرت الباقة انخفضت تكلفة التدقيق الواحد.",
    upsellEmptyScaleMessage:
      "لم تعد لديك عمليات تدقيق متاحة. اشترِ المزيد من رصيد التدقيق متى احتجت إليه.",
    upsellBalanceText:
      "الرصيد المخصص لعمليات التدقيق الجديدة: {remaining} رصيد (وليس عدد التقارير الموجودة بالفعل في السجل). كل عملية شراء تُضاف إلى رصيدك الحالي.",
    starter: {
      name: "Starter",
      audience: "مثالي لتجربة المنصة",
      subtitle: "تدقيق واحد",
      description:
        "مثالي لاحتياج لمرة واحدة، لكنه يصبح مكلفًا سريعًا إذا كنت تُجري عمليات تدقيق بانتظام.",
      bulletOne: "عملية تدقيق واحدة للإعلان الذي تختاره",
      conversionReading: "تحليل تحويل الإعلان",
      bulletThree: "التوصيات ذات الأولوية",
      bulletTwo: "شراء فردي",
      cta: "شراء عملية تدقيق واحدة",
    },
    pro: {
      name: "Pro",
      subtitle: "باقة 5 عمليات تدقيق (دفع لمرة واحدة)",
      description: "باقة لمرة واحدة، من دون اشتراك.",
      bulletOne: "5 عمليات تدقيق للاستخدام بعد الشراء",
      conversionReading: "تحليل تحويل الإعلان",
      cta: "شراء باقة Pro (5 عمليات تدقيق)",
      audience: "أفضل توازن لمقارنة عدة إعلانات",
      savings:
        "باقة لمرة واحدة، من دون اشتراك. حوالي {unit} لكل تدقيق، مع توفير {savings} مقارنة بـ {total} عمليات شراء فردية.",
      bulletTwo: "قارن عدة إعلانات",
      bulletThree: "ترتيب واضح للأولويات",
      bulletFour: "مشتريات فردية أقل واستمرارية أكبر",
    },
    scale: {
      name: "Scale",
      subtitle: "باقة 15 عملية تدقيق (دفع لمرة واحدة)",
      description: "باقة لمرة واحدة، من دون اشتراك.",
      bulletOne: "15 عملية تدقيق للاستخدام بعد الشراء",
      conversionReading: "تحليل تحويل الإعلان",
      cta: "شراء باقة Scale (15 عملية تدقيق)",
      audience: "مصممة للمحافظ الأكبر",
      savings:
        "باقة لمرة واحدة، من دون اشتراك. حوالي {unit} لكل تدقيق، مع توفير {savings} مقارنة بـ {total} عمليات شراء فردية.",
      bulletTwo: "تكلفة وحدة محسّنة (أقل من Pro بنسبة {reduction}%)",
      bulletThree: "متابعة متعددة الإعلانات بشكل مبسّط",
      bulletFour: "مصممة للفرق ومديري العقارات",
    },
    heroTitle: "اختر باقة التدقيق الخاصة بك",
    sessionExpired:
      "انتهت صلاحية جلستك. سجّل الدخول مرة أخرى ثم حاول من جديد.",
    workspaceBillingNotFound:
      "تعذر العثور على مساحة العمل أو ملف الفوترة. أعد تحميل الصفحة أو سجّل الدخول مرة أخرى.",
    workspaceBillingMissing:
      "لم يتم تمرير مساحة عمل الفوترة. أعد تحميل صفحة الفوترة ثم حاول مجددًا.",
    paymentServiceUnavailable:
      "خدمة الدفع غير متاحة مؤقتًا. حاول مرة أخرى لاحقًا.",
    planLoadingMessage:
      "لا يزال تحميل خطتك جاريًا. حاول مرة أخرى بعد لحظات.",
    paymentValidationHoldMessage:
      "يتم التحقق من الدفع. ستُضاف أرصدتك بمجرد تأكيد الدفع، لذا انتظر قليلًا قبل إجراء عملية شراء أخرى.",
    paymentAlreadyInProgressMessage:
      "توجد عملية دفع جارية بالفعل. انتظر بضع ثوانٍ.",
    incompletePaymentResponse:
      "استجابة الدفع غير مكتملة (رابط إعادة التوجيه مفقود).",
    auditTestUnlockedVisible:
      "تم شراء التدقيق التجريبي وهو ظاهر الآن ضمن عمليات التدقيق لديك",
    auditTestUnlocked: "تم شراء التدقيق التجريبي",
    duplicateAuditUnlockedLocal:
      "هذا التدقيق التجريبي مفتوح بالفعل لهذا الإعلان.",
    duplicateAuditUnlockedPersisted:
      "تم شراء هذا التدقيق التجريبي لهذا الإعلان بالفعل.",
    behaviorUpsellStarterPurchaseMessage:
      "أنت تشتري عمليات تدقيق فردية كثيرًا. كلما كبرت الباقة انخفضت تكلفة التدقيق الواحد: Pro (5 عمليات تدقيق، دفع لمرة واحدة). يمكنك شراء أي عرض في أي وقت.",
    behaviorUpsellHighPaceMessage:
      "وتيرة استخدامك مرتفعة. تكلفة التدقيق الواحد أقل مع Scale (15 عملية تدقيق، دفع لمرة واحدة)، ويمكنك شراء أي عرض في أي وقت.",
    behaviorUpsellScaleDepletedMessage:
      "نفدت أرصدتك. اشترِ المزيد من رصيد التدقيق متى احتجت إليه.",
    paymentSuccessAuditTest:
      "تم الدفع بنجاح. أصبح التدقيق التجريبي الآن مفتوحًا.",
    viewListings: "عرض الإعلانات",
    behaviorUpsellFooter:
      "استنادًا إلى استخدامك الأخير (الرصيد المخصص لعمليات التدقيق الجديدة: {remaining} رصيد).",
    behaviorUpsellFooterScaleNote:
      "الزر أعلاه يطلق نفس عملية الشراء الموجودة على بطاقة Scale (باقة، دفع لمرة واحدة).",
  },
} as const;


function formatEuroPerAudit(value: number): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

/** Messages API Stripe / auth parfois en anglais : homogénéise l’affichage billing. */
function normalizeCheckoutErrorMessage(
  copy: {
    checkoutOpenStarterError: string;
    checkoutOpenProError: string;
    checkoutOpenScaleError: string;
    checkoutOpenGenericError: string;
    sessionExpired: string;
    workspaceBillingNotFound: string;
    workspaceBillingMissing: string;
    paymentServiceUnavailable: string;
  },
  plan: "audit_test" | "pro" | "scale" | "starter",
  raw: string | null
): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const lower = trimmed.toLowerCase();

  if (
    lower === "failed to create checkout session" ||
    lower.includes("failed to create checkout session")
  ) {
    return plan === "scale"
      ? copy.checkoutOpenScaleError
      : plan === "pro"
        ? copy.checkoutOpenProError
        : plan === "starter"
          ? copy.checkoutOpenStarterError
          : copy.checkoutOpenGenericError;
  }

  if (lower === "unauthorized") {
    return copy.sessionExpired;
  }

  if (
    lower === "workspace not found" ||
    lower === "forbidden workspace" ||
    lower.includes("unable to verify workspace") ||
    lower.includes("unable to load workspace") ||
    lower.includes("unable to load billing profile")
  ) {
    return copy.workspaceBillingNotFound;
  }

  if (lower.includes("workspaceid requis") || lower.includes("workspace_id requis")) {
    return copy.workspaceBillingMissing;
  }

  if (
    trimmed.toLowerCase().includes("stripe") &&
    (trimmed.toLowerCase().includes("price") ||
      trimmed.toLowerCase().includes("price id") ||
      trimmed.toLowerCase().includes("configuré"))
  ) {
    return plan === "scale"
      ? copy.checkoutOpenScaleError
      : plan === "pro"
        ? copy.checkoutOpenProError
        : plan === "starter"
          ? copy.checkoutOpenStarterError
          : copy.checkoutOpenGenericError;
  }

  if (
    trimmed.toLowerCase().includes("application url") ||
    trimmed.toLowerCase().includes("next_public_app_url")
  ) {
    return copy.paymentServiceUnavailable;
  }

  if (trimmed.length > 0) {
    return trimmed;
  }

  return plan === "scale"
    ? copy.checkoutOpenScaleError
    : plan === "pro"
      ? copy.checkoutOpenProError
      : plan === "starter"
        ? copy.checkoutOpenStarterError
        : copy.checkoutOpenGenericError;
}

const PACK_CHECKOUT_PLANS = new Set(["starter", "pro", "scale"]);
const PENDING_INTENT_MAX_AGE_MS = 120_000;
/** Pause between two confirmation checks after the Stripe redirect. */
const POST_PAYMENT_POLL_MS = 2_500;

type PackCheckoutIntentSnapshot = {
  status: string;
  plan_code: string;
  created_at: string;
};

export default function BillingPage() {
  const { copy } = useTranslation(billingCopy);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [checkoutStatus, setCheckoutStatus] = useState<"success" | "cancel" | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<"audit_test" | "pro" | "scale" | "starter" | null>(
    null
  );
  const [freeNotice, setFreeNotice] = useState<string | null>(null);
  const [proNotice, setProNotice] = useState<string | null>(null);
  const [scaleNotice, setScaleNotice] = useState<string | null>(null);
  /** Checkout en cours : verrou UI + libellé du bouton actif (null = aucun). */
  const [checkoutInFlight, setCheckoutInFlight] = useState<
    "audit_test" | "pro" | "scale" | "starter" | null
  >(null);
  /** Verrou synchrone anti double-clic avant le premier await (même plan = préflight Starter autorisé). */
  const checkoutActivePlanRef = useRef<"audit_test" | "pro" | "scale" | "starter" | null>(null);
  const paymentValidationHoldTimeoutRef = useRef<number | null>(null);
  const [hasAuditTestPurchase, setHasAuditTestPurchase] = useState(false);
  const [auditTestPurchaseCount, setAuditTestPurchaseCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [availableAuditCredits, setAvailableAuditCredits] = useState(0);
  const [grantedAuditCredits, setGrantedAuditCredits] = useState(0);
  const [consumedAuditCredits, setConsumedAuditCredits] = useState(0);
  /** Après retour Stripe : fenêtre courte où l’on affiche « validation » même avant sync webhook. */
  const [paymentValidationHold, setPaymentValidationHold] = useState(false);
  const [packCheckoutIntent, setPackCheckoutIntent] = useState<PackCheckoutIntentSnapshot | null>(
    null
  );
  const processedCheckoutSessionRef = useRef<string | null>(null);
  /** Rafraîchit le calcul d’âge du intent pending (expiration 2 min). */
  const [intentAgeTick, setIntentAgeTick] = useState(0);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const freePlan = pricingPlans.find((plan) => plan.code === "free");
  const proPlan = pricingPlans.find((plan) => plan.code === "pro");
  const scalePlan = pricingPlans.find((plan) => plan.code === "scale");
  /** Pro = pack ponctuel 5 audits (prix affiché = tarif pack dans pricingPlans). */
  const proPrice = proPlan?.monthly ?? 39;
  /** Scale = pack ponctuel : le prix affiché suit toujours le tarif pack (monthly dans pricingPlans). */
  const scalePrice = scalePlan?.monthly ?? 99;
  const auditTestTotalPrice = 9;
  const hasUsedFreeAudit = auditCount > 0 || hasAuditTestPurchase;
  const auditTestStatusLabel = hasAuditTestPurchase
    ? auditCount > 0
      ? copy.auditTestUnlockedVisible
      : copy.auditTestUnlocked
    : null;
  const starterTotalAudits = OFFER_CREDIT_TOTALS.starter;
  const proTotalAudits = OFFER_CREDIT_TOTALS.pro;
  const scaleTotalAudits = OFFER_CREDIT_TOTALS.scale;
  const proUnitEuro =
    proTotalAudits > 0 ? Math.round((proPrice / proTotalAudits) * 100) / 100 : 0;
  const scaleUnitEuro =
    scaleTotalAudits > 0 ? Math.round((scalePrice / scaleTotalAudits) * 100) / 100 : 0;
  const proSavingsVsStarterPack = proTotalAudits * auditTestTotalPrice - proPrice;
  const scaleSavingsVsStarterPack = scaleTotalAudits * auditTestTotalPrice - scalePrice;
  const proUnitForCompare = proTotalAudits > 0 ? proPrice / proTotalAudits : 0;
  const scaleUnitForCompare = scaleTotalAudits > 0 ? scalePrice / scaleTotalAudits : 0;
  const scaleUnitCostReductionVsPro =
    proUnitForCompare > 0
      ? Math.round(
          ((proUnitForCompare - scaleUnitForCompare) / proUnitForCompare) * 100
        )
      : 0;
  const remainingAuditCredits = Math.max(grantedAuditCredits - consumedAuditCredits, 0);
  const starterRemainingAudits = remainingAuditCredits;
  const proRemainingAudits = remainingAuditCredits;
  const scaleRemainingAudits = remainingAuditCredits;
  const activePlanCode = planCode === "scale" ? "scale" : planCode === "pro" ? "pro" : "free";
  const activePlanTotal =
    activePlanCode === "scale" ? scaleTotalAudits : activePlanCode === "pro" ? proTotalAudits : starterTotalAudits;
  const activePlanRemaining =
    activePlanCode === "scale"
      ? scaleRemainingAudits
      : activePlanCode === "pro"
        ? proRemainingAudits
        : starterRemainingAudits;
  const pendingPackIntentRecent = useMemo(() => {
    if (!packCheckoutIntent || packCheckoutIntent.status !== "pending") return false;
    if (!PACK_CHECKOUT_PLANS.has(String(packCheckoutIntent.plan_code ?? "").toLowerCase())) {
      return false;
    }
    const created = new Date(packCheckoutIntent.created_at).getTime();
    if (!Number.isFinite(created)) return false;
    const age = Date.now() - created;
    return age >= 0 && age < PENDING_INTENT_MAX_AGE_MS;
  }, [packCheckoutIntent, intentAgeTick]);

  const isPaymentProcessing = paymentValidationHold;

  // Offer chosen on /pricing (kept through sign-in): highlighted only, the customer still confirms the payment.
  const preselectedOffer = searchParams.get("offer");
  const preselectedPlan =
    preselectedOffer === "audit_test" ? "starter" : preselectedOffer === "pack_5" ? "pro" : preselectedOffer === "pack_15" ? "scale" : null;
  const offerRing = (plan: "starter" | "pro" | "scale") =>
    preselectedPlan === plan ? " ring-4 ring-blue-500/70" : "";
  const checkoutLocked = loadingPlan || checkoutInFlight !== null || isPaymentProcessing;
  const upsellState = getBillingUpsellState(
    activePlanCode,
    isPlatformAdmin ? Math.max(activePlanRemaining, 99) : activePlanRemaining
  );
  const proSavingsText = copy.pro.savings
    .replace("{unit}", formatEuroPerAudit(proUnitEuro))
    .replace("{savings}", String(proSavingsVsStarterPack))
    .replace("{total}", String(proTotalAudits));

  const scaleSavingsText = copy.scale.savings
    .replace("{unit}", formatEuroPerAudit(scaleUnitEuro))
    .replace("{savings}", String(scaleSavingsVsStarterPack))
    .replace("{total}", String(scaleTotalAudits))
    .replace("{reduction}", String(scaleUnitCostReductionVsPro));

  const hasFrequentStarterPurchases =
    activePlanCode === "free" && auditTestPurchaseCount >= 2;
  const hasFrequentProConsumption =
    activePlanCode === "pro" && grantedAuditCredits >= proTotalAudits * 2;
  const behaviorUpsellComputed: {
    show: boolean;
    tone: "soft" | "critical";
    message: string | null;
    action: UpsellAction;
    ctaLabel: string | null;
  } = hasFrequentStarterPurchases
    ? {
        show: true,
        tone: "soft",
        message: copy.behaviorUpsellStarterPurchaseMessage,
        action: "upgrade_pro",
        ctaLabel: copy.pro.cta,
      }
    : hasFrequentProConsumption && activePlanRemaining <= 2
      ? {
          show: true,
          tone: "critical",
          message: copy.behaviorUpsellHighPaceMessage,
          action: "upgrade_scale",
          ctaLabel: copy.scale.cta,
        }
      : activePlanCode === "scale" && activePlanRemaining === 0
        ? {
            show: true,
            tone: "critical",
            message: copy.behaviorUpsellScaleDepletedMessage,
            action: "buy_top_up",
            ctaLabel: copy.starter.cta,
          }
        : {
            show: false,
            tone: "soft",
            message: null,
            action: null,
            ctaLabel: null,
          };

  const behaviorUpsell = isPlatformAdmin
    ? { show: false, tone: "soft" as const, message: null, action: null, ctaLabel: null }
    : behaviorUpsellComputed;

  const recommendedOfferCode =
    behaviorUpsell.action === "upgrade_pro"
      ? "pro"
      : behaviorUpsell.action === "upgrade_scale"
        ? "scale"
        : null;
  const strategicRecommendedOfferCode =
    isPlatformAdmin
      ? null
      : recommendedOfferCode ??
        (activePlanCode === "free" ? "pro" : activePlanCode === "pro" ? "scale" : null);
  const localizedUpsellMessage =
    upsellState.tone === "soft"
      ? copy.upsellSoftMessage
      : upsellState.tone === "critical"
        ? copy.upsellCriticalMessage
        : upsellState.action === "upgrade_pro"
          ? copy.upsellEmptyFreeMessage
          : upsellState.action === "upgrade_scale"
            ? copy.upsellEmptyProMessage
            : copy.upsellEmptyScaleMessage;
  const localizedUpsellCtaLabel =
    upsellState.action === "upgrade_pro"
      ? copy.pro.cta
      : upsellState.action === "upgrade_scale"
        ? copy.scale.cta
        : upsellState.action === "buy_top_up"
          ? copy.starter.cta
          : null;
  const localizedUpsellBalanceText = copy.upsellBalanceText
    .replace("{remaining}", String(activePlanRemaining))
    .replace("{total}", String(activePlanTotal));
  const billingUiReady = !loadingPlan;
  /** Inclure la query (retour Stripe, etc.) pour relire plan + crédits après chaque achat. */
  const billingSearchSignature = searchParams.toString();

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        if (mounted) setIsPlatformAdmin(false);
        return;
      }

      try {
        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await res.json().catch(() => null)) as { isAdminPrivate?: boolean } | null;
        if (mounted) {
          setIsPlatformAdmin(Boolean(res.ok && body?.isAdminPrivate));
        }
      } catch {
        if (mounted) setIsPlatformAdmin(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [billingSearchSignature]);

  useEffect(() => {
    let mounted = true;

    async function loadPlan() {
      try {
        setLoadingPlan(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
  
        if (!user) return;
  
        const workspace = await getOrCreateWorkspaceForUser({
          userId: user.id,
          email: user.email ?? null,
          client: supabase,
        });
  
        if (!workspace || !mounted) return;
  
        const canonicalWorkspaceId = workspace.id;
        const storedWorkspaceId = getStoredWorkspaceId();
        if (storedWorkspaceId && storedWorkspaceId !== canonicalWorkspaceId) {
          console.info("[billing][workspace] syncing_stored_to_canonical_session_workspace", {
            userId: user.id,
            previousStoredWorkspaceId: storedWorkspaceId,
            selectedWorkspaceId: canonicalWorkspaceId,
            reason: "session_workspace_authoritative_on_billing",
          });
        }

        setStoredWorkspaceId(canonicalWorkspaceId);
        const activeWorkspaceId = canonicalWorkspaceId;
        setCurrentWorkspaceId(activeWorkspaceId);
  
        const [subscriptionResult, metricsResult, creditsResult] =
          await Promise.allSettled([
            ensureWorkspaceSubscription(activeWorkspaceId, supabase),
            Promise.all([
              supabase
                .from("usage_events")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", activeWorkspaceId)
                .eq("event_type", "audit_test_purchased"),
              supabase
                .from("audits")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", activeWorkspaceId),
            ]),
            getWorkspaceAuditCredits(activeWorkspaceId, supabase),
          ]);
  
        if (!mounted) return;
  
        const subscription =
          subscriptionResult.status === "fulfilled" ? subscriptionResult.value : null;
  
        setPlanCode(subscription?.plan_code ?? "free");
  
        if (metricsResult.status === "fulfilled") {
          const [
            { count: purchasedCount, error: usageError },
            { count: createdAuditCount, error: auditsError },
          ] = metricsResult.value;
  
          if (usageError) {
            console.warn("Failed to load audit_test purchase events", usageError);
            setHasAuditTestPurchase(false);
            setAuditTestPurchaseCount(0);
          } else {
            setHasAuditTestPurchase((purchasedCount ?? 0) > 0);
            setAuditTestPurchaseCount(purchasedCount ?? 0);
          }
  
          if (auditsError) {
            console.warn("Failed to load audit count for billing", auditsError);
            setAuditCount(0);
          } else {
            setAuditCount(createdAuditCount ?? 0);
          }
        } else {
          setHasAuditTestPurchase(false);
          setAuditTestPurchaseCount(0);
          setAuditCount(0);
        }
  
        if (creditsResult.status === "fulfilled") {
          setAvailableAuditCredits(creditsResult.value.available);
          setGrantedAuditCredits(creditsResult.value.granted);
          setConsumedAuditCredits(creditsResult.value.consumed);
          console.info("[billing][balance] client_billing_snapshot", {
            workspaceId: activeWorkspaceId,
            granted: creditsResult.value.granted,
            consumed: creditsResult.value.consumed,
            available: creditsResult.value.available,
            billingSearchSignature,
          });
        } else {
          setAvailableAuditCredits(0);
          setGrantedAuditCredits(0);
          setConsumedAuditCredits(0);
        }
      } finally {
        if (mounted) {
          setLoadingPlan(false);
        }
      }
    }
  
    void loadPlan();
  
    return () => {
      mounted = false;
    };
  }, [billingSearchSignature]);

  useEffect(() => {
    return () => {
      if (paymentValidationHoldTimeoutRef.current) {
        window.clearTimeout(paymentValidationHoldTimeoutRef.current);
        paymentValidationHoldTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!packCheckoutIntent) return;
    const id = window.setInterval(() => setIntentAgeTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [packCheckoutIntent]);

  useEffect(() => {
    if (!currentWorkspaceId?.trim()) return;
    let cancelled = false;

    async function loadPackCheckoutIntent() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;
      const response = await fetch("/api/billing/checkout-intent-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!response.ok || cancelled) return;
      const body = (await response.json().catch(() => null)) as {
        intent: PackCheckoutIntentSnapshot | null;
      } | null;
      if (cancelled) return;
      setPackCheckoutIntent(body?.intent ?? null);
    }

    void loadPackCheckoutIntent();

    const shouldPoll = paymentValidationHold || pendingPackIntentRecent;
    if (!shouldPoll) {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => void loadPackCheckoutIntent(), 4_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentWorkspaceId, billingSearchSignature, paymentValidationHold, pendingPackIntentRecent]);

  async function fetchPostPaymentState(checkoutSessionId: string): Promise<PostPaymentState> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return "pending";
      const response = await fetch(
        `/api/billing/checkout-intent-status?session_id=${encodeURIComponent(checkoutSessionId)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" }
      );
      if (!response.ok) return "pending";
      const body = (await response.json().catch(() => null)) as {
        intent?: { status?: string | null; completed_at?: string | null } | null;
      } | null;
      return resolvePostPaymentState(body?.intent);
    } catch {
      return "pending";
    }
  }

  useEffect(() => {
    let mounted = true;

    async function handleCheckoutState() {
      const status = searchParams.get("checkout");
      const success = searchParams.get("success");
      const canceled = searchParams.get("canceled");
      const plan = searchParams.get("plan");
      const checkoutSessionId = searchParams.get("session_id")?.trim() ?? "";

      if (plan === "audit_test" || plan === "pro" || plan === "scale" || plan === "starter") {
        setCheckoutPlan(plan);
      }

      if (status === "success" || success === "true") {
        setPaymentValidationHold(true);
        if (paymentValidationHoldTimeoutRef.current) {
          window.clearTimeout(paymentValidationHoldTimeoutRef.current);
        }

        // The purchase is announced as successful only once the webhook has finished (credit granted, intent completed).
        // No audit is created or restored here: the customer launches a real audit from the dashboard.
        if (!checkoutSessionId) {
          if (!mounted) return;
          setPaymentValidationHold(false);
          setFreeNotice(copy.paymentValidationHoldMessage);
          router.replace("/dashboard/billing");
          return;
        }

        if (processedCheckoutSessionRef.current === checkoutSessionId) {
          return;
        }
        processedCheckoutSessionRef.current = checkoutSessionId;

        const outcome = await waitForPostPaymentConfirmation({
          fetchState: () => fetchPostPaymentState(checkoutSessionId),
          sleep: (ms) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
          now: Date.now,
          isActive: () => mounted,
          pollMs: POST_PAYMENT_POLL_MS,
        });

        if (outcome === "credit_available") {
          setCheckoutStatus("success");
          setFreeNotice(null);
          setPaymentValidationHold(false);
          router.replace("/dashboard/billing");
        } else if (outcome === "failed") {
          setCheckoutStatus("cancel");
          setPaymentValidationHold(false);
          router.replace("/dashboard/billing");
        } else if (outcome === "still_pending") {
          setPaymentValidationHold(false);
          setFreeNotice(copy.paymentValidationHoldMessage);
          router.replace("/dashboard/billing");
        }
        return;
      }

      if (status === "cancel" || canceled === "true") {
        setCheckoutStatus("cancel");
        router.replace("/dashboard/billing");
      }
    }

    void handleCheckoutState();

    return () => {
      mounted = false;
    };
  }, [router, searchParams, copy.paymentValidationHoldMessage]);

  function releaseCheckoutLock() {
    checkoutActivePlanRef.current = null;
    setCheckoutInFlight(null);
  }

  async function handleCheckout(
    plan: "audit_test" | "pro" | "scale" | "starter",
    options?: { quantity?: number },
    meta?: { continuationAfterAuditPreflight?: boolean }
  ): Promise<CheckoutResult> {
    if (loadingPlan) {
      releaseCheckoutLock();
      return {
        ok: false,
        message: copy.planLoadingMessage,
      };
    }

    if (isPaymentProcessing) {
      releaseCheckoutLock();
      return {
        ok: false,
        message: copy.paymentValidationHoldMessage,
      };
    }

    const active = checkoutActivePlanRef.current;
    if (active !== null && active !== plan) {
      return {
        ok: false,
        message: copy.paymentAlreadyInProgressMessage,
      };
    }
    if (
      active !== null &&
      active === plan &&
      !(meta?.continuationAfterAuditPreflight && plan === "audit_test")
    ) {
      return {
        ok: false,
        message: copy.paymentAlreadyInProgressMessage,
      };
    }
    if (active === null) {
      checkoutActivePlanRef.current = plan;
      setCheckoutInFlight(plan);
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        releaseCheckoutLock();
        return { ok: false, message: copy.loginRequired };
      }

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
        client: supabase,
      });

      if (!workspace) {
        releaseCheckoutLock();
        return {
          ok: false,
          message: copy.workspaceNotFound,
        };
      }

      const checkoutWorkspaceId = workspace.id.trim();
      setStoredWorkspaceId(checkoutWorkspaceId);
      setCurrentWorkspaceId(checkoutWorkspaceId);

      console.info("[billing][checkout] workspace_id_sent_by_billing", {
        userId: user.id,
        plan,
        workspace_id_sent_by_billing: checkoutWorkspaceId,
        reason: "same_as_getOrCreateWorkspaceForUser_session_workspace",
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          workspaceId: checkoutWorkspaceId,
          plan,
          ...(plan === "scale" || plan === "pro" || plan === "starter"
            ? { checkoutMode: "one_shot" as const }
            : { interval: "month" as const }),
          ...(plan === "audit_test" ? { quantity: options?.quantity ?? 1 } : {}),
          ...(plan === "audit_test"
            ? (() => {
                const draft = loadGuestAuditDraft();
                return draft
                  ? {
                      auditPreview: {
                        listingUrl: draft.listing_url,
                        title: draft.title ?? null,
                        platform: draft.platform ?? null,
                        generatedAt: draft.generated_at,
                        score: draft.result.score ?? null,
                        summary:
                          typeof draft.full_payload === "object" &&
                          draft.full_payload &&
                          !Array.isArray(draft.full_payload) &&
                          "summary" in draft.full_payload
                            ? String((draft.full_payload as { summary?: string | null }).summary ?? "")
                            : null,
                      },
                    }
                  : {};
              })()
            : {}),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.warn("Failed to start Stripe checkout", {
          plan,
          status: response.status,
          error: data?.error ?? null,
        });
        const apiMsg =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : null;
        releaseCheckoutLock();
        return {
          ok: false,
          message: normalizeCheckoutErrorMessage(
            copy,
            plan,
            apiMsg ?? copy.checkoutOpenGenericError
          ),
        };
      }

      if (data?.url) {
        window.location.href = data.url as string;
        return { ok: true };
      }

      releaseCheckoutLock();
      return {
        ok: false,
        message: copy.incompletePaymentResponse,
      };
    } catch (error) {
      console.warn(`Stripe checkout error for ${plan}`, error);
      releaseCheckoutLock();
      return {
        ok: false,
        message: copy.paymentStartError,
      };
    }
  }

  async function handleUpgradeToPro() {
    setProNotice(null);
    const result = await handleCheckout("pro");
    if (!result.ok) {
      setProNotice(
        result.message || copy.checkoutOpenProError
      );
    }
  }

  async function handleProCardCTA() {
    setProNotice(null);
    if (loadingPlan) {
      setProNotice(copy.planLoadingMessage);
      return;
    }
    const result = await handleCheckout("pro");
    if (!result.ok) {
      setProNotice(
        result.message || copy.checkoutOpenProError
      );
    }
  }

  async function handleStarterPackCheckout() {
    setFreeNotice(null);
    if (loadingPlan) {
      return;
    }
    const result = await handleCheckout("starter");
    if (!result.ok) {
      setFreeNotice(
        result.message || copy.checkoutOpenStarterError
      );
    }
  }

  async function handleAuditTestCheckout() {
    setFreeNotice(null);

    if (loadingPlan) {
      return;
    }

    const isCreditTopUp = hasUsedFreeAudit;
    if (isCreditTopUp) {
      await handleStarterPackCheckout();
      return;
    }

    const draft = loadGuestAuditDraft();

    if (draft?.payment_status === "paid" || draft?.persisted_audit_id) {
      console.info("[billing][audit_test] blocked duplicate payment from local draft", {
        workspaceId: currentWorkspaceId,
        generatedAt: draft?.generated_at ?? null,
        persistedAuditId: draft?.persisted_audit_id ?? null,
      });
      setFreeNotice(copy.duplicateAuditUnlockedLocal);
      return;
    }

    if (checkoutActivePlanRef.current !== null) {
      return;
    }
    checkoutActivePlanRef.current = "audit_test";
    setCheckoutInFlight("audit_test");

    if (!isCreditTopUp && draft?.generated_at && currentWorkspaceId) {
      const { data: existingAudits, error } = await supabase
        .from("audits")
        .select("id, result_payload")
        .eq("workspace_id", currentWorkspaceId)
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) {
        console.warn("Failed to verify duplicate audit_test payment state", error);
      } else {
        const matchingAudit = (existingAudits ?? []).find((audit) => {
          const payload =
            audit &&
            typeof audit === "object" &&
            "result_payload" in audit &&
            audit.result_payload &&
            typeof audit.result_payload === "object"
              ? (audit.result_payload as { guest_draft_generated_at?: string })
              : null;

          return payload?.guest_draft_generated_at === draft.generated_at;
        });

        if (matchingAudit && typeof matchingAudit === "object" && "id" in matchingAudit) {
          saveGuestAuditDraft({
            ...draft,
            payment_status: "paid",
            persisted_audit_id: String(matchingAudit.id),
          });
          console.info("[billing][audit_test] blocked duplicate payment from persisted audit", {
            workspaceId: currentWorkspaceId,
            generatedAt: draft.generated_at,
            auditId: matchingAudit.id,
          });
          releaseCheckoutLock();
          setFreeNotice(copy.duplicateAuditUnlockedPersisted);
          return;
        }
      }
    }

    const result = await handleCheckout("audit_test", undefined, {
      continuationAfterAuditPreflight: true,
    });

    if (!result.ok) {
      setFreeNotice(
        result.message || copy.checkoutOpenGenericError
      );
    }
  }

  async function handleScaleCTA() {
    setScaleNotice(null);
    const result = await handleCheckout("scale");

    if (!result.ok) {
      setScaleNotice(
        result.message || copy.checkoutOpenScaleError
      );
    }
  }

  return (
    <div className="space-y-7 text-sm md:space-y-8">
      {checkoutStatus === "success" && (
        <div className="nk-card-accent nk-card-accent-emerald nk-card-hover flex flex-col items-start justify-between gap-2 rounded-2xl border border-emerald-200/85 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-[0_10px_24px_rgba(5,150,105,0.12),0_1px_0_rgba(255,255,255,0.62)_inset] sm:flex-row sm:items-center">
          <span>
            {checkoutPlan === "audit_test" || checkoutPlan === "starter"
              ? copy.paymentSuccessStarter
              : checkoutPlan === "scale"
              ? copy.paymentSuccessScale
              : checkoutPlan === "pro"
              ? copy.paymentSuccessPro
              : copy.paymentSuccessGeneric}
          </span>
          {(checkoutPlan === "pro" || checkoutPlan === "scale" || checkoutPlan === "starter" || checkoutPlan === "audit_test") && (
            <Link
              href="/dashboard/listings"
              className="nk-ghost-btn text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              {copy.viewListings}
            </Link>
          )}
        </div>
      )}

      {checkoutStatus === "cancel" && (
        <div className="nk-card-accent nk-card-hover rounded-2xl border border-amber-200/85 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_10px_24px_rgba(180,83,9,0.1),0_1px_0_rgba(255,255,255,0.62)_inset]">
          {checkoutPlan === "audit_test"
            ? copy.paymentCancelAuditTest
            : checkoutPlan === "starter"
              ? copy.paymentCancelStarter
            : checkoutPlan === "scale"
            ? copy.paymentCancelScale
            : checkoutPlan === "pro"
            ? copy.paymentCancelPro
            : copy.paymentCancelGeneric}
        </div>
      )}

      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-5 py-6 md:px-8 xl:px-10 xl:py-9 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="space-y-2.5">
          <p className="nk-kicker-muted">{copy.heading}</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            {copy.heroTitle}
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted max-w-2xl text-[15px] leading-7 text-slate-600">
            {copy.subtitle}
          </p>
          <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-600">
            {isPlatformAdmin ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/70 bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1.5 text-[11px] font-semibold normal-case tracking-normal text-white shadow-[0_8px_26px_rgba(124,58,237,0.35)]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                {copy.adminUnlimited}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 bg-slate-900 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_8px_26px_rgba(15,23,42,0.22)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]" />
              <span className="font-semibold normal-case tracking-normal text-white/95">
                {copy.availableCredits} :{" "}
                <span className="tabular-nums text-white">
                {loadingPlan ? "—" : availableAuditCredits}
                </span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {copy.averageBookings}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              {copy.revenueActions}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {copy.realDataAnalysis}
            </span>
          </div>
        </div>
      </div>

      {billingUiReady ? (
      <>
      {isPaymentProcessing ? (
        <div
          className="nk-card relative overflow-hidden rounded-2xl border border-sky-200/90 bg-[linear-gradient(135deg,rgba(240,249,255,0.95)_0%,rgba(255,255,255,0.98)_45%,rgba(224,242,254,0.35)_100%)] px-4 py-3.5 shadow-[0_12px_40px_rgba(14,165,233,0.12),0_0_0_1px_rgba(255,255,255,0.6)_inset,0_0_48px_rgba(56,189,248,0.08)] md:px-5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 sm:items-center">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200/80 bg-white/90 shadow-sm sm:mt-0">
              <svg
                className="h-4 w-4 animate-spin text-sky-600"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
            <p className="text-sm font-medium leading-relaxed text-slate-800">
              {copy.paymentProcessing}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-6 md:grid-cols-3 md:gap-7 xl:gap-8">
        <div className={`flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_rgba(15,23,42,0.15)]${offerRing("starter")}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {copy.starter.name}
            </p>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {copy.starter.audience}
          </p>
          <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.03em] text-slate-950 md:text-6xl">
            {auditTestTotalPrice} €
          </p>
          <p className="mt-1 text-[15px] font-medium text-slate-600">
            {copy.starter.subtitle}
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-slate-600">
            {copy.starter.description}
          </p>
          <ul className="mt-3 space-y-1.5 text-[15px] leading-7 text-slate-700">
            <li>• {copy.starter.bulletOne}</li>
            <li>• {copy.conversionReading}</li>
            <li>• {copy.starter.bulletThree}</li>
            <li>• {copy.starter.bulletTwo}</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={() => void handleStarterPackCheckout()}
            disabled={checkoutLocked}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPlan
              ? copy.checking
              : checkoutInFlight === "starter"
                ? copy.checkoutLoading
                : copy.starter.cta}
          </button>
          {freeNotice ? (
            <p className="mt-2 text-[11px] text-slate-700">{freeNotice}</p>
          ) : null}
          {auditTestStatusLabel ? (
            <p className="mt-2 text-[11px] text-emerald-700">{auditTestStatusLabel}</p>
          ) : null}
        </div>

        <div className={`relative z-10 flex h-full scale-[1.03] flex-col rounded-2xl border border-orange-300 bg-gradient-to-b from-orange-50/80 via-white to-white p-4 shadow-[0_20px_50px_rgba(249,115,22,0.25)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_20px_50px_rgba(249,115,22,0.25)] md:scale-[1.04] ${
          strategicRecommendedOfferCode === "pro"
            ? "ring-2 ring-emerald-300/80"
            : "ring-1 ring-orange-200/70"
        }${offerRing("pro")}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
              {copy.pro.name}
            </p>
            <div className="flex items-center gap-1.5">
              {strategicRecommendedOfferCode === "pro" ? (
                <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  {copy.recommendedOffer}
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-full border border-orange-300/40 bg-orange-500/10 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500">
                {copy.mostPopular}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {copy.pro.audience}
          </p>
          <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.03em] text-slate-950 md:text-6xl">
            {proPrice} €
          </p>
          <p className="mt-1 text-[15px] font-medium text-orange-700">
            {copy.pro.subtitle}
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-slate-600">
            {proSavingsText}
            
          </p>
          <ul className="mt-3 space-y-1.5 text-[15px] leading-7 text-slate-700">
            <li>• {copy.pro.bulletOne}</li>
            <li>• {copy.pro.bulletTwo}</li>
            <li>• {copy.pro.bulletThree}</li>
            <li>• {copy.pro.bulletFour}</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={() => void handleProCardCTA()}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={checkoutLocked}
          >
            {loadingPlan
              ? copy.checking
              : checkoutInFlight === "pro"
                ? copy.checkoutLoading
                : copy.pro.cta}
          </button>
          {proNotice ? (
            <p className="mt-2 text-[11px] text-red-600">{proNotice}</p>
          ) : null}
        </div>

        <div className={`flex h-full flex-col rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/70 to-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_rgba(15,23,42,0.15)] ${
          strategicRecommendedOfferCode === "scale"
            ? "ring-2 ring-violet-300/75"
            : ""
        }${offerRing("scale")}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            {copy.scale.name}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {copy.scale.audience}
          </p>
          <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.03em] text-slate-950 md:text-6xl">
            {scalePrice} €
          </p>
          <p className="mt-1 text-[15px] font-medium text-sky-700">
            {copy.scale.subtitle}
          </p>
          <p className="mt-2 text-[15px] font-medium leading-6 text-slate-600">
            {scaleSavingsText}
            
          </p>
          <ul className="mt-3 space-y-1.5 text-[15px] leading-7 text-slate-700">
            <li>• {copy.scale.bulletOne}</li>
            <li>• {copy.scale.bulletTwo.replace("{reduction}", String(scaleUnitCostReductionVsPro))}</li>
            <li>• {copy.scale.bulletThree}</li>
            <li>• {copy.scale.bulletFour}</li>
          </ul>
          <div className="mt-5 flex-1" />
          <button
            type="button"
            onClick={() => void handleScaleCTA()}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={checkoutLocked}
          >
            {loadingPlan
              ? copy.checking
              : checkoutInFlight === "scale"
                ? copy.checkoutLoading
                : copy.scale.cta}
          </button>
          {scaleNotice ? (
            <p className="mt-2 text-[11px] text-slate-700">{scaleNotice}</p>
          ) : null}
        </div>
      </div>

      {!loadingPlan && !isPlatformAdmin && upsellState.show ? (
        <div
          className={`rounded-2xl border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${
            upsellState.tone === "empty"
              ? "border-orange-300 bg-orange-50"
              : upsellState.tone === "critical"
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200 bg-white"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              upsellState.tone === "empty"
                ? "text-orange-800"
                : upsellState.tone === "critical"
                  ? "text-amber-800"
                  : "text-slate-800"
            }`}
          >
            {localizedUpsellMessage}
          </p>
          {upsellState.tone === "empty" ? (
            <div className="mt-3">
              {upsellState.action === "upgrade_pro" ? (
                <button
                  type="button"
                  onClick={() => void handleUpgradeToPro()}
                  disabled={checkoutLocked}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "pro"
                    ? copy.checkoutLoading
                    : localizedUpsellCtaLabel}
                </button>
              ) : upsellState.action === "upgrade_scale" ? (
                <button
                  type="button"
                  onClick={() => void handleScaleCTA()}
                  disabled={checkoutLocked}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "scale"
                    ? copy.checkoutLoading
                    : localizedUpsellCtaLabel}
                </button>
              ) : upsellState.action === "buy_top_up" ? (
                <button
                  type="button"
                  onClick={() => void handleAuditTestCheckout()}
                  disabled={checkoutLocked}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "starter" || checkoutInFlight === "audit_test"
                    ? copy.checkoutLoading
                    : localizedUpsellCtaLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            {localizedUpsellBalanceText}
          </p>
        </div>
      ) : null}

      {!loadingPlan && !isPlatformAdmin && behaviorUpsell.show ? (
        <div
          className={`rounded-2xl border px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${
            behaviorUpsell.tone === "critical"
              ? "border-violet-300 bg-violet-50"
              : "border-blue-200 bg-blue-50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              behaviorUpsell.tone === "critical" ? "text-violet-800" : "text-blue-800"
            }`}
          >
            {behaviorUpsell.message}
          </p>
          {behaviorUpsell.action ? (
            <div className="mt-3">
              {behaviorUpsell.action === "upgrade_pro" ? (
                <button
                  type="button"
                  onClick={() => void handleUpgradeToPro()}
                  disabled={checkoutLocked}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "pro"
                    ? copy.checkoutLoading
                    : behaviorUpsell.ctaLabel}
                </button>
              ) : behaviorUpsell.action === "upgrade_scale" ? (
                <button
                  type="button"
                  onClick={() => void handleScaleCTA()}
                  disabled={checkoutLocked}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "scale"
                    ? copy.checkoutLoading
                    : behaviorUpsell.ctaLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAuditTestCheckout()}
                  disabled={checkoutLocked}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutInFlight === "starter" || checkoutInFlight === "audit_test"
                    ? copy.checkoutLoading
                    : behaviorUpsell.ctaLabel}
                </button>
              )}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            {copy.behaviorUpsellFooter
              .replace("{remaining}", String(activePlanRemaining))
              .replace("{total}", String(activePlanTotal))}
            {behaviorUpsell.action === "upgrade_scale"
              ? ` ${copy.behaviorUpsellFooterScaleNote}`
              : null}
          </p>
        </div>
      ) : null}

      </>
      ) : (
        <div className="h-2" aria-hidden="true" />
      )}
    </div>
  );
}
