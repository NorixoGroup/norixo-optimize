"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/i18n/useTranslation";
import { useRouter, useSearchParams } from "next/navigation";
import { pricingPlans } from "@/lib/billing/pricingPlans";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import {
  loadGuestAuditDraft,
  persistGuestAuditDraftAfterPayment,
  saveGuestAuditDraft,
} from "@/lib/guestAuditDraft";
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
    conversionReading: "Immediate conversion reading",
    subtitle:
      "Choose the right pack for your audit volume: fewer one-off purchases, lower cost per audit and continuous usage.",
    paymentProcessing:
      "Payment is being validated… your credits will arrive in a few seconds.",
    adminUnlimited: "Platform admin — unlimited audits",
    availableCredits: "Available credits",
    averageBookings: "+20% more bookings on average",
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
      "Only 2 audits left. Plan ahead now to keep your optimization pace.",
    upsellCriticalMessage:
      "Last audit available. Move to the next offer to avoid interrupting your analyses.",
    upsellEmptyFreeMessage:
      "You have no credits left. The Pro pack (5 audits, one-time payment) lets you continue with a better cost per audit than single purchases.",
    upsellEmptyProMessage:
      "You have no credits left. The Scale pack (15 audits, one-time payment — same offer as on the card) lowers the cost per audit compared with single purchases.",
    upsellEmptyScaleMessage:
      "You have no audits left. Top up now to keep usage continuity.",
    upsellBalanceText:
      "Balance for new audits: {remaining}/{total} (remaining credits on your offer ceiling — not the number of reports already in your history). Plan ahead to avoid any audit interruption.",
    starter: {
      name: "Starter",
      audience: "Best for testing the platform",
      subtitle: "single audit",
      description:
        "Best for a one-off need, but quickly expensive if you audit regularly.",
      bulletOne: "1 audit on the listing of your choice",
      conversionReading: "Immediate conversion reading",
      bulletThree: "Priority recommendations",
      bulletTwo: "One-off purchase",
      cta: "Buy 1 audit",
    },
    pro: {
      name: "Pro",
      subtitle: "5-audit pack (one-time payment)",
      description: "One-time pack, no subscription.",
      bulletOne: "5 audits to use after purchase",
      conversionReading: "Immediate conversion reading",
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
      conversionReading: "Immediate conversion reading",
      cta: "Buy Scale pack (15 audits)",
      audience: "Designed for larger portfolios",
      savings: "One-time pack, no subscription. Around {unit} per audit, with {savings} saved vs {total} one-off purchases.",
      bulletTwo: "Optimized unit cost ({reduction}% less than Pro)",
      bulletThree: "Simplified multi-listing tracking",
      bulletFour: "Built for teams and property managers",
    },
  },
  fr: {
    checkoutLoading: "Ouverture du paiement...",
    heading: "Facturation",
    conversionReading: "Lecture conversion immédiate",
    subtitle:
      "Choisissez le pack adapté à votre volume d’audits : moins d’achats unitaires, un coût par audit réduit et une utilisation continue.",
    paymentProcessing:
      "Paiement en cours de validation… vos crédits arriveront dans quelques secondes.",
    adminUnlimited: "Administrateur de la plateforme — audits illimités",
    availableCredits: "Crédits disponibles",
    averageBookings: "+20% de réservations en moyenne",
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
    workspaceNotFound: "Workspace introuvable. Réessayez plus tard.",
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
      "Plus que 2 audits restants. Anticipez maintenant pour garder votre cadence d’optimisation.",
    upsellCriticalMessage:
      "Dernier audit disponible. Passez à l’offre supérieure pour éviter une interruption de vos analyses.",
    upsellEmptyFreeMessage:
      "Vous n’avez plus de crédits. Le pack Pro (5 audits, paiement unique) permet de continuer avec un meilleur coût par audit que l’unitaire.",
    upsellEmptyProMessage:
      "Vous n’avez plus de crédits. Le pack Scale (15 audits, paiement unique — même offre que sur la carte) réduit le coût par audit par rapport à l’unitaire.",
    upsellEmptyScaleMessage:
      "Vous n’avez plus d’audits disponibles. Rechargez pour maintenir la continuité d’usage.",
    upsellBalanceText:
      "Solde pour de nouveaux audits : {remaining}/{total} (crédits restants sur le plafond de votre offre — pas le nombre de rapports déjà dans l’historique). Anticipez pour éviter tout arrêt d’audit.",
    starter: {
      name: "Starter",
      audience: "Idéal pour tester la plateforme",
      subtitle: "audit unique",
      description:
        "Idéal pour un besoin ponctuel, mais vite coûteux si vous auditez régulièrement.",
      bulletOne: "1 audit sur l’annonce de votre choix",
      conversionReading: "Lecture conversion immédiate",
      bulletThree: "Recommandations prioritaires",
      bulletTwo: "Achat unitaire",
      cta: "Acheter 1 audit",
    },
    pro: {
      name: "Pro",
      subtitle: "Pack 5 audits (paiement unique)",
      description: "Pack ponctuel, sans abonnement.",
      bulletOne: "5 audits à utiliser après achat",
      conversionReading: "Lecture conversion immédiate",
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
      conversionReading: "Lecture conversion immédiate",
      cta: "Acheter le pack Scale (15 audits)",
      audience: "Pensé pour les portefeuilles plus larges",
      savings: "Pack ponctuel, sans abonnement. Soit ~{unit} par audit, avec {savings} € économisés vs {total} achats unitaires.",
      bulletTwo: "Coût unitaire optimisé ({reduction}% de moins qu’en Pro)",
      bulletThree: "Suivi multi-annonces simplifié",
      bulletFour: "Adapté aux équipes et conciergeries",
    },
  },
  es: {
    checkoutLoading: "Abriendo el pago...",
    heading: "Facturación",
    conversionReading: "Lectura inmediata de conversión",
    subtitle:
      "Elige el pack adecuado para tu volumen: menos compras unitarias, menor coste por auditoría y continuidad de uso.",
    paymentProcessing:
      "Pago en validación… tus créditos llegarán en unos segundos.",
    adminUnlimited: "Admin plataforma — auditorías ilimitadas",
    availableCredits: "Créditos disponibles",
    averageBookings: "+20% de reservas de media",
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
    workspaceNotFound: "Workspace no encontrado. Inténtalo más tarde.",
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
      "Solo te quedan 2 auditorías. Anticípate ahora para mantener tu ritmo de optimización.",
    upsellCriticalMessage:
      "Última auditoría disponible. Pasa a la oferta superior para evitar una interrupción de tus análisis.",
    upsellEmptyFreeMessage:
      "Ya no te quedan créditos. El pack Pro (5 auditorías, pago único) te permite continuar con un mejor coste por auditoría que la compra unitaria.",
    upsellEmptyProMessage:
      "Ya no te quedan créditos. El pack Scale (15 auditorías, pago único — la misma oferta que en la tarjeta) reduce el coste por auditoría frente a la compra unitaria.",
    upsellEmptyScaleMessage:
      "Ya no tienes auditorías disponibles. Recarga para mantener la continuidad de uso.",
    upsellBalanceText:
      "Saldo para nuevas auditorías: {remaining}/{total} (créditos restantes sobre el límite de tu oferta, no el número de informes ya presentes en tu historial). Anticípate para evitar cualquier interrupción de auditoría.",
    starter: {
      name: "Starter",
      audience: "Ideal para probar la plataforma",
      subtitle: "auditoría única",
      description:
        "Ideal para una necesidad puntual, pero se vuelve caro si auditas con frecuencia.",
      bulletOne: "1 auditoría sobre el anuncio que elijas",
      conversionReading: "Lectura inmediata de conversión",
      bulletThree: "Recomendaciones prioritarias",
      bulletTwo: "Compra unitaria",
      cta: "Comprar 1 auditoría",
    },
    pro: {
      name: "Pro",
      subtitle: "Pack de 5 auditorías (pago único)",
      description: "Pack puntual, sin suscripción.",
      bulletOne: "5 auditorías para usar después de la compra",
      conversionReading: "Lectura inmediata de conversión",
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
      conversionReading: "Lectura inmediata de conversión",
      cta: "Comprar pack Scale (15 auditorías)",
      audience: "Diseñado para portafolios más amplios",
      savings: "Pack puntual, sin suscripción. Aproximadamente {unit} por auditoría, con {savings} € ahorrados frente a {total} compras unitarias.",
      bulletTwo: "Coste unitario optimizado ({reduction}% menos que Pro)",
      bulletThree: "Seguimiento multi-anuncio simplificado",
      bulletFour: "Pensado para equipos y gestores de propiedades",
    },
  },
  de: {
    checkoutLoading: "Zahlung wird geöffnet...",
    heading: "Abrechnung",
    conversionReading: "Sofortige Conversion-Auswertung",
    subtitle:
      "Wähle das passende Paket für dein Audit-Volumen: weniger Einzelkäufe, geringere Kosten pro Audit und kontinuierliche Nutzung.",
    paymentProcessing:
      "Die Zahlung wird bestätigt… deine Credits werden in wenigen Sekunden verfügbar sein.",
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
    workspaceNotFound: "Workspace nicht gefunden. Versuche es später erneut.",
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
      "Nur noch 2 Audits verfügbar. Plane jetzt voraus, um dein Optimierungstempo beizubehalten.",
    upsellCriticalMessage:
      "Letztes Audit verfügbar. Wechsle zum nächsten Angebot, um eine Unterbrechung deiner Analysen zu vermeiden.",
    upsellEmptyFreeMessage:
      "Du hast keine Credits mehr. Das Pro-Paket (5 Audits, Einmalzahlung) ermöglicht dir, mit geringeren Kosten pro Audit als beim Einzelkauf weiterzumachen.",
    upsellEmptyProMessage:
      "Du hast keine Credits mehr. Das Scale-Paket (15 Audits, Einmalzahlung — dasselbe Angebot wie auf der Karte) senkt die Kosten pro Audit im Vergleich zum Einzelkauf.",
    upsellEmptyScaleMessage:
      "Du hast keine Audits mehr verfügbar. Lade jetzt nach, um die Nutzung ohne Unterbrechung fortzusetzen.",
    upsellBalanceText:
      "Guthaben für neue Audits: {remaining}/{total} (verbleibende Credits innerhalb deines Angebotslimits — nicht die Anzahl der Berichte, die bereits im Verlauf vorhanden sind). Plane voraus, um jede Unterbrechung von Audits zu vermeiden.",
    starter: {
      name: "Starter",
      audience: "Ideal zum Testen der Plattform",
      subtitle: "einzelnes Audit",
      description:
        "Ideal für einen einmaligen Bedarf, aber schnell teuer, wenn du regelmäßig Audits durchführst.",
      bulletOne: "1 Audit für das Inserat deiner Wahl",
      conversionReading: "Sofortige Conversion-Auswertung",
      bulletThree: "Priorisierte Empfehlungen",
      bulletTwo: "Einzelkauf",
      cta: "1 Audit kaufen",
    },
    pro: {
      name: "Pro",
      subtitle: "5-Audit-Paket (Einmalzahlung)",
      description: "Einmaliges Paket, kein Abonnement.",
      bulletOne: "5 Audits zur Nutzung nach dem Kauf",
      conversionReading: "Sofortige Conversion-Auswertung",
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
      conversionReading: "Sofortige Conversion-Auswertung",
      cta: "Scale-Paket kaufen (15 Audits)",
      audience: "Entwickelt für größere Portfolios",
      savings: "Einmaliges Paket, kein Abonnement. Etwa {unit} pro Audit, mit {savings} € Ersparnis gegenüber {total} Einzelkäufen.",
      bulletTwo: "Optimierte Stückkosten ({reduction}% weniger als Pro)",
      bulletThree: "Vereinfachtes Multi-Listing-Tracking",
      bulletFour: "Für Teams und Property Manager entwickelt",
    },
  },
  it: {
    checkoutLoading: "Apertura del pagamento...",
    heading: "Fatturazione",
    conversionReading: "Lettura immediata della conversione",
    subtitle:
      "Scegli il pacchetto adatto al tuo volume di audit: meno acquisti singoli, costo per audit ridotto e uso continuo.",
    paymentProcessing:
      "Pagamento in fase di convalida… i tuoi crediti arriveranno tra pochi secondi.",
    adminUnlimited: "Amministratore della piattaforma — audit illimitati",
    availableCredits: "Crediti disponibili",
    averageBookings: "+20% di prenotazioni in media",
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
    workspaceNotFound: "Workspace non trovato. Riprova più tardi.",
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
      "Ti restano solo 2 audit. Anticipa ora per mantenere il tuo ritmo di ottimizzazione.",
    upsellCriticalMessage:
      "Ultimo audit disponibile. Passa all’offerta superiore per evitare un’interruzione delle tue analisi.",
    upsellEmptyFreeMessage:
      "Non hai più crediti. Il pacchetto Pro (5 audit, pagamento unico) ti permette di continuare con un costo per audit migliore rispetto all’acquisto singolo.",
    upsellEmptyProMessage:
      "Non hai più crediti. Il pacchetto Scale (15 audit, pagamento unico — la stessa offerta mostrata sulla card) riduce il costo per audit rispetto all’acquisto singolo.",
    upsellEmptyScaleMessage:
      "Non hai più audit disponibili. Ricarica per mantenere la continuità d’uso.",
    upsellBalanceText:
      "Saldo per nuovi audit: {remaining}/{total} (crediti rimanenti sul tetto della tua offerta, non il numero di report già presenti nello storico). Anticipa ora per evitare qualsiasi interruzione degli audit.",
    starter: {
      name: "Starter",
      audience: "Ideale per testare la piattaforma",
      subtitle: "audit singolo",
      description:
        "Ideale per un’esigenza occasionale, ma rapidamente costoso se esegui audit regolarmente.",
      bulletOne: "1 audit sull’annuncio che preferisci",
      conversionReading: "Lettura immediata della conversione",
      bulletThree: "Raccomandazioni prioritarie",
      bulletTwo: "Acquisto singolo",
      cta: "Acquista 1 audit",
    },
    pro: {
      name: "Pro",
      subtitle: "Pacchetto da 5 audit (pagamento unico)",
      description: "Pacchetto una tantum, senza abbonamento.",
      bulletOne: "5 audit da utilizzare dopo l’acquisto",
      conversionReading: "Lettura immediata della conversione",
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
      conversionReading: "Lettura immediata della conversione",
      cta: "Acquista pacchetto Scale (15 audit)",
      audience: "Pensato per portafogli più ampi",
      savings: "Pacchetto una tantum, senza abbonamento. Circa {unit} per audit, con {savings} € risparmiati rispetto a {total} acquisti singoli.",
      bulletTwo: "Costo unitario ottimizzato ({reduction}% in meno rispetto a Pro)",
      bulletThree: "Monitoraggio multi-annuncio semplificato",
      bulletFour: "Pensato per team e gestori di proprietà",
    },
  },
  pt: {
    checkoutLoading: "A abrir o pagamento...",
    heading: "Faturação",
    conversionReading: "Leitura imediata da conversão",
    subtitle:
      "Escolha o pack certo para o seu volume de auditorias: menos compras unitárias, menor custo por auditoria e utilização contínua.",
    paymentProcessing:
      "Pagamento em validação… os seus créditos chegarão dentro de alguns segundos.",
    adminUnlimited: "Administrador da plataforma — auditorias ilimitadas",
    availableCredits: "Créditos disponíveis",
    averageBookings: "+20% de reservas em média",
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
    workspaceNotFound: "Workspace não encontrado. Tente novamente mais tarde.",
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
      "Restam apenas 2 auditorias. Antecipe-se agora para manter o seu ritmo de otimização.",
    upsellCriticalMessage:
      "Última auditoria disponível. Passe para a oferta superior para evitar uma interrupção das suas análises.",
    upsellEmptyFreeMessage:
      "Já não tem créditos. O pack Pro (5 auditorias, pagamento único) permite continuar com um custo por auditoria melhor do que a compra unitária.",
    upsellEmptyProMessage:
      "Já não tem créditos. O pack Scale (15 auditorias, pagamento único — a mesma oferta do cartão) reduz o custo por auditoria em comparação com a compra unitária.",
    upsellEmptyScaleMessage:
      "Já não tem auditorias disponíveis. Recarregue para manter a continuidade de utilização.",
    upsellBalanceText:
      "Saldo para novas auditorias: {remaining}/{total} (créditos restantes no limite da sua oferta — e não o número de relatórios já presentes no histórico). Antecipe-se para evitar qualquer interrupção das auditorias.",
    starter: {
      name: "Starter",
      audience: "Ideal para testar a plataforma",
      subtitle: "auditoria única",
      description:
        "Ideal para uma necessidade pontual, mas rapidamente caro se fizer auditorias com regularidade.",
      bulletOne: "1 auditoria no anúncio à sua escolha",
      conversionReading: "Leitura imediata da conversão",
      bulletThree: "Recomendações prioritárias",
      bulletTwo: "Compra unitária",
      cta: "Comprar 1 auditoria",
    },
    pro: {
      name: "Pro",
      subtitle: "Pack de 5 auditorias (pagamento único)",
      description: "Pack pontual, sem subscrição.",
      bulletOne: "5 auditorias para utilizar após a compra",
      conversionReading: "Leitura imediata da conversão",
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
      conversionReading: "Leitura imediata da conversão",
      cta: "Comprar pack Scale (15 auditorias)",
      audience: "Pensado para portefólios maiores",
      savings: "Pack pontual, sem subscrição. Cerca de {unit} por auditoria, com {savings} € poupados face a {total} compras unitárias.",
      bulletTwo: "Custo unitário otimizado ({reduction}% menos do que Pro)",
      bulletThree: "Acompanhamento multi-anúncio simplificado",
      bulletFour: "Criado para equipas e gestores de propriedades",
    },
  },
  nl: {
    checkoutLoading: "Betaling openen...",
    heading: "Facturatie",
    conversionReading: "Onmiddellijke conversie-inzichten",
    subtitle:
      "Kies het juiste pakket voor je auditvolume: minder losse aankopen, lagere kosten per audit en doorlopend gebruik.",
    paymentProcessing:
      "Betaling wordt gevalideerd… je credits komen binnen enkele seconden aan.",
    adminUnlimited: "Platformbeheerder — onbeperkte audits",
    availableCredits: "Beschikbare credits",
    averageBookings: "+20% meer boekingen gemiddeld",
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
    workspaceNotFound: "Workspace niet gevonden. Probeer het later opnieuw.",
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
      "Je hebt nog maar 2 audits over. Anticipeer nu om je optimalisatieritme te behouden.",
    upsellCriticalMessage:
      "Laatste audit beschikbaar. Stap over naar het hogere aanbod om een onderbreking van je analyses te vermijden.",
    upsellEmptyFreeMessage:
      "Je hebt geen credits meer. Het Pro-pakket (5 audits, eenmalige betaling) laat je doorgaan met een betere kost per audit dan losse aankopen.",
    upsellEmptyProMessage:
      "Je hebt geen credits meer. Het Scale-pakket (15 audits, eenmalige betaling — dezelfde aanbieding als op de kaart) verlaagt de kost per audit ten opzichte van losse aankopen.",
    upsellEmptyScaleMessage:
      "Je hebt geen audits meer beschikbaar. Laad bij om de continuiteit van het gebruik te behouden.",
    upsellBalanceText:
      "Saldo voor nieuwe audits: {remaining}/{total} (resterende credits binnen de limiet van je aanbod — niet het aantal rapporten dat al in je geschiedenis staat). Anticipeer om elke onderbreking van audits te vermijden.",
    starter: {
      name: "Starter",
      audience: "Ideaal om het platform te testen",
      subtitle: "enkele audit",
      description:
        "Ideaal voor een eenmalige behoefte, maar snel duur als je regelmatig audits uitvoert.",
      bulletOne: "1 audit voor de advertentie van jouw keuze",
      conversionReading: "Onmiddellijke conversie-inzichten",
      bulletThree: "Prioritaire aanbevelingen",
      bulletTwo: "Losse aankoop",
      cta: "Koop 1 audit",
    },
    pro: {
      name: "Pro",
      subtitle: "Pakket van 5 audits (eenmalige betaling)",
      description: "Eenmalig pakket, zonder abonnement.",
      bulletOne: "5 audits te gebruiken na aankoop",
      conversionReading: "Onmiddellijke conversie-inzichten",
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
      conversionReading: "Onmiddellijke conversie-inzichten",
      cta: "Koop Scale-pakket (15 audits)",
      audience: "Ontworpen voor grotere portefeuilles",
      savings: "Eenmalig pakket, zonder abonnement. Ongeveer {unit} per audit, met {savings} € besparing ten opzichte van {total} losse aankopen.",
      bulletTwo: "Geoptimaliseerde kost per audit ({reduction}% minder dan Pro)",
      bulletThree: "Vereenvoudigde multi-listing opvolging",
      bulletFour: "Gebouwd voor teams en property managers",
    },
  },
  ja: {
    checkoutLoading: "決済を開いています...",
    heading: "請求",
    conversionReading: "即時コンバージョン診断",
    subtitle:
      "監査ボリュームに合ったパックを選びましょう。単発購入を減らし、1監査あたりのコストを抑え、継続的に利用できます。",
    paymentProcessing:
      "決済を確認中です… 数秒以内にクレジットが反映されます。",
    adminUnlimited: "プラットフォーム管理者 — 無制限の監査",
    availableCredits: "利用可能なクレジット",
    averageBookings: "平均で予約数 +20%",
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
      "残り監査数はあと 2 件です。最適化のペースを保つため、今のうちに準備しましょう。",
    upsellCriticalMessage:
      "利用可能な監査はあと 1 件です。分析を止めないために上位オファーへ切り替えましょう。",
    upsellEmptyFreeMessage:
      "クレジットがありません。Pro パック（5件の監査、単発決済）なら、単発購入より良い単価で継続できます。",
    upsellEmptyProMessage:
      "クレジットがありません。Scale パック（15件の監査、単発決済 — カードと同じオファー）なら、単発購入より監査単価を下げられます。",
    upsellEmptyScaleMessage:
      "利用可能な監査がありません。継続利用を保つためにチャージしてください。",
    upsellBalanceText:
      "新しい監査向け残高: {remaining}/{total}（オファー上限内の残クレジットであり、履歴内にあるレポート数ではありません）。監査が止まらないよう事前に準備しましょう。",
    starter: {
      name: "Starter",
      audience: "プラットフォームを試すのに最適",
      subtitle: "単発監査",
      description:
        "一時的なニーズには最適ですが、頻繁に監査するとすぐに高コストになります。",
      bulletOne: "選択した掲載に対して 1 件の監査",
      conversionReading: "即時コンバージョン診断",
      bulletThree: "優先度の高い提案",
      bulletTwo: "単発購入",
      cta: "1件の監査を購入",
    },
    pro: {
      name: "Pro",
      subtitle: "5件監査パック（単発決済）",
      description: "サブスクリプションなしの単発パックです。",
      bulletOne: "購入後に利用できる 5 件の監査",
      conversionReading: "即時コンバージョン診断",
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
      conversionReading: "即時コンバージョン診断",
      cta: "Scale パックを購入（15件の監査）",
      audience: "より大きなポートフォリオ向け",
      savings:
        "サブスクリプションなしの単発パックです。1件あたり約 {unit}、単発購入 {total} 回と比べて {savings} 節約できます。",
      bulletTwo: "最適化された単価（Pro より {reduction}% 低い）",
      bulletThree: "複数掲載の追跡を簡素化",
      bulletFour: "チームや不動産管理者向けに設計",
    },
  },
  zh: {
    checkoutLoading: "正在打开支付...",
    heading: "账单",
    conversionReading: "即时转化解读",
    subtitle:
      "选择适合你审计量的套餐：减少单次购买，降低单次审计成本，并保持持续使用。",
    paymentProcessing:
      "支付正在验证中… 你的额度将在几秒钟内到账。",
    adminUnlimited: "平台管理员 — 无限审计",
    availableCredits: "可用额度",
    averageBookings: "平均预订量 +20%",
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
      "你只剩下 2 次审计。现在提前准备，保持你的优化节奏。",
    upsellCriticalMessage:
      "只剩最后一次审计。升级到更高方案，避免分析中断。",
    upsellEmptyFreeMessage:
      "你已没有额度。Pro 套餐（5 次审计，一次性支付）可让你以比单次购买更低的成本继续使用。",
    upsellEmptyProMessage:
      "你已没有额度。Scale 套餐（15 次审计，一次性支付——与卡片上的方案相同）可比单次购买进一步降低单次审计成本。",
    upsellEmptyScaleMessage:
      "你已没有可用审计。请充值以保持持续使用。",
    upsellBalanceText:
      "新审计余额：{remaining}/{total}（这是你当前方案上限内剩余的额度，并非历史中已有的报告数量）。请提前准备，避免任何审计中断。",
    starter: {
      name: "Starter",
      audience: "适合测试平台",
      subtitle: "单次审计",
      description:
        "适合一次性需求，但如果你经常审计，很快就会变贵。",
      bulletOne: "对你选择的房源进行 1 次审计",
      conversionReading: "即时转化解读",
      bulletThree: "优先建议",
      bulletTwo: "单次购买",
      cta: "购买 1 次审计",
    },
    pro: {
      name: "Pro",
      subtitle: "5 次审计套餐（一次性支付）",
      description: "一次性套餐，无订阅。",
      bulletOne: "购买后可使用 5 次审计",
      conversionReading: "即时转化解读",
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
      conversionReading: "即时转化解读",
      cta: "购买 Scale 套餐（15 次审计）",
      audience: "为更大规模的资产组合而设计",
      savings:
        "一次性套餐，无订阅。每次审计约 {unit}，相比 {total} 次单次购买可节省 {savings}。",
      bulletTwo: "优化后的单次成本（比 Pro 低 {reduction}%）",
      bulletThree: "简化多房源跟踪",
      bulletFour: "专为团队和物业管理者打造",
    },
  },
  ko: {
    checkoutLoading: "결제를 여는 중...",
    heading: "청구",
    conversionReading: "즉시 전환 진단",
    subtitle:
      "감사 볼륨에 맞는 패키지를 선택하세요. 단건 구매를 줄이고, 감사당 비용을 낮추며, 지속적으로 사용할 수 있습니다.",
    paymentProcessing:
      "결제를 확인하는 중입니다… 몇 초 안에 크레딧이 반영됩니다.",
    adminUnlimited: "플랫폼 관리자 — 무제한 감사",
    availableCredits: "사용 가능한 크레딧",
    averageBookings: "평균 예약 수 +20%",
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
      "감사가 2회만 남았습니다. 최적화 리듬을 유지하려면 지금 미리 준비하세요.",
    upsellCriticalMessage:
      "마지막 감사만 남았습니다. 분석 중단을 피하려면 상위 오퍼로 전환하세요.",
    upsellEmptyFreeMessage:
      "크레딧이 없습니다. Pro 팩(감사 5회, 일회성 결제)은 단건 구매보다 더 좋은 단가로 계속 사용할 수 있게 해줍니다.",
    upsellEmptyProMessage:
      "크레딧이 없습니다. Scale 팩(감사 15회, 일회성 결제 — 카드와 같은 오퍼)은 단건 구매 대비 감사당 비용을 더 낮춰줍니다.",
    upsellEmptyScaleMessage:
      "사용 가능한 감사가 없습니다. 사용 연속성을 유지하려면 충전하세요.",
    upsellBalanceText:
      "새 감사용 잔액: {remaining}/{total} (히스토리에 이미 있는 보고서 수가 아니라 현재 오퍼 한도 내 남은 크레딧입니다). 감사가 멈추지 않도록 미리 대비하세요.",
    starter: {
      name: "Starter",
      audience: "플랫폼을 테스트하기에 적합",
      subtitle: "단일 감사",
      description:
        "일회성 필요에는 적합하지만, 자주 감사를 하면 금방 비싸집니다.",
      bulletOne: "선택한 숙소에 대한 감사 1회",
      conversionReading: "즉시 전환 진단",
      bulletThree: "우선 권장사항",
      bulletTwo: "단건 구매",
      cta: "감사 1회 구매",
    },
    pro: {
      name: "Pro",
      subtitle: "감사 5회 팩(일회성 결제)",
      description: "구독 없는 일회성 팩입니다.",
      bulletOne: "구매 후 사용할 수 있는 감사 5회",
      conversionReading: "즉시 전환 진단",
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
      conversionReading: "즉시 전환 진단",
      cta: "Scale 팩 구매(감사 15회)",
      audience: "더 큰 포트폴리오를 위해 설계",
      savings:
        "구독 없는 일회성 팩입니다. 감사당 약 {unit}, 단건 구매 {total}회 대비 {savings} 절감됩니다.",
      bulletTwo: "최적화된 단가(Pro 대비 {reduction}% 낮음)",
      bulletThree: "멀티 숙소 추적 간소화",
      bulletFour: "팀과 자산 관리자용으로 설계",
    },
  },
  ar: {
    checkoutLoading: "جارٍ فتح الدفع...",
    heading: "الفوترة",
    conversionReading: "قراءة تحويل فورية",
    subtitle:
      "اختر الباقة المناسبة لحجم التدقيق لديك: مشتريات فردية أقل، تكلفة أقل لكل تدقيق، واستخدام مستمر.",
    paymentProcessing:
      "يتم التحقق من الدفع… ستصل أرصدتك خلال بضع ثوانٍ.",
    adminUnlimited: "مسؤول المنصة — عمليات تدقيق غير محدودة",
    availableCredits: "الأرصدة المتاحة",
    averageBookings: "+20% حجوزات أكثر في المتوسط",
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
      "لم يتبقَّ سوى عمليتي تدقيق. استبق الأمر الآن للحفاظ على وتيرة التحسين لديك.",
    upsellCriticalMessage:
      "آخر عملية تدقيق متاحة. انتقل إلى العرض الأعلى لتجنب انقطاع تحليلاتك.",
    upsellEmptyFreeMessage:
      "لم يعد لديك أي أرصدة. تتيح لك باقة Pro (5 عمليات تدقيق، دفع لمرة واحدة) المتابعة بتكلفة أفضل لكل تدقيق مقارنة بالشراء الفردي.",
    upsellEmptyProMessage:
      "لم يعد لديك أي أرصدة. تخفّض باقة Scale (15 عملية تدقيق، دفع لمرة واحدة — نفس العرض الظاهر على البطاقة) تكلفة كل تدقيق مقارنة بالشراء الفردي.",
    upsellEmptyScaleMessage:
      "لم تعد لديك عمليات تدقيق متاحة. أعد الشحن للحفاظ على استمرارية الاستخدام.",
    upsellBalanceText:
      "الرصيد المخصص لعمليات التدقيق الجديدة: {remaining}/{total} (الأرصدة المتبقية ضمن سقف عرضك، وليس عدد التقارير الموجودة بالفعل في السجل). خطط مسبقًا لتجنب أي توقف في التدقيق.",
    starter: {
      name: "Starter",
      audience: "مثالي لتجربة المنصة",
      subtitle: "تدقيق واحد",
      description:
        "مثالي لاحتياج لمرة واحدة، لكنه يصبح مكلفًا سريعًا إذا كنت تُجري عمليات تدقيق بانتظام.",
      bulletOne: "عملية تدقيق واحدة للإعلان الذي تختاره",
      conversionReading: "قراءة تحويل فورية",
      bulletThree: "التوصيات ذات الأولوية",
      bulletTwo: "شراء فردي",
      cta: "شراء عملية تدقيق واحدة",
    },
    pro: {
      name: "Pro",
      subtitle: "باقة 5 عمليات تدقيق (دفع لمرة واحدة)",
      description: "باقة لمرة واحدة، من دون اشتراك.",
      bulletOne: "5 عمليات تدقيق للاستخدام بعد الشراء",
      conversionReading: "قراءة تحويل فورية",
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
      conversionReading: "قراءة تحويل فورية",
      cta: "شراء باقة Scale (15 عملية تدقيق)",
      audience: "مصممة للمحافظ الأكبر",
      savings:
        "باقة لمرة واحدة، من دون اشتراك. حوالي {unit} لكل تدقيق، مع توفير {savings} مقارنة بـ {total} عمليات شراء فردية.",
      bulletTwo: "تكلفة وحدة محسّنة (أقل من Pro بنسبة {reduction}%)",
      bulletThree: "متابعة متعددة الإعلانات بشكل مبسّط",
      bulletFour: "مصممة للفرق ومديري العقارات",
    },
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
    return "Votre session a expiré. Reconnectez-vous puis réessayez.";
  }

  if (
    lower === "workspace not found" ||
    lower === "forbidden workspace" ||
    lower.includes("unable to verify workspace") ||
    lower.includes("unable to load workspace") ||
    lower.includes("unable to load billing profile")
  ) {
    return "Espace de travail ou facturation introuvable. Rechargez la page ou reconnectez-vous.";
  }

  if (lower.includes("workspaceid requis") || lower.includes("workspace_id requis")) {
    return "Le workspace de facturation n’a pas été transmis. Rechargez la page Facturation et réessayez.";
  }

  if (
    trimmed.toLowerCase().includes("stripe") &&
    (trimmed.toLowerCase().includes("price") ||
      trimmed.toLowerCase().includes("price id") ||
      trimmed.toLowerCase().includes("configuré"))
  ) {
    return plan === "scale"
      ? "Le pack Scale n’est pas disponible pour le moment. Réessayez plus tard ou contactez le support."
      : plan === "pro"
        ? "Le pack Pro n’est pas disponible pour le moment. Réessayez plus tard ou contactez le support."
        : plan === "starter"
          ? "Le pack Starter n’est pas disponible pour le moment. Réessayez plus tard ou contactez le support."
          : "Le paiement n’est pas disponible pour le moment. Réessayez plus tard.";
  }

  if (
    trimmed.toLowerCase().includes("application url") ||
    trimmed.toLowerCase().includes("next_public_app_url")
  ) {
    return "Le service de paiement est momentanément indisponible. Réessayez plus tard.";
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

const CHECKOUT_LOADING_LABEL = billingCopy.fr.checkoutLoading;

const PACK_CHECKOUT_PLANS = new Set(["starter", "pro", "scale"]);
const PENDING_INTENT_MAX_AGE_MS = 120_000;
const POST_SUCCESS_VALIDATION_MS = 8_000;

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
      ? "Audit test achete et visible dans vos audits"
      : "Audit test achete"
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
        message:
          "Vous rachetez souvent des audits unitaires. Le pack Pro (5 audits, paiement unique) réduit le coût par audit et sécurise votre rythme.",
        action: "upgrade_pro",
        ctaLabel: "Acheter le pack Pro (5 audits)",
      }
    : hasFrequentProConsumption && activePlanRemaining <= 2
      ? {
          show: true,
          tone: "critical",
          message:
            "Votre cadence est élevée : le pack Scale (15 audits, paiement unique — même offre que la carte) sécurise le volume avec un meilleur coût par audit.",
          action: "upgrade_scale",
          ctaLabel: "Acheter le pack Scale (15 audits)",
        }
      : activePlanCode === "scale" && activePlanRemaining === 0
        ? {
            show: true,
            tone: "critical",
            message:
              "Vos crédits Scale sont épuisés. Rechargez maintenant pour éviter d’interrompre vos optimisations en cours.",
            action: "buy_top_up",
            ctaLabel: "Acheter 1 audit",
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
  const starterBadgeText =
    activePlanCode === "free"
      ? loadingPlan
        ? "Nouveaux audits —/1"
        : isPlatformAdmin
          ? `Infos crédits : ${starterRemainingAudits}/${starterTotalAudits}`
          : `Nouveaux audits : ${starterRemainingAudits}/${starterTotalAudits}`
      : isPlatformAdmin
        ? null
        : "1 audit";
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

  useEffect(() => {
    let mounted = true;

    async function handleCheckoutState() {
      const status = searchParams.get("checkout");
      const success = searchParams.get("success");
      const canceled = searchParams.get("canceled");
      const plan = searchParams.get("plan");

      if (plan === "audit_test" || plan === "pro" || plan === "scale" || plan === "starter") {
        setCheckoutPlan(plan);
      }

      if (status === "success" || success === "true") {
        setCheckoutStatus("success");
        setPaymentValidationHold(true);
        if (paymentValidationHoldTimeoutRef.current) {
          window.clearTimeout(paymentValidationHoldTimeoutRef.current);
        }
        paymentValidationHoldTimeoutRef.current = window.setTimeout(() => {
          setPaymentValidationHold(false);
          paymentValidationHoldTimeoutRef.current = null;
        }, POST_SUCCESS_VALIDATION_MS);

        if (plan === "audit_test") {
          const persistence = await persistGuestAuditDraftAfterPayment();

          if (!mounted) return;

          if (!persistence.persisted) {
            console.warn("Failed to persist paid guest audit after checkout", {
              error: persistence.error ?? null,
            });
          }
        }

        router.replace("/dashboard/billing");
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
  }, [router, searchParams]);

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
        message: "Chargement du plan en cours. Réessayez dans un instant.",
      };
    }

    if (isPaymentProcessing) {
      releaseCheckoutLock();
      return {
        ok: false,
        message:
          "Paiement en cours de validation. Vos crédits arrivent dans quelques secondes — patientez avant un nouvel achat.",
      };
    }

    const active = checkoutActivePlanRef.current;
    if (active !== null && active !== plan) {
      return {
        ok: false,
        message: "Un paiement est déjà en cours. Patientez quelques secondes.",
      };
    }
    if (
      active !== null &&
      active === plan &&
      !(meta?.continuationAfterAuditPreflight && plan === "audit_test")
    ) {
      return {
        ok: false,
        message: "Un paiement est déjà en cours. Patientez quelques secondes.",
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
        message: "Réponse de paiement incomplète (URL de redirection manquante).",
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
        result.message || "Impossible d’ouvrir le paiement du pack Pro pour le moment."
      );
    }
  }

  async function handleProCardCTA() {
    setProNotice(null);
    if (loadingPlan) {
      setProNotice("Chargement du plan en cours. Patientez un instant.");
      return;
    }
    const result = await handleCheckout("pro");
    if (!result.ok) {
      setProNotice(
        result.message || "Impossible d’ouvrir le paiement du pack Pro pour le moment."
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
        result.message || "Impossible d’ouvrir le paiement du pack Starter pour le moment."
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
      setFreeNotice("Cet audit test est deja debloque pour cette annonce.");
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
          setFreeNotice("Cet audit test a deja ete achete pour cette annonce.");
          return;
        }
      }
    }

    const result = await handleCheckout("audit_test", undefined, {
      continuationAfterAuditPreflight: true,
    });

    if (!result.ok) {
      setFreeNotice(
        result.message || "Impossible d'ouvrir le paiement de l'audit test pour le moment."
      );
    }
  }

  async function handleScaleCTA() {
    setScaleNotice(null);
    const result = await handleCheckout("scale");

    if (!result.ok) {
      setScaleNotice(
        result.message ||
          "Impossible d’ouvrir le paiement du pack Scale pour le moment."
      );
    }
  }

  return (
    <div className="space-y-7 text-sm md:space-y-8">
      {checkoutStatus === "success" && (
        <div className="nk-card-accent nk-card-accent-emerald nk-card-hover flex flex-col items-start justify-between gap-2 rounded-2xl border border-emerald-200/85 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-[0_10px_24px_rgba(5,150,105,0.12),0_1px_0_rgba(255,255,255,0.62)_inset] sm:flex-row sm:items-center">
          <span>
            {checkoutPlan === "audit_test"
              ? "Paiement reussi. Votre audit test est maintenant debloque."
              : checkoutPlan === "starter"
                ? copy.paymentSuccessStarter
              : checkoutPlan === "scale"
              ? copy.paymentSuccessScale
              : checkoutPlan === "pro"
              ? copy.paymentSuccessPro
              : copy.paymentSuccessGeneric}
          </span>
          {(checkoutPlan === "pro" || checkoutPlan === "scale" || checkoutPlan === "starter") && (
            <Link
              href="/dashboard/listings"
              className="nk-ghost-btn text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              Voir les annonces
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
            {copy.subtitle.split(":")[0]}
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
        <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_rgba(15,23,42,0.15)]">
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
                ? CHECKOUT_LOADING_LABEL
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
        }`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
              Pro
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
                ? CHECKOUT_LOADING_LABEL
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
        }`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Scale
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
                ? CHECKOUT_LOADING_LABEL
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
                    ? CHECKOUT_LOADING_LABEL
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
                    ? CHECKOUT_LOADING_LABEL
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
                    ? CHECKOUT_LOADING_LABEL
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
                    ? CHECKOUT_LOADING_LABEL
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
                    ? CHECKOUT_LOADING_LABEL
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
                    ? CHECKOUT_LOADING_LABEL
                    : behaviorUpsell.ctaLabel}
                </button>
              )}
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-slate-500">
            Basé sur votre consommation récente (solde pour nouveaux audits : {activePlanRemaining}/
            {activePlanTotal}) pour préserver la continuité d’usage.
            {behaviorUpsell.action === "upgrade_scale"
              ? " Le bouton ci-dessus déclenche le même achat que sur la carte Scale (pack, paiement unique)."
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
