"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuditLaunchOverlay } from "@/components/AuditLaunchOverlay";
import { supabase } from "@/lib/supabase";
import { applyStayDatesToListingUrl } from "@/lib/listings/applyStayDatesToListingUrl";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";
import { getWorkspacePlan } from "@/lib/billing/getWorkspacePlan";
import { runAuditForListing } from "@/components/RunAuditForListingButton";
import { useTranslation } from "@/components/i18n/useTranslation";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/listings/propertyTypeOverrideOptions";

const AUDIT_POLL_MS = 2500;
const AUDIT_STALE_MS = 45 * 60 * 1000;
const AUDIT_REDIRECT_MAX_AGE_MS = 10 * 60 * 1000;


const listingNewCopy = {
  en: {
    newAudit: "New audit",
    addListing: "Add a listing to track",
    useAvailableDates: "Use dates that are actually available.",
    advancedSettingsOptional: "Advanced settings are optional.",
    addListingSubtitle:
      "Paste the public URL of your listing. We will create a listing in your workspace and launch the audit.",
    listingSettings: "Listing settings",
    listingUrl: "Listing URL",
    continueBackground: "You can leave this page, the analysis continues in the background.",
    keepScreenActive: "⚡ Your screen will stay active during the analysis",
    auditStillRunning: "Audit still running",
    auditStillRunningText:
      "An audit is already being processed. We are keeping the screen synchronized.",
    launchAudit: "Launch audit",
    analysisRunning: "Analysis in progress...",
    automaticAudit: "Automatic audit + nearby comparables",
    listingUrlMissing: "listing URL",
    updateListingUrlError: "Unable to update the listing URL",
    checkinDateMissing: "check-in date",
    checkoutDateMissing: "check-out date",
    completeRequiredFields: "Complete the required fields before launching the audit",
    checkoutAfterCheckin: "The check-out date must be after the check-in date.",
    requiredFieldsFallback: "Complete the required fields before launching the audit: URL, dates and property type.",
    unauthenticatedUser: "Unauthenticated user",
    listingCreationFailed: "Listing creation failed",
    auditAlreadyRunningOtherListing: "An audit is already running for another listing. Wait until it finishes or come back to this page.",
    important: "Important:",
    respectMinimumNights: "respect the minimum number of nights",
    minimumStayNights: "Min. stay (nights)",
    auditConsiders: "What the audit takes into account",
    workspaceInitError: "Unable to initialize the workspace for this user",
    existingListingsCheckError: "Unable to check existing listings",
    locationDetectedFromListing: "The property location is automatically detected from the listing.",
    auditConsidersLocation: "Location and platform are automatically detected from the listing.",
    auditConsidersComparables: "Comparables are filtered by property type and local consistency.",
    auditConsidersPrice: "Price is recalculated per night to avoid false market gaps.",
    auditConsidersAnalysis: "The analysis evaluates photos, description, SEO and conversion potential.",
    auditConsidersRecommendations: "Recommendations are prioritized by estimated business impact.",
    propertyType: "Property type",
    propertyTypePlaceholder: "Choose the property type",
    platform: "Platform",
    checkinDate: "Check-in date",
    checkoutDate: "Check-out date",
    headerSubtitleSuffix: "so you can audit it and track its future optimizations.",
    resumeAuditLeadSubtitle: "The analysis is continuing — you can navigate through the dashboard.",
    formIntro: "This information is used to create the base listing before launching a detailed audit.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(required)",
    propertyTypeHelp: "Choose the real property type to get reliable comparables.",
    availableDatesHelp: "Choose available dates to retrieve a reliable price.",
    minimumNightsPriceHint:
      "of the listing. If the selected stay is too short, Airbnb or Booking may not display a price.",
    missingPlatformLabel: "platform",
    missingPropertyTypeLabel: "property type",
    choosePropertyTypeError: "Please choose the property type.",
    missingFieldsLabel: "Missing fields:",
    auditStaleError: "The analysis took too long or failed. You can launch a new audit.",
    previousAuditTimeoutError: "Time limit exceeded: the previous audit could not be confirmed.",
    untitledListing: "Untitled listing",
    unknownError: "An unknown error occurred",
    bookingUnavailableTitle: "Booking analysis temporarily unavailable",
    bookingUnavailableText:
      "Booking is temporarily blocking access to this listing. The audit was not executed and no credit was charged. Try again in a few minutes or choose different dates.",
    bookingUnavailableBalance: "Your balance remains unchanged.",
    retry: "Try again",
    quotaUpsellTitle: "Unlock your full audit in 30 seconds",
    quotaUpsellText:
      "You have no credits left to launch a new audit. Choose an offer to continue and immediately unlock your next analyses.",
    starterPackTitle: "Starter — €9",
    starterPackSubtitle: "1 one-off audit",
    proPackTitle: "5-audit pack — €39",
    proPackSubtitle: "5 audits",
    scalePackTitle: "15-audit pack — €99",
    scalePackSubtitle: "15 audits",
    viewOffersCta: "See offers and unlock my audits",
    quickTipsTitle: "Quick tips",
    quickTipsPasteUrl: "Simply paste the public listing URL.",
    automaticAnalysisBadge: "Automatic analysis",
    rightColumnDescription:
      "The audit combines the public signals of the listing with your market context to better target comparables from the start.",
    loadingStepsDefault: [
      "Extracting the listing (text, photos, structure)...",
      "Searching for nearby comparable competitors...",
      "AI analysis and market reading...",
      "Building the report and priorities...",
    ],
    loadingStepsBooking: [
      "Extracting Booking.com data (public page, calendar, amenities)...",
      "Discovering comparables — this step is often longer on Booking...",
      "AI analysis with real competitive context...",
      "Finalizing the report (scores, improvement areas)...",
    ],
    overlayHintsDefault: [
      "Secure connection to the public listing page...",
      "Normalizing data for a fair comparison...",
      "Steps advance depending on platform responses (no fixed percentage).",
    ],
    overlayHintsBooking: [
      "Fetching through a secure gateway — please keep this tab open.",
      "Booking may impose checks: the server retries with adapted strategies.",
      "The “comparables” phase chains several extractions; it is often the longest.",
    ],
  },
  fr: {
    newAudit: "Nouvel audit",
    addListing: "Ajouter une annonce à suivre",
    useAvailableDates: "Utilisez des dates réellement disponibles.",
    advancedSettingsOptional: "Les paramètres avancés sont facultatifs.",
    addListingSubtitle:
      "Collez l’URL publique de votre annonce. Nous créerons une fiche dans votre workspace et lancerons l’audit.",
    listingSettings: "Paramètres de l’annonce",
    listingUrl: "URL de l’annonce",
    continueBackground: "Vous pouvez changer de page, l’analyse continue en arrière-plan.",
    keepScreenActive: "⚡ Votre écran restera actif pendant l’analyse",
    auditStillRunning: "Audit toujours en cours",
    auditStillRunningText:
      "Un audit est déjà en cours de traitement. Nous gardons l’écran synchronisé.",
    launchAudit: "Lancer l’audit",
    analysisRunning: "Analyse en cours...",
    automaticAudit: "Audit automatique + comparables proches",
    listingUrlMissing: "URL de l’annonce",
    updateListingUrlError: "Impossible de mettre à jour l’URL de l’annonce",
    checkinDateMissing: "date d’arrivée",
    checkoutDateMissing: "date de départ",
    completeRequiredFields: "Complétez les champs obligatoires avant de lancer l’audit",
    checkoutAfterCheckin: "La date de départ doit être après la date d’arrivée.",
    requiredFieldsFallback:
      "Complétez les champs obligatoires avant de lancer l’audit : URL, dates et type de logement.",
    unauthenticatedUser: "Utilisateur non authentifié",
    listingCreationFailed: "Échec de création de l’annonce",
    auditAlreadyRunningOtherListing:
      "Un audit est déjà en cours pour une autre annonce. Patientez la fin du traitement ou revenez sur cette page.",
    important: "Important :",
    respectMinimumNights: "respectez le minimum de nuits",
    minimumStayNights: "Durée min. (nuits)",
    auditConsiders: "Ce que l’audit prend en compte",
    workspaceInitError: "Impossible d'initialiser le workspace pour cet utilisateur",
    existingListingsCheckError: "Impossible de vérifier les annonces existantes",
    locationDetectedFromListing: "La localisation du logement est détectée automatiquement depuis l’annonce.",
    auditConsidersLocation: "La localisation et la plateforme sont détectées automatiquement depuis l’annonce.",
    auditConsidersComparables: "Les comparables sont filtrés par type de logement et cohérence locale.",
    auditConsidersPrice: "Le prix est recalculé à la nuit pour éviter les faux écarts marché.",
    auditConsidersAnalysis: "L’analyse évalue photos, description, SEO et potentiel de conversion.",
    auditConsidersRecommendations: "Les recommandations sont priorisées selon leur impact business estimé.",
    propertyType: "Type de logement",
    propertyTypePlaceholder: "Choisissez le type de logement",
    platform: "Plateforme",
    checkinDate: "Date d’arrivée",
    checkoutDate: "Date de départ",
    headerSubtitleSuffix: "pour pouvoir l’auditer et suivre ses futures optimisations.",
    resumeAuditLeadSubtitle: "L’analyse continue — vous pouvez naviguer dans le dashboard.",
    formIntro: "Ces informations servent à créer la fiche de base avant de lancer un audit détaillé.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(obligatoire)",
    propertyTypeHelp: "Choisissez le type réel du logement pour obtenir des comparables fiables.",
    availableDatesHelp: "Choisissez des dates disponibles pour récupérer un prix fiable.",
    minimumNightsPriceHint:
      "de l’annonce. Si la durée choisie est trop courte, Airbnb ou Booking peut ne pas afficher de prix.",
    missingPlatformLabel: "plateforme",
    missingPropertyTypeLabel: "type de logement",
    choosePropertyTypeError: "Veuillez choisir le type de logement.",
    missingFieldsLabel: "Champs manquants :",
    auditStaleError: "L’analyse a pris trop de temps ou a échoué. Vous pouvez relancer un audit.",
    previousAuditTimeoutError: "Délai dépassé : l’audit précédent n’a pas pu être confirmé.",
    untitledListing: "Annonce sans titre",
    unknownError: "Une erreur inconnue est survenue",
    bookingUnavailableTitle: "Analyse Booking temporairement indisponible",
    bookingUnavailableText:
      "Booking bloque temporairement l’accès à cette annonce. L’audit n’a pas été exécuté et aucun crédit n’a été débité. Réessayez dans quelques minutes ou sélectionnez d’autres dates.",
    bookingUnavailableBalance: "Votre solde reste inchangé.",
    retry: "Réessayer",
    quotaUpsellTitle: "Débloquez votre audit complet en 30 secondes",
    quotaUpsellText:
      "Vous n’avez plus de crédits disponibles pour lancer un nouvel audit. Choisissez une offre pour continuer et débloquer immédiatement vos prochaines analyses.",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "1 audit ponctuel",
    proPackTitle: "Pack 5 audits — 39 €",
    proPackSubtitle: "5 audits",
    scalePackTitle: "Pack 15 audits — 99 €",
    scalePackSubtitle: "15 audits",
    viewOffersCta: "Voir les offres et débloquer mes audits",
    quickTipsTitle: "Conseils rapides",
    quickTipsPasteUrl: "Collez simplement l’URL publique de l’annonce.",
    automaticAnalysisBadge: "Analyse automatique",
    rightColumnDescription:
      "L’audit combine les signaux publics de l’annonce avec votre contexte marché pour mieux cibler les comparables dès le départ.",
    loadingStepsDefault: [
      "Extraction de l’annonce (texte, photos, structure)…",
      "Recherche de concurrents comparables à proximité…",
      "Analyse IA et lecture marché…",
      "Construction du rapport et des priorités…",
    ],
    loadingStepsBooking: [
      "Extraction Booking.com (page publique, calendrier, équipements)…",
      "Découverte des comparables — étape souvent longue sur Booking…",
      "Analyse IA avec le contexte concurrentiel réel…",
      "Finalisation du rapport (scores, axes d’amélioration)…",
    ],
    overlayHintsDefault: [
      "Connexion sécurisée à la page publique de l’annonce…",
      "Normalisation des données pour une comparaison équitable…",
      "Les étapes avancent selon la réponse des plateformes (pas de pourcentage fixe).",
    ],
    overlayHintsBooking: [
      "Récupération via passerelle sécurisée — merci de laisser cet onglet ouvert.",
      "Booking peut imposer des vérifications : le serveur réessaie avec des stratégies adaptées.",
      "La phase « comparables » enchaîne plusieurs extractions ; c’est souvent la plus longue.",
    ],
  },
  es: {
    newAudit: "Nueva auditoría",
    addListing: "Añadir un anuncio para seguir",
    useAvailableDates: "Utiliza fechas realmente disponibles.",
    advancedSettingsOptional: "Los parámetros avanzados son opcionales.",
    addListingSubtitle:
      "Pega la URL pública de tu anuncio. Crearemos una ficha en tu workspace y lanzaremos la auditoría.",
    listingSettings: "Ajustes del anuncio",
    listingUrl: "URL del anuncio",
    continueBackground: "Puedes salir de esta página, el análisis continuará en segundo plano.",
    keepScreenActive: "⚡ Tu pantalla permanecerá activa durante el análisis",
    auditStillRunning: "Auditoría todavía en curso",
    auditStillRunningText:
      "Ya hay una auditoría en proceso. Mantendremos la pantalla sincronizada.",
    launchAudit: "Lanzar auditoría",
    analysisRunning: "Análisis en curso...",
    automaticAudit: "Auditoría automática + comparables cercanos",
    listingUrlMissing: "URL del anuncio",
    updateListingUrlError: "No se pudo actualizar la URL del anuncio",
    checkinDateMissing: "fecha de llegada",
    checkoutDateMissing: "fecha de salida",
    completeRequiredFields: "Completa los campos obligatorios antes de lanzar la auditoría",
    checkoutAfterCheckin: "La fecha de salida debe ser posterior a la fecha de llegada.",
    requiredFieldsFallback: "Completa los campos obligatorios antes de lanzar la auditoría: URL, fechas y tipo de alojamiento.",
    unauthenticatedUser: "Usuario no autenticado",
    listingCreationFailed: "Error al crear el anuncio",
    auditAlreadyRunningOtherListing: "Ya hay una auditoría en curso para otro anuncio. Espera a que termine o vuelve a esta página.",
    important: "Importante:",
    respectMinimumNights: "respeta el mínimo de noches",
    minimumStayNights: "Estancia mín. (noches)",
    auditConsiders: "Qué tiene en cuenta la auditoría",
    workspaceInitError: "No se pudo inicializar el workspace para este usuario",
    existingListingsCheckError: "No se pudieron verificar los anuncios existentes",
    locationDetectedFromListing: "La ubicación del alojamiento se detecta automáticamente desde el anuncio.",
    auditConsidersLocation: "La ubicación y la plataforma se detectan automáticamente desde el anuncio.",
    auditConsidersComparables: "Los comparables se filtran por tipo de alojamiento y coherencia local.",
    auditConsidersPrice: "El precio se recalcula por noche para evitar diferencias de mercado falsas.",
    auditConsidersAnalysis: "El análisis evalúa fotos, descripción, SEO y potencial de conversión.",
    auditConsidersRecommendations: "Las recomendaciones se priorizan según su impacto business estimado.",
    propertyType: "Tipo de alojamiento",
    propertyTypePlaceholder: "Elige el tipo de alojamiento",
    platform: "Plataforma",
    checkinDate: "Fecha de llegada",
    checkoutDate: "Fecha de salida",
    headerSubtitleSuffix: "para poder auditarlo y seguir sus futuras optimizaciones.",
    resumeAuditLeadSubtitle: "El análisis continúa; puedes navegar por el dashboard.",
    formIntro: "Esta información se utiliza para crear la ficha base antes de lanzar una auditoría detallada.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(obligatorio)",
    propertyTypeHelp: "Elige el tipo real de alojamiento para obtener comparables fiables.",
    availableDatesHelp: "Elige fechas disponibles para obtener un precio fiable.",
    minimumNightsPriceHint:
      "del anuncio. Si la estancia elegida es demasiado corta, Airbnb o Booking puede no mostrar precio.",
    missingPlatformLabel: "plataforma",
    missingPropertyTypeLabel: "tipo de alojamiento",
    choosePropertyTypeError: "Por favor, elige el tipo de alojamiento.",
    missingFieldsLabel: "Campos faltantes:",
    auditStaleError: "El análisis tardó demasiado o falló. Puedes relanzar una auditoría.",
    previousAuditTimeoutError: "Tiempo excedido: no se pudo confirmar la auditoría anterior.",
    untitledListing: "Anuncio sin título",
    unknownError: "Se produjo un error desconocido",
    bookingUnavailableTitle: "Análisis de Booking temporalmente no disponible",
    bookingUnavailableText:
      "Booking bloquea temporalmente el acceso a este anuncio. La auditoría no se ejecutó y no se descontó ningún crédito. Inténtalo de nuevo en unos minutos o elige otras fechas.",
    bookingUnavailableBalance: "Tu saldo permanece sin cambios.",
    retry: "Reintentar",
    quotaUpsellTitle: "Desbloquea tu auditoría completa en 30 segundos",
    quotaUpsellText:
      "Ya no tienes créditos disponibles para lanzar una nueva auditoría. Elige una oferta para continuar y desbloquear de inmediato tus próximos análisis.",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "1 auditoría puntual",
    proPackTitle: "Pack 5 auditorías — 39 €",
    proPackSubtitle: "5 auditorías",
    scalePackTitle: "Pack 15 auditorías — 99 €",
    scalePackSubtitle: "15 auditorías",
    viewOffersCta: "Ver ofertas y desbloquear mis auditorías",
    quickTipsTitle: "Consejos rápidos",
    quickTipsPasteUrl: "Pega simplemente la URL pública del anuncio.",
    automaticAnalysisBadge: "Análisis automático",
    rightColumnDescription:
      "La auditoría combina las señales públicas del anuncio con tu contexto de mercado para orientar mejor los comparables desde el inicio.",
    loadingStepsDefault: [
      "Extracción del anuncio (texto, fotos, estructura)...",
      "Búsqueda de competidores comparables cercanos...",
      "Análisis de IA y lectura de mercado...",
      "Construcción del informe y las prioridades...",
    ],
    loadingStepsBooking: [
      "Extracción de Booking.com (página pública, calendario, servicios)...",
      "Descubrimiento de comparables: esta etapa suele ser más larga en Booking...",
      "Análisis de IA con contexto competitivo real...",
      "Finalización del informe (puntuaciones, áreas de mejora)...",
    ],
    overlayHintsDefault: [
      "Conexión segura a la página pública del anuncio...",
      "Normalización de los datos para una comparación justa...",
      "Las etapas avanzan según la respuesta de las plataformas (sin porcentaje fijo).",
    ],
    overlayHintsBooking: [
      "Recuperación a través de una pasarela segura: deja esta pestaña abierta.",
      "Booking puede imponer verificaciones: el servidor vuelve a intentarlo con estrategias adaptadas.",
      "La fase de «comparables» encadena varias extracciones; suele ser la más larga.",
    ],
  },
  de: {
    newAudit: "Neues Audit",
    addListing: "Inserat zur Beobachtung hinzufügen",
    useAvailableDates: "Verwenden Sie tatsächlich verfügbare Daten.",
    advancedSettingsOptional: "Erweiterte Einstellungen sind optional.",
    addListingSubtitle:
      "Fügen Sie die öffentliche URL Ihres Inserats ein. Wir erstellen ein Inserat in Ihrem Workspace und starten das Audit.",
    listingSettings: "Inseratseinstellungen",
    listingUrl: "Inserat-URL",
    continueBackground: "Sie können diese Seite verlassen, die Analyse läuft im Hintergrund weiter.",
    keepScreenActive: "⚡ Ihr Bildschirm bleibt während der Analyse aktiv",
    auditStillRunning: "Audit läuft noch",
    auditStillRunningText:
      "Ein Audit wird bereits verarbeitet. Wir halten den Bildschirm synchronisiert.",
    launchAudit: "Audit starten",
    analysisRunning: "Analyse läuft...",
    automaticAudit: "Automatisches Audit + nahe Vergleichsobjekte",
    listingUrlMissing: "Inserat-URL",
    updateListingUrlError: "Die Inserat-URL konnte nicht aktualisiert werden",
    checkinDateMissing: "Anreisedatum",
    checkoutDateMissing: "Abreisedatum",
    completeRequiredFields: "Füllen Sie die Pflichtfelder aus, bevor Sie das Audit starten",
    checkoutAfterCheckin: "Das Abreisedatum muss nach dem Anreisedatum liegen.",
    requiredFieldsFallback:
      "Füllen Sie die Pflichtfelder aus, bevor Sie das Audit starten: URL, Daten und Unterkunftstyp.",
    unauthenticatedUser: "Nicht authentifizierter Benutzer",
    listingCreationFailed: "Erstellung des Inserats fehlgeschlagen",
    auditAlreadyRunningOtherListing:
      "Für ein anderes Inserat läuft bereits ein Audit. Warten Sie, bis es abgeschlossen ist, oder kehren Sie zu dieser Seite zurück.",
    important: "Wichtig:",
    respectMinimumNights: "beachten Sie die Mindestanzahl an Nächten",
    minimumStayNights: "Mindestaufenthalt (Nächte)",
    auditConsiders: "Was das Audit berücksichtigt",
    workspaceInitError: "Der Workspace für diesen Benutzer konnte nicht initialisiert werden",
    existingListingsCheckError: "Vorhandene Inserate konnten nicht geprüft werden",
    locationDetectedFromListing: "Der Standort der Unterkunft wird automatisch aus dem Inserat erkannt.",
    auditConsidersLocation: "Standort und Plattform werden automatisch aus dem Inserat erkannt.",
    auditConsidersComparables: "Vergleichsobjekte werden nach Unterkunftstyp und lokaler Konsistenz gefiltert.",
    auditConsidersPrice: "Der Preis wird pro Nacht neu berechnet, um falsche Marktabweichungen zu vermeiden.",
    auditConsidersAnalysis: "Die Analyse bewertet Fotos, Beschreibung, SEO und Conversion-Potenzial.",
    auditConsidersRecommendations: "Empfehlungen werden nach geschätzter geschäftlicher Wirkung priorisiert.",
    propertyType: "Unterkunftstyp",
    propertyTypePlaceholder: "Wählen Sie den Unterkunftstyp",
    platform: "Plattform",
    checkinDate: "Anreisedatum",
    checkoutDate: "Abreisedatum",
    headerSubtitleSuffix: "damit Sie es auditieren und seine künftigen Optimierungen verfolgen können.",
    resumeAuditLeadSubtitle: "Die Analyse läuft weiter — Sie können im Dashboard navigieren.",
    formIntro: "Diese Informationen dienen dazu, das Basis-Inserat zu erstellen, bevor ein detailliertes Audit gestartet wird.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(erforderlich)",
    propertyTypeHelp: "Wählen Sie den tatsächlichen Unterkunftstyp, um verlässliche Vergleichsobjekte zu erhalten.",
    availableDatesHelp: "Wählen Sie verfügbare Daten, um einen verlässlichen Preis zu erhalten.",
    minimumNightsPriceHint:
      "des Inserats. Wenn der gewählte Aufenthalt zu kurz ist, zeigen Airbnb oder Booking möglicherweise keinen Preis an.",
    missingPlatformLabel: "Plattform",
    missingPropertyTypeLabel: "Unterkunftstyp",
    choosePropertyTypeError: "Bitte wählen Sie den Unterkunftstyp aus.",
    missingFieldsLabel: "Fehlende Felder:",
    auditStaleError: "Die Analyse hat zu lange gedauert oder ist fehlgeschlagen. Sie können ein neues Audit starten.",
    previousAuditTimeoutError: "Zeitüberschreitung: Das vorherige Audit konnte nicht bestätigt werden.",
    untitledListing: "Inserat ohne Titel",
    unknownError: "Ein unbekannter Fehler ist aufgetreten",
    bookingUnavailableTitle: "Booking-Analyse vorübergehend nicht verfügbar",
    bookingUnavailableText:
      "Booking blockiert vorübergehend den Zugriff auf dieses Inserat. Das Audit wurde nicht ausgeführt und es wurde kein Guthaben abgebucht. Versuchen Sie es in ein paar Minuten erneut oder wählen Sie andere Daten.",
    bookingUnavailableBalance: "Ihr Guthaben bleibt unverändert.",
    retry: "Erneut versuchen",
    quotaUpsellTitle: "Schalten Sie Ihr vollständiges Audit in 30 Sekunden frei",
    quotaUpsellText:
      "Sie haben keine Credits mehr, um ein neues Audit zu starten. Wählen Sie ein Angebot, um fortzufahren und Ihre nächsten Analysen sofort freizuschalten.",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "1 einmaliges Audit",
    proPackTitle: "5-Audits-Paket — 39 €",
    proPackSubtitle: "5 Audits",
    scalePackTitle: "15-Audits-Paket — 99 €",
    scalePackSubtitle: "15 Audits",
    viewOffersCta: "Angebote ansehen und meine Audits freischalten",
    quickTipsTitle: "Schnelle Tipps",
    quickTipsPasteUrl: "Fügen Sie einfach die öffentliche URL des Inserats ein.",
    automaticAnalysisBadge: "Automatische Analyse",
    rightColumnDescription:
      "Das Audit kombiniert die öffentlichen Signale des Inserats mit Ihrem Marktkontext, um Vergleichsobjekte von Anfang an besser zu zielen.",
    loadingStepsDefault: [
      "Extrahieren des Inserats (Text, Fotos, Struktur)...",
      "Suche nach vergleichbaren Wettbewerbern in der Nähe...",
      "KI-Analyse und Marktlesung...",
      "Erstellung des Berichts und der Prioritäten...",
    ],
    loadingStepsBooking: [
      "Extraktion von Booking.com (öffentliche Seite, Kalender, Ausstattungen)...",
      "Ermittlung von Vergleichsobjekten — dieser Schritt dauert bei Booking oft länger...",
      "KI-Analyse mit realem Wettbewerbskontext...",
      "Abschluss des Berichts (Scores, Verbesserungsachsen)...",
    ],
    overlayHintsDefault: [
      "Sichere Verbindung zur öffentlichen Inseratsseite...",
      "Normalisierung der Daten für einen fairen Vergleich...",
      "Die Schritte hängen von den Antworten der Plattformen ab (kein fester Prozentsatz).",
    ],
    overlayHintsBooking: [
      "Abruf über ein sicheres Gateway — bitte lassen Sie diesen Tab geöffnet.",
      "Booking kann Prüfungen verlangen: Der Server versucht es mit angepassten Strategien erneut.",
      "Die Phase „Vergleichsobjekte“ verkettet mehrere Extraktionen; sie ist oft die längste.",
    ],
  },
  it: {
    newAudit: "Nuovo audit",
    addListing: "Aggiungi un annuncio da monitorare",
    useAvailableDates: "Usa date realmente disponibili.",
    advancedSettingsOptional: "Le impostazioni avanzate sono facoltative.",
    addListingSubtitle:
      "Incolla l’URL pubblico del tuo annuncio. Creeremo una scheda nel tuo workspace e lanceremo l’audit.",
    listingSettings: "Impostazioni dell’annuncio",
    listingUrl: "URL dell’annuncio",
    continueBackground: "Puoi lasciare questa pagina, l’analisi continuerà in background.",
    keepScreenActive: "⚡ Lo schermo resterà attivo durante l’analisi",
    auditStillRunning: "Audit ancora in corso",
    auditStillRunningText:
      "Un audit è già in elaborazione. Manteniamo la schermata sincronizzata.",
    launchAudit: "Avvia audit",
    analysisRunning: "Analisi in corso...",
    automaticAudit: "Audit automatico + comparabili vicini",
    listingUrlMissing: "URL dell’annuncio",
    updateListingUrlError: "Impossibile aggiornare l’URL dell’annuncio",
    checkinDateMissing: "data di arrivo",
    checkoutDateMissing: "data di partenza",
    completeRequiredFields: "Completa i campi obbligatori prima di avviare l’audit",
    checkoutAfterCheckin: "La data di partenza deve essere successiva alla data di arrivo.",
    requiredFieldsFallback:
      "Completa i campi obbligatori prima di avviare l’audit: URL, date e tipo di alloggio.",
    unauthenticatedUser: "Utente non autenticato",
    listingCreationFailed: "Creazione dell’annuncio non riuscita",
    auditAlreadyRunningOtherListing:
      "Un audit è già in corso per un altro annuncio. Attendi la fine o torna su questa pagina.",
    important: "Importante:",
    respectMinimumNights: "rispetta il numero minimo di notti",
    minimumStayNights: "Soggiorno min. (notti)",
    auditConsiders: "Cosa considera l’audit",
    workspaceInitError: "Impossibile inizializzare il workspace per questo utente",
    existingListingsCheckError: "Impossibile verificare gli annunci esistenti",
    locationDetectedFromListing: "La posizione dell’alloggio viene rilevata automaticamente dall’annuncio.",
    auditConsidersLocation: "Posizione e piattaforma vengono rilevate automaticamente dall’annuncio.",
    auditConsidersComparables: "I comparabili sono filtrati per tipo di alloggio e coerenza locale.",
    auditConsidersPrice: "Il prezzo viene ricalcolato a notte per evitare falsi scarti di mercato.",
    auditConsidersAnalysis: "L’analisi valuta foto, descrizione, SEO e potenziale di conversione.",
    auditConsidersRecommendations: "Le raccomandazioni sono prioritarie in base all’impatto business stimato.",
    propertyType: "Tipo di alloggio",
    propertyTypePlaceholder: "Scegli il tipo di alloggio",
    platform: "Piattaforma",
    checkinDate: "Data di arrivo",
    checkoutDate: "Data di partenza",
    headerSubtitleSuffix: "per poterlo auditare e seguire le sue future ottimizzazioni.",
    resumeAuditLeadSubtitle: "L’analisi continua: puoi navigare nel dashboard.",
    formIntro: "Queste informazioni servono a creare la scheda base prima di lanciare un audit dettagliato.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(obbligatorio)",
    propertyTypeHelp: "Scegli il tipo reale di alloggio per ottenere comparabili affidabili.",
    availableDatesHelp: "Scegli date disponibili per recuperare un prezzo affidabile.",
    minimumNightsPriceHint:
      "dell’annuncio. Se la durata scelta è troppo breve, Airbnb o Booking potrebbero non mostrare un prezzo.",
    missingPlatformLabel: "piattaforma",
    missingPropertyTypeLabel: "tipo di alloggio",
    choosePropertyTypeError: "Seleziona il tipo di alloggio.",
    missingFieldsLabel: "Campi mancanti:",
    auditStaleError: "L’analisi ha richiesto troppo tempo o non è riuscita. Puoi rilanciare un audit.",
    previousAuditTimeoutError: "Tempo scaduto: il precedente audit non ha potuto essere confermato.",
    untitledListing: "Annuncio senza titolo",
    unknownError: "Si è verificato un errore sconosciuto",
    bookingUnavailableTitle: "Analisi Booking temporaneamente non disponibile",
    bookingUnavailableText:
      "Booking blocca temporaneamente l’accesso a questo annuncio. L’audit non è stato eseguito e nessun credito è stato addebitato. Riprova tra qualche minuto o seleziona altre date.",
    bookingUnavailableBalance: "Il tuo saldo resta invariato.",
    retry: "Riprova",
    quotaUpsellTitle: "Sblocca il tuo audit completo in 30 secondi",
    quotaUpsellText:
      "Non hai più crediti disponibili per lanciare un nuovo audit. Scegli un’offerta per continuare e sbloccare subito le tue prossime analisi.",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "1 audit singolo",
    proPackTitle: "Pacchetto 5 audit — 39 €",
    proPackSubtitle: "5 audit",
    scalePackTitle: "Pacchetto 15 audit — 99 €",
    scalePackSubtitle: "15 audit",
    viewOffersCta: "Vedi le offerte e sblocca i miei audit",
    quickTipsTitle: "Consigli rapidi",
    quickTipsPasteUrl: "Incolla semplicemente l’URL pubblico dell’annuncio.",
    automaticAnalysisBadge: "Analisi automatica",
    rightColumnDescription:
      "L’audit combina i segnali pubblici dell’annuncio con il tuo contesto di mercato per mirare meglio i comparabili fin dall’inizio.",
    loadingStepsDefault: [
      "Estrazione dell’annuncio (testo, foto, struttura)...",
      "Ricerca di concorrenti comparabili nelle vicinanze...",
      "Analisi IA e lettura del mercato...",
      "Costruzione del report e delle priorità...",
    ],
    loadingStepsBooking: [
      "Estrazione Booking.com (pagina pubblica, calendario, servizi)...",
      "Scoperta dei comparabili — questa fase è spesso più lunga su Booking...",
      "Analisi IA con il contesto competitivo reale...",
      "Finalizzazione del report (punteggi, assi di miglioramento)...",
    ],
    overlayHintsDefault: [
      "Connessione sicura alla pagina pubblica dell’annuncio...",
      "Normalizzazione dei dati per un confronto equo...",
      "Le fasi avanzano in base alla risposta delle piattaforme (nessuna percentuale fissa).",
    ],
    overlayHintsBooking: [
      "Recupero tramite gateway sicuro — lascia aperta questa scheda.",
      "Booking può imporre verifiche: il server riprova con strategie adattate.",
      "La fase «comparabili» concatena più estrazioni; spesso è la più lunga.",
    ],
  },
  pt: {
    newAudit: "Nova auditoria",
    addListing: "Adicionar um anúncio para acompanhar",
    useAvailableDates: "Use datas que estejam realmente disponíveis.",
    advancedSettingsOptional: "As definições avançadas são opcionais.",
    addListingSubtitle:
      "Cole o URL público do seu anúncio. Criaremos uma ficha no seu workspace e iniciaremos a auditoria.",
    listingSettings: "Definições do anúncio",
    listingUrl: "URL do anúncio",
    continueBackground: "Pode sair desta página, a análise continua em segundo plano.",
    keepScreenActive: "⚡ O seu ecrã ficará ativo durante a análise",
    auditStillRunning: "Auditoria ainda em curso",
    auditStillRunningText:
      "Uma auditoria já está a ser processada. Mantemos o ecrã sincronizado.",
    launchAudit: "Iniciar auditoria",
    analysisRunning: "Análise em curso...",
    automaticAudit: "Auditoria automática + comparáveis próximos",
    listingUrlMissing: "URL do anúncio",
    updateListingUrlError: "Não foi possível atualizar o URL do anúncio",
    checkinDateMissing: "data de chegada",
    checkoutDateMissing: "data de saída",
    completeRequiredFields: "Preencha os campos obrigatórios antes de iniciar a auditoria",
    checkoutAfterCheckin: "A data de saída deve ser posterior à data de chegada.",
    requiredFieldsFallback:
      "Preencha os campos obrigatórios antes de iniciar a auditoria: URL, datas e tipo de alojamento.",
    unauthenticatedUser: "Utilizador não autenticado",
    listingCreationFailed: "Falha ao criar o anúncio",
    auditAlreadyRunningOtherListing:
      "Já existe uma auditoria em curso para outro anúncio. Aguarde até terminar ou volte a esta página.",
    important: "Importante:",
    respectMinimumNights: "respeite o número mínimo de noites",
    minimumStayNights: "Estadia mín. (noites)",
    auditConsiders: "O que a auditoria considera",
    workspaceInitError: "Não foi possível inicializar o workspace para este utilizador",
    existingListingsCheckError: "Não foi possível verificar os anúncios existentes",
    locationDetectedFromListing: "A localização do alojamento é detetada automaticamente a partir do anúncio.",
    auditConsidersLocation: "A localização e a plataforma são detetadas automaticamente a partir do anúncio.",
    auditConsidersComparables: "Os comparáveis são filtrados por tipo de alojamento e coerência local.",
    auditConsidersPrice: "O preço é recalculado por noite para evitar falsos desvios de mercado.",
    auditConsidersAnalysis: "A análise avalia fotos, descrição, SEO e potencial de conversão.",
    auditConsidersRecommendations: "As recomendações são priorizadas pelo impacto comercial estimado.",
    propertyType: "Tipo de alojamento",
    propertyTypePlaceholder: "Escolha o tipo de alojamento",
    platform: "Plataforma",
    checkinDate: "Data de chegada",
    checkoutDate: "Data de saída",
    headerSubtitleSuffix: "para o poder auditar e acompanhar as suas futuras otimizações.",
    resumeAuditLeadSubtitle: "A análise continua — pode navegar no dashboard.",
    formIntro: "Estas informações servem para criar a ficha base antes de lançar uma auditoria detalhada.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(obrigatório)",
    propertyTypeHelp: "Escolha o tipo real de alojamento para obter comparáveis fiáveis.",
    availableDatesHelp: "Escolha datas disponíveis para obter um preço fiável.",
    minimumNightsPriceHint:
      "do anúncio. Se a duração escolhida for demasiado curta, a Airbnb ou a Booking podem não mostrar preço.",
    missingPlatformLabel: "plataforma",
    missingPropertyTypeLabel: "tipo de alojamento",
    choosePropertyTypeError: "Escolha o tipo de alojamento.",
    missingFieldsLabel: "Campos em falta:",
    auditStaleError: "A análise demorou demasiado tempo ou falhou. Pode relançar uma auditoria.",
    previousAuditTimeoutError: "Tempo excedido: a auditoria anterior não pôde ser confirmada.",
    untitledListing: "Anúncio sem título",
    unknownError: "Ocorreu um erro desconhecido",
    bookingUnavailableTitle: "Análise Booking temporariamente indisponível",
    bookingUnavailableText:
      "A Booking está a bloquear temporariamente o acesso a este anúncio. A auditoria não foi executada e nenhum crédito foi debitado. Tente novamente dentro de alguns minutos ou selecione outras datas.",
    bookingUnavailableBalance: "O seu saldo permanece inalterado.",
    retry: "Tentar novamente",
    quotaUpsellTitle: "Desbloqueie a sua auditoria completa em 30 segundos",
    quotaUpsellText:
      "Já não tem créditos disponíveis para iniciar uma nova auditoria. Escolha uma oferta para continuar e desbloquear imediatamente as suas próximas análises.",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "1 auditoria pontual",
    proPackTitle: "Pack 5 auditorias — 39 €",
    proPackSubtitle: "5 auditorias",
    scalePackTitle: "Pack 15 auditorias — 99 €",
    scalePackSubtitle: "15 auditorias",
    viewOffersCta: "Ver ofertas e desbloquear as minhas auditorias",
    quickTipsTitle: "Dicas rápidas",
    quickTipsPasteUrl: "Cole simplesmente o URL público do anúncio.",
    automaticAnalysisBadge: "Análise automática",
    rightColumnDescription:
      "A auditoria combina os sinais públicos do anúncio com o seu contexto de mercado para direcionar melhor os comparáveis desde o início.",
    loadingStepsDefault: [
      "Extração do anúncio (texto, fotos, estrutura)...",
      "Pesquisa de concorrentes comparáveis nas proximidades...",
      "Análise IA e leitura de mercado...",
      "Construção do relatório e das prioridades...",
    ],
    loadingStepsBooking: [
      "Extração do Booking.com (página pública, calendário, comodidades)...",
      "Descoberta de comparáveis — esta etapa é frequentemente mais longa no Booking...",
      "Análise IA com o contexto concorrencial real...",
      "Finalização do relatório (pontuações, eixos de melhoria)...",
    ],
    overlayHintsDefault: [
      "Ligação segura à página pública do anúncio...",
      "Normalização dos dados para uma comparação justa...",
      "As etapas avançam consoante a resposta das plataformas (sem percentagem fixa).",
    ],
    overlayHintsBooking: [
      "Recuperação via gateway seguro — mantenha este separador aberto.",
      "A Booking pode impor verificações: o servidor tenta novamente com estratégias adaptadas.",
      "A fase de «comparáveis» encadeia várias extrações; é frequentemente a mais longa.",
    ],
  },
  nl: {
    newAudit: "Nieuwe audit",
    addListing: "Advertentie toevoegen om te volgen",
    useAvailableDates: "Gebruik datums die echt beschikbaar zijn.",
    advancedSettingsOptional: "Geavanceerde instellingen zijn optioneel.",
    addListingSubtitle:
      "Plak de openbare URL van uw advertentie. We maken een item aan in uw workspace en starten de audit.",
    listingSettings: "Advertentie-instellingen",
    listingUrl: "Advertentie-URL",
    continueBackground: "U kunt deze pagina verlaten, de analyse loopt op de achtergrond door.",
    keepScreenActive: "⚡ Uw scherm blijft actief tijdens de analyse",
    auditStillRunning: "Audit loopt nog",
    auditStillRunningText:
      "Er wordt al een audit verwerkt. We houden het scherm gesynchroniseerd.",
    launchAudit: "Audit starten",
    analysisRunning: "Analyse bezig...",
    automaticAudit: "Automatische audit + nabije vergelijkbare advertenties",
    listingUrlMissing: "advertentie-URL",
    updateListingUrlError: "Kan de advertentie-URL niet bijwerken",
    checkinDateMissing: "incheckdatum",
    checkoutDateMissing: "uitcheckdatum",
    completeRequiredFields: "Vul de verplichte velden in voordat u de audit start",
    checkoutAfterCheckin: "De uitcheckdatum moet na de incheckdatum liggen.",
    requiredFieldsFallback:
      "Vul de verplichte velden in voordat u de audit start: URL, datums en accommodatietype.",
    unauthenticatedUser: "Niet-geauthenticeerde gebruiker",
    listingCreationFailed: "Aanmaken van advertentie mislukt",
    auditAlreadyRunningOtherListing:
      "Er loopt al een audit voor een andere advertentie. Wacht tot deze klaar is of keer terug naar deze pagina.",
    important: "Belangrijk:",
    respectMinimumNights: "respecteer het minimumaantal nachten",
    minimumStayNights: "Min. verblijf (nachten)",
    auditConsiders: "Waar de audit rekening mee houdt",
    workspaceInitError: "Kan de workspace voor deze gebruiker niet initialiseren",
    existingListingsCheckError: "Kan bestaande advertenties niet controleren",
    locationDetectedFromListing: "De locatie van de accommodatie wordt automatisch uit de advertentie gedetecteerd.",
    auditConsidersLocation: "Locatie en platform worden automatisch uit de advertentie gedetecteerd.",
    auditConsidersComparables: "Vergelijkbare advertenties worden gefilterd op accommodatietype en lokale consistentie.",
    auditConsidersPrice: "De prijs wordt per nacht herberekend om valse marktverschillen te vermijden.",
    auditConsidersAnalysis: "De analyse beoordeelt foto’s, beschrijving, SEO en conversiepotentieel.",
    auditConsidersRecommendations: "Aanbevelingen worden geprioriteerd op basis van geschatte zakelijke impact.",
    propertyType: "Accommodatietype",
    propertyTypePlaceholder: "Kies het accommodatietype",
    platform: "Platform",
    checkinDate: "Incheckdatum",
    checkoutDate: "Uitcheckdatum",
    headerSubtitleSuffix: "zodat u het kunt auditen en de toekomstige optimalisaties kunt volgen.",
    resumeAuditLeadSubtitle: "De analyse loopt door — u kunt in het dashboard navigeren.",
    formIntro: "Deze informatie dient om de basisvermelding aan te maken voordat een gedetailleerde audit wordt gestart.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(verplicht)",
    propertyTypeHelp: "Kies het echte accommodatietype om betrouwbare vergelijkbare advertenties te krijgen.",
    availableDatesHelp: "Kies beschikbare datums om een betrouwbare prijs op te halen.",
    minimumNightsPriceHint:
      "van de advertentie. Als de gekozen duur te kort is, tonen Airbnb of Booking mogelijk geen prijs.",
    missingPlatformLabel: "platform",
    missingPropertyTypeLabel: "accommodatietype",
    choosePropertyTypeError: "Kies het accommodatietype.",
    missingFieldsLabel: "Ontbrekende velden:",
    auditStaleError: "De analyse duurde te lang of is mislukt. U kunt een nieuwe audit starten.",
    previousAuditTimeoutError: "Tijdslimiet overschreden: de vorige audit kon niet worden bevestigd.",
    untitledListing: "Advertentie zonder titel",
    unknownError: "Er is een onbekende fout opgetreden",
    bookingUnavailableTitle: "Booking-analyse tijdelijk niet beschikbaar",
    bookingUnavailableText:
      "Booking blokkeert tijdelijk de toegang tot deze advertentie. De audit is niet uitgevoerd en er is geen tegoed afgeschreven. Probeer het over enkele minuten opnieuw of kies andere datums.",
    bookingUnavailableBalance: "Uw saldo blijft ongewijzigd.",
    retry: "Opnieuw proberen",
    quotaUpsellTitle: "Ontgrendel uw volledige audit in 30 seconden",
    quotaUpsellText:
      "U heeft geen credits meer beschikbaar om een nieuwe audit te starten. Kies een aanbod om verder te gaan en uw volgende analyses onmiddellijk te ontgrendelen.",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "1 eenmalige audit",
    proPackTitle: "Pack 5 audits — 39 €",
    proPackSubtitle: "5 audits",
    scalePackTitle: "Pack 15 audits — 99 €",
    scalePackSubtitle: "15 audits",
    viewOffersCta: "Bekijk aanbiedingen en ontgrendel mijn audits",
    quickTipsTitle: "Snelle tips",
    quickTipsPasteUrl: "Plak eenvoudig de openbare URL van de advertentie.",
    automaticAnalysisBadge: "Automatische analyse",
    rightColumnDescription:
      "De audit combineert de publieke signalen van de advertentie met uw marktcontext om vergelijkbare advertenties vanaf het begin beter te richten.",
    loadingStepsDefault: [
      "Advertentie extraheren (tekst, foto's, structuur)...",
      "Zoeken naar vergelijkbare concurrenten in de buurt...",
      "AI-analyse en marktlezing...",
      "Het rapport en de prioriteiten opbouwen...",
    ],
    loadingStepsBooking: [
      "Booking.com-extractie (publieke pagina, kalender, voorzieningen)...",
      "Vergelijkbare advertenties ontdekken — deze stap duurt vaak langer op Booking...",
      "AI-analyse met echte concurrentiecontext...",
      "Afronden van het rapport (scores, verbeterpunten)...",
    ],
    overlayHintsDefault: [
      "Beveiligde verbinding met de openbare advertentiepagina...",
      "Gegevens normaliseren voor een eerlijke vergelijking...",
      "De stappen gaan verder afhankelijk van de reacties van de platforms (geen vast percentage).",
    ],
    overlayHintsBooking: [
      "Ophalen via een beveiligde gateway — houd dit tabblad open.",
      "Booking kan controles opleggen: de server probeert opnieuw met aangepaste strategieën.",
      "De fase met «vergelijkbare advertenties» schakelt meerdere extracties achter elkaar; vaak is dit de langste fase.",
    ],
  },
  ja: {
    newAudit: "新しい監査",
    addListing: "追跡する掲載を追加",
    useAvailableDates: "実際に空いている日付を使用してください。",
    advancedSettingsOptional: "詳細設定は任意です。",
    addListingSubtitle:
      "掲載の公開URLを貼り付けてください。ワークスペースに掲載を作成し、監査を開始します。",
    listingSettings: "掲載設定",
    listingUrl: "掲載URL",
    continueBackground: "このページを離れても、分析はバックグラウンドで続行されます。",
    keepScreenActive: "⚡ 分析中は画面がアクティブなままになります",
    auditStillRunning: "監査はまだ進行中です",
    auditStillRunningText:
      "すでに監査が処理中です。画面は同期されたまま維持されます。",
    launchAudit: "監査を開始",
    analysisRunning: "分析中...",
    automaticAudit: "自動監査 + 近隣比較物件",
    listingUrlMissing: "掲載URL",
    updateListingUrlError: "掲載URLを更新できませんでした",
    checkinDateMissing: "チェックイン日",
    checkoutDateMissing: "チェックアウト日",
    completeRequiredFields: "監査を開始する前に必須項目を入力してください",
    checkoutAfterCheckin: "チェックアウト日はチェックイン日より後である必要があります。",
    requiredFieldsFallback:
      "監査を開始する前に必須項目を入力してください: URL、日付、宿泊施設タイプ。",
    unauthenticatedUser: "認証されていないユーザー",
    listingCreationFailed: "掲載の作成に失敗しました",
    auditAlreadyRunningOtherListing:
      "別の掲載ですでに監査が進行中です。完了まで待つか、このページに戻ってきてください。",
    important: "重要:",
    respectMinimumNights: "掲載の最低宿泊日数を守ってください",
    minimumStayNights: "最小宿泊数 (泊)",
    auditConsiders: "監査で考慮される項目",
    workspaceInitError: "このユーザーのワークスペースを初期化できませんでした",
    existingListingsCheckError: "既存の掲載を確認できませんでした",
    locationDetectedFromListing: "物件の所在地は掲載から自動的に検出されます。",
    auditConsidersLocation: "所在地とプラットフォームは掲載から自動的に検出されます。",
    auditConsidersComparables: "比較対象は宿泊施設タイプと地域の整合性で絞り込まれます。",
    auditConsidersPrice: "誤った市場差を避けるため、価格は1泊あたりで再計算されます。",
    auditConsidersAnalysis: "分析では写真、説明、SEO、コンバージョン可能性を評価します。",
    auditConsidersRecommendations: "推奨事項は推定ビジネスインパクトに基づいて優先順位付けされます。",
    propertyType: "宿泊施設タイプ",
    propertyTypePlaceholder: "宿泊施設タイプを選択",
    platform: "プラットフォーム",
    checkinDate: "チェックイン日",
    checkoutDate: "チェックアウト日",
    headerSubtitleSuffix: "監査を実行し、今後の最適化を追跡できるようにします。",
    resumeAuditLeadSubtitle: "分析は継続中です。ダッシュボード内を移動できます。",
    formIntro: "この情報は、詳細な監査を開始する前に基本となる掲載を作成するために使用されます。",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(必須)",
    propertyTypeHelp: "信頼できる比較対象を得るために、実際の宿泊施設タイプを選択してください。",
    availableDatesHelp: "信頼できる料金を取得するため、利用可能な日付を選択してください。",
    minimumNightsPriceHint:
      "掲載の条件です。選択した滞在日数が短すぎると、Airbnb や Booking に料金が表示されない場合があります。",
    missingPlatformLabel: "プラットフォーム",
    missingPropertyTypeLabel: "宿泊施設タイプ",
    choosePropertyTypeError: "宿泊施設タイプを選択してください。",
    missingFieldsLabel: "未入力の項目:",
    auditStaleError: "分析に時間がかかりすぎたか、失敗しました。監査を再実行できます。",
    previousAuditTimeoutError: "時間切れ: 前回の監査を確認できませんでした。",
    untitledListing: "無題の掲載",
    unknownError: "不明なエラーが発生しました",
    bookingUnavailableTitle: "Booking 分析は一時的に利用できません",
    bookingUnavailableText:
      "Booking がこの掲載へのアクセスを一時的にブロックしています。監査は実行されず、クレジットも消費されていません。数分後に再試行するか、別の日付を選択してください。",
    bookingUnavailableBalance: "残高は変わりません。",
    retry: "再試行",
    quotaUpsellTitle: "30秒で完全な監査を解放",
    quotaUpsellText:
      "新しい監査を開始するためのクレジットがありません。オファーを選択して続行し、次の分析をすぐに解放してください。",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "単発監査 1件",
    proPackTitle: "5件監査パック — 39 €",
    proPackSubtitle: "5件の監査",
    scalePackTitle: "15件監査パック — 99 €",
    scalePackSubtitle: "15件の監査",
    viewOffersCta: "オファーを見て監査を解放する",
    quickTipsTitle: "クイックヒント",
    quickTipsPasteUrl: "掲載の公開URLをそのまま貼り付けてください。",
    automaticAnalysisBadge: "自動分析",
    rightColumnDescription:
      "監査では、掲載の公開シグナルと市場コンテキストを組み合わせ、最初から比較対象をより正確に絞り込みます。",
    loadingStepsDefault: [
      "掲載を抽出中（テキスト、写真、構成）...",
      "近隣の比較可能な競合を検索中...",
      "AI分析と市場読解を実行中...",
      "レポートと優先事項を構築中...",
    ],
    loadingStepsBooking: [
      "Booking.com を抽出中（公開ページ、カレンダー、設備）...",
      "比較対象を検出中 — このステップは Booking では時間がかかることがあります...",
      "実際の競争環境を踏まえた AI 分析中...",
      "レポートを仕上げ中（スコア、改善軸）...",
    ],
    overlayHintsDefault: [
      "掲載の公開ページに安全に接続しています...",
      "公平な比較のためにデータを正規化しています...",
      "進行状況はプラットフォームの応答に応じて変わります（固定の割合はありません）。",
    ],
    overlayHintsBooking: [
      "安全なゲートウェイ経由で取得中です。このタブを開いたままにしてください。",
      "Booking は確認を要求する場合があります。サーバーは適切な戦略で再試行します。",
      "「比較対象」フェーズでは複数の抽出が連続して行われ、最も時間がかかることがよくあります。",
    ],
  },
  zh: {
    newAudit: "新审计",
    addListing: "添加要跟踪的房源",
    useAvailableDates: "请使用实际可预订的日期。",
    advancedSettingsOptional: "高级设置是可选的。",
    addListingSubtitle:
      "粘贴你的房源公开 URL。我们会在你的工作区中创建该房源并启动审计。",
    listingSettings: "房源设置",
    listingUrl: "房源 URL",
    continueBackground: "你可以离开此页面，分析会在后台继续。",
    keepScreenActive: "⚡ 分析期间你的屏幕将保持激活",
    auditStillRunning: "审计仍在进行中",
    auditStillRunningText:
      "已有一项审计正在处理中。我们会保持页面同步。",
    launchAudit: "启动审计",
    analysisRunning: "分析进行中...",
    automaticAudit: "自动审计 + 附近可比房源",
    listingUrlMissing: "房源 URL",
    updateListingUrlError: "无法更新房源 URL",
    checkinDateMissing: "入住日期",
    checkoutDateMissing: "退房日期",
    completeRequiredFields: "请在启动审计前填写必填字段",
    checkoutAfterCheckin: "退房日期必须晚于入住日期。",
    requiredFieldsFallback:
      "请在启动审计前填写必填字段：URL、日期和房源类型。",
    unauthenticatedUser: "用户未认证",
    listingCreationFailed: "创建房源失败",
    auditAlreadyRunningOtherListing:
      "另一套房源的审计已在进行中。请等待其完成或稍后返回此页面。",
    important: "重要：",
    respectMinimumNights: "请遵守房源的最少入住晚数",
    minimumStayNights: "最少入住（晚）",
    auditConsiders: "审计会考虑的内容",
    workspaceInitError: "无法为此用户初始化工作区",
    existingListingsCheckError: "无法检查现有房源",
    locationDetectedFromListing: "房源位置会从房源信息中自动检测。",
    auditConsidersLocation: "位置和平台会从房源信息中自动检测。",
    auditConsidersComparables: "可比房源会按房源类型和本地一致性进行筛选。",
    auditConsidersPrice: "价格会按每晚重新计算，以避免错误的市场差异。",
    auditConsidersAnalysis: "分析会评估照片、描述、SEO 和转化潜力。",
    auditConsidersRecommendations: "建议会根据预估业务影响进行优先级排序。",
    propertyType: "房源类型",
    propertyTypePlaceholder: "选择房源类型",
    platform: "平台",
    checkinDate: "入住日期",
    checkoutDate: "退房日期",
    headerSubtitleSuffix: "以便你可以对其进行审计并跟踪后续优化。",
    resumeAuditLeadSubtitle: "分析仍在继续，你可以在仪表板中自由导航。",
    formIntro: "这些信息用于在启动详细审计前创建基础房源记录。",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(必填)",
    propertyTypeHelp: "请选择真实的房源类型，以获得可靠的可比房源。",
    availableDatesHelp: "请选择可用日期，以获取可靠的价格。",
    minimumNightsPriceHint:
      "是该房源的限制。如果所选住宿时长过短，Airbnb 或 Booking 可能不会显示价格。",
    missingPlatformLabel: "平台",
    missingPropertyTypeLabel: "房源类型",
    choosePropertyTypeError: "请选择房源类型。",
    missingFieldsLabel: "缺少字段：",
    auditStaleError: "分析耗时过长或已失败。你可以重新发起审计。",
    previousAuditTimeoutError: "超时：之前的审计无法被确认。",
    untitledListing: "未命名房源",
    unknownError: "发生了未知错误",
    bookingUnavailableTitle: "Booking 分析暂时不可用",
    bookingUnavailableText:
      "Booking 暂时阻止了对此房源的访问。审计未执行，也没有扣除任何额度。请几分钟后重试，或选择其他日期。",
    bookingUnavailableBalance: "你的余额保持不变。",
    retry: "重试",
    quotaUpsellTitle: "30 秒内解锁你的完整审计",
    quotaUpsellText:
      "你已没有可用额度来启动新的审计。请选择一个方案以继续，并立即解锁你的后续分析。",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "1 次单次审计",
    proPackTitle: "5 次审计包 — 39 €",
    proPackSubtitle: "5 次审计",
    scalePackTitle: "15 次审计包 — 99 €",
    scalePackSubtitle: "15 次审计",
    viewOffersCta: "查看方案并解锁我的审计",
    quickTipsTitle: "快速提示",
    quickTipsPasteUrl: "直接粘贴房源的公开 URL。",
    automaticAnalysisBadge: "自动分析",
    rightColumnDescription:
      "审计会将房源的公开信号与你的市场背景结合起来，从一开始就更精准地锁定可比房源。",
    loadingStepsDefault: [
      "正在提取房源信息（文本、照片、结构）...",
      "正在搜索附近可比较的竞争房源...",
      "正在进行 AI 分析和市场解读...",
      "正在生成报告和优先事项...",
    ],
    loadingStepsBooking: [
      "正在提取 Booking.com 数据（公开页面、日历、设施）...",
      "正在发现可比房源——这一步在 Booking 上通常更耗时...",
      "正在结合真实竞争环境进行 AI 分析...",
      "正在完成报告（评分、改进方向）...",
    ],
    overlayHintsDefault: [
      "正在安全连接到房源公开页面...",
      "正在标准化数据以进行公平比较...",
      "各步骤会根据平台响应推进（没有固定百分比）。",
    ],
    overlayHintsBooking: [
      "正在通过安全网关抓取——请保持此标签页打开。",
      "Booking 可能会触发验证：服务器会使用适配策略重试。",
      "“可比房源”阶段会串联多次提取，通常是最耗时的一步。",
    ],
  },
  ko: {
    newAudit: "새 감사",
    addListing: "추적할 숙소 추가",
    useAvailableDates: "실제로 예약 가능한 날짜를 사용하세요.",
    advancedSettingsOptional: "고급 설정은 선택 사항입니다.",
    addListingSubtitle:
      "숙소의 공개 URL을 붙여 넣으세요. 워크스페이스에 숙소를 생성하고 감사를 시작합니다.",
    listingSettings: "숙소 설정",
    listingUrl: "숙소 URL",
    continueBackground: "이 페이지를 떠나도 분석은 백그라운드에서 계속됩니다.",
    keepScreenActive: "⚡ 분석 중에는 화면이 계속 활성 상태로 유지됩니다",
    auditStillRunning: "감사가 아직 진행 중입니다",
    auditStillRunningText:
      "이미 감사가 처리 중입니다. 화면은 계속 동기화된 상태로 유지됩니다.",
    launchAudit: "감사 시작",
    analysisRunning: "분석 진행 중...",
    automaticAudit: "자동 감사 + 주변 비교 숙소",
    listingUrlMissing: "숙소 URL",
    updateListingUrlError: "숙소 URL을 업데이트할 수 없습니다",
    checkinDateMissing: "체크인 날짜",
    checkoutDateMissing: "체크아웃 날짜",
    completeRequiredFields: "감사를 시작하기 전에 필수 항목을 입력하세요",
    checkoutAfterCheckin: "체크아웃 날짜는 체크인 날짜보다 이후여야 합니다.",
    requiredFieldsFallback:
      "감사를 시작하기 전에 필수 항목을 입력하세요: URL, 날짜, 숙소 유형.",
    unauthenticatedUser: "인증되지 않은 사용자",
    listingCreationFailed: "숙소 생성에 실패했습니다",
    auditAlreadyRunningOtherListing:
      "다른 숙소에서 이미 감사가 진행 중입니다. 완료될 때까지 기다리거나 이 페이지로 다시 돌아오세요.",
    important: "중요:",
    respectMinimumNights: "숙소의 최소 숙박 일수를 지켜 주세요",
    minimumStayNights: "최소 숙박 (박)",
    auditConsiders: "감사가 고려하는 항목",
    workspaceInitError: "이 사용자의 워크스페이스를 초기화할 수 없습니다",
    existingListingsCheckError: "기존 숙소를 확인할 수 없습니다",
    locationDetectedFromListing: "숙소 위치는 숙소 정보에서 자동으로 감지됩니다.",
    auditConsidersLocation: "위치와 플랫폼은 숙소 정보에서 자동으로 감지됩니다.",
    auditConsidersComparables: "비교 숙소는 숙소 유형과 지역 일관성을 기준으로 필터링됩니다.",
    auditConsidersPrice: "잘못된 시장 차이를 피하기 위해 가격은 1박 기준으로 다시 계산됩니다.",
    auditConsidersAnalysis: "분석은 사진, 설명, SEO, 전환 가능성을 평가합니다.",
    auditConsidersRecommendations: "추천 사항은 예상 비즈니스 영향에 따라 우선순위가 정해집니다.",
    propertyType: "숙소 유형",
    propertyTypePlaceholder: "숙소 유형 선택",
    platform: "플랫폼",
    checkinDate: "체크인 날짜",
    checkoutDate: "체크아웃 날짜",
    headerSubtitleSuffix: "감사를 실행하고 이후 최적화를 추적할 수 있습니다.",
    resumeAuditLeadSubtitle: "분석은 계속 진행 중이며, 대시보드 내를 자유롭게 이동할 수 있습니다.",
    formIntro: "이 정보는 상세 감사를 시작하기 전에 기본 숙소 항목을 생성하는 데 사용됩니다.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(필수)",
    propertyTypeHelp: "신뢰할 수 있는 비교 숙소를 얻으려면 실제 숙소 유형을 선택하세요.",
    availableDatesHelp: "신뢰할 수 있는 가격을 얻으려면 이용 가능한 날짜를 선택하세요.",
    minimumNightsPriceHint:
      "는 해당 숙소의 제한입니다. 선택한 숙박 기간이 너무 짧으면 Airbnb 또는 Booking에 가격이 표시되지 않을 수 있습니다.",
    missingPlatformLabel: "플랫폼",
    missingPropertyTypeLabel: "숙소 유형",
    choosePropertyTypeError: "숙소 유형을 선택하세요.",
    missingFieldsLabel: "누락된 항목:",
    auditStaleError: "분석이 너무 오래 걸렸거나 실패했습니다. 감사를 다시 시작할 수 있습니다.",
    previousAuditTimeoutError: "시간 초과: 이전 감사를 확인할 수 없었습니다.",
    untitledListing: "제목 없는 숙소",
    unknownError: "알 수 없는 오류가 발생했습니다",
    bookingUnavailableTitle: "Booking 분석을 일시적으로 사용할 수 없습니다",
    bookingUnavailableText:
      "Booking이 이 숙소에 대한 접근을 일시적으로 차단하고 있습니다. 감사는 실행되지 않았으며 크레딧도 차감되지 않았습니다. 몇 분 후 다시 시도하거나 다른 날짜를 선택하세요.",
    bookingUnavailableBalance: "잔액은 그대로 유지됩니다.",
    retry: "다시 시도",
    quotaUpsellTitle: "30초 안에 전체 감사를 해제하세요",
    quotaUpsellText:
      "새 감사를 시작할 수 있는 크레딧이 없습니다. 계속 진행하고 다음 분석을 바로 해제하려면 오퍼를 선택하세요.",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "단일 감사 1회",
    proPackTitle: "감사 5회 팩 — 39 €",
    proPackSubtitle: "감사 5회",
    scalePackTitle: "감사 15회 팩 — 99 €",
    scalePackSubtitle: "감사 15회",
    viewOffersCta: "오퍼를 보고 내 감사를 해제하기",
    quickTipsTitle: "빠른 팁",
    quickTipsPasteUrl: "숙소의 공개 URL을 그대로 붙여 넣으세요.",
    automaticAnalysisBadge: "자동 분석",
    rightColumnDescription:
      "감사는 숙소의 공개 신호와 시장 맥락을 결합해 처음부터 비교 숙소를 더 정확히 선별합니다.",
    loadingStepsDefault: [
      "숙소를 추출하는 중입니다(텍스트, 사진, 구조)...",
      "근처의 비교 가능한 경쟁 숙소를 찾는 중입니다...",
      "AI 분석 및 시장 판독을 수행하는 중입니다...",
      "보고서와 우선순위를 구성하는 중입니다...",
    ],
    loadingStepsBooking: [
      "Booking.com 데이터를 추출하는 중입니다(공개 페이지, 달력, 편의시설)...",
      "비교 숙소를 탐색하는 중입니다 — 이 단계는 Booking에서 더 오래 걸리는 경우가 많습니다...",
      "실제 경쟁 맥락을 반영한 AI 분석 중입니다...",
      "보고서를 마무리하는 중입니다(점수, 개선 축)...",
    ],
    overlayHintsDefault: [
      "숙소 공개 페이지에 안전하게 연결 중입니다...",
      "공정한 비교를 위해 데이터를 정규화하는 중입니다...",
      "각 단계는 플랫폼 응답에 따라 진행됩니다(고정 퍼센트 없음).",
    ],
    overlayHintsBooking: [
      "보안 게이트웨이를 통해 가져오는 중입니다. 이 탭을 열어 두세요.",
      "Booking이 검증을 요구할 수 있습니다. 서버가 적절한 전략으로 재시도합니다.",
      "‘비교 숙소’ 단계는 여러 추출을 연속으로 실행하며, 가장 오래 걸리는 경우가 많습니다.",
    ],
  },
  ar: {
    newAudit: "تدقيق جديد",
    addListing: "إضافة إعلان للمتابعة",
    useAvailableDates: "استخدم تواريخ متاحة فعليًا.",
    advancedSettingsOptional: "الإعدادات المتقدمة اختيارية.",
    addListingSubtitle:
      "ألصق الرابط العام لإعلانك. سننشئ إعلانًا داخل مساحة العمل الخاصة بك ونبدأ التدقيق.",
    listingSettings: "إعدادات الإعلان",
    listingUrl: "رابط الإعلان",
    continueBackground: "يمكنك مغادرة هذه الصفحة، وسيستمر التحليل في الخلفية.",
    keepScreenActive: "⚡ ستظل شاشتك نشطة أثناء التحليل",
    auditStillRunning: "لا يزال التدقيق جاريًا",
    auditStillRunningText:
      "هناك تدقيق قيد المعالجة بالفعل. سنبقي الشاشة متزامنة.",
    launchAudit: "بدء التدقيق",
    analysisRunning: "التحليل جارٍ...",
    automaticAudit: "تدقيق تلقائي + مقارنات قريبة",
    listingUrlMissing: "رابط الإعلان",
    updateListingUrlError: "تعذر تحديث رابط الإعلان",
    checkinDateMissing: "تاريخ الوصول",
    checkoutDateMissing: "تاريخ المغادرة",
    completeRequiredFields: "أكمل الحقول المطلوبة قبل بدء التدقيق",
    checkoutAfterCheckin: "يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول.",
    requiredFieldsFallback:
      "أكمل الحقول المطلوبة قبل بدء التدقيق: الرابط، التواريخ، ونوع الإقامة.",
    unauthenticatedUser: "مستخدم غير موثّق",
    listingCreationFailed: "فشل إنشاء الإعلان",
    auditAlreadyRunningOtherListing:
      "يوجد تدقيق جارٍ بالفعل لإعلان آخر. انتظر حتى ينتهي أو عد إلى هذه الصفحة لاحقًا.",
    important: "مهم:",
    respectMinimumNights: "احترم الحد الأدنى لعدد الليالي في الإعلان",
    minimumStayNights: "الحد الأدنى للإقامة (ليالٍ)",
    auditConsiders: "ما الذي يأخذه التدقيق في الاعتبار",
    workspaceInitError: "تعذر تهيئة مساحة العمل لهذا المستخدم",
    existingListingsCheckError: "تعذر التحقق من الإعلانات الحالية",
    locationDetectedFromListing: "يتم اكتشاف موقع العقار تلقائيًا من الإعلان.",
    auditConsidersLocation: "يتم اكتشاف الموقع والمنصة تلقائيًا من الإعلان.",
    auditConsidersComparables: "تتم تصفية المقارنات حسب نوع الإقامة والاتساق المحلي.",
    auditConsidersPrice: "يُعاد حساب السعر لكل ليلة لتجنب الفروقات السوقية الخاطئة.",
    auditConsidersAnalysis: "يقيم التحليل الصور والوصف وSEO وإمكانات التحويل.",
    auditConsidersRecommendations: "تُرتب التوصيات حسب الأولوية وفقًا لتأثيرها التجاري التقديري.",
    propertyType: "نوع الإقامة",
    propertyTypePlaceholder: "اختر نوع الإقامة",
    platform: "المنصة",
    checkinDate: "تاريخ الوصول",
    checkoutDate: "تاريخ المغادرة",
    headerSubtitleSuffix: "حتى تتمكن من تدقيقه ومتابعة تحسيناته المستقبلية.",
    resumeAuditLeadSubtitle: "التحليل ما زال مستمرًا — يمكنك التنقل داخل لوحة التحكم.",
    formIntro: "تُستخدم هذه المعلومات لإنشاء بطاقة الإعلان الأساسية قبل إطلاق تدقيق مفصل.",
    listingUrlPlaceholder: "https://www.airbnb.com/rooms/...",
    requiredLabel: "(إلزامي)",
    propertyTypeHelp: "اختر النوع الحقيقي للإقامة للحصول على مقارنات موثوقة.",
    availableDatesHelp: "اختر تواريخ متاحة للحصول على سعر موثوق.",
    minimumNightsPriceHint:
      "في الإعلان. إذا كانت مدة الإقامة المختارة قصيرة جدًا، فقد لا تعرض Airbnb أو Booking أي سعر.",
    missingPlatformLabel: "المنصة",
    missingPropertyTypeLabel: "نوع الإقامة",
    choosePropertyTypeError: "يرجى اختيار نوع الإقامة.",
    missingFieldsLabel: "الحقول الناقصة:",
    auditStaleError: "استغرق التحليل وقتًا طويلاً أو فشل. يمكنك إعادة إطلاق التدقيق.",
    previousAuditTimeoutError: "تم تجاوز المهلة: تعذر تأكيد التدقيق السابق.",
    untitledListing: "إعلان بلا عنوان",
    unknownError: "حدث خطأ غير معروف",
    bookingUnavailableTitle: "تحليل Booking غير متاح مؤقتًا",
    bookingUnavailableText:
      "يقوم Booking بحظر الوصول إلى هذا الإعلان مؤقتًا. لم يتم تنفيذ التدقيق ولم يتم خصم أي رصيد. حاول مرة أخرى بعد بضع دقائق أو اختر تواريخ أخرى.",
    bookingUnavailableBalance: "يبقى رصيدك دون تغيير.",
    retry: "إعادة المحاولة",
    quotaUpsellTitle: "افتح التدقيق الكامل خلال 30 ثانية",
    quotaUpsellText:
      "لم يعد لديك أي أرصدة متاحة لإطلاق تدقيق جديد. اختر عرضًا للمتابعة وفتح تحليلاتك التالية فورًا.",
    starterPackTitle: "Starter — 9 €",
    starterPackSubtitle: "تدقيق واحد لمرة واحدة",
    proPackTitle: "باقة 5 تدقيقات — 39 €",
    proPackSubtitle: "5 تدقيقات",
    scalePackTitle: "باقة 15 تدقيقًا — 99 €",
    scalePackSubtitle: "15 تدقيقًا",
    viewOffersCta: "عرض العروض وفتح تدقيقاتي",
    quickTipsTitle: "نصائح سريعة",
    quickTipsPasteUrl: "ألصق ببساطة الرابط العام للإعلان.",
    automaticAnalysisBadge: "تحليل تلقائي",
    rightColumnDescription:
      "يجمع التدقيق بين الإشارات العامة للإعلان وسياق السوق لديك لتحديد المقارنات بشكل أدق منذ البداية.",
    loadingStepsDefault: [
      "استخراج الإعلان (النص، الصور، البنية)...",
      "البحث عن منافسين قابلين للمقارنة في الجوار...",
      "تحليل الذكاء الاصطناعي وقراءة السوق...",
      "بناء التقرير وتحديد الأولويات...",
    ],
    loadingStepsBooking: [
      "استخراج بيانات Booking.com (الصفحة العامة، التقويم، التجهيزات)...",
      "اكتشاف المقارنات — هذه المرحلة غالبًا ما تكون أطول على Booking...",
      "تحليل الذكاء الاصطناعي مع سياق تنافسي حقيقي...",
      "إنهاء التقرير (النتائج، محاور التحسين)...",
    ],
    overlayHintsDefault: [
      "اتصال آمن بصفحة الإعلان العامة...",
      "توحيد البيانات لإجراء مقارنة عادلة...",
      "تتقدم المراحل بحسب استجابة المنصات (من دون نسبة ثابتة).",
    ],
    overlayHintsBooking: [
      "يتم الجلب عبر بوابة آمنة — يرجى إبقاء هذا التبويب مفتوحًا.",
      "قد يفرض Booking عمليات تحقق: يعيد الخادم المحاولة باستراتيجيات مناسبة.",
      "تسلسل مرحلة «المقارنات» عدة عمليات استخراج، وغالبًا ما تكون الأطول.",
    ],
  },
} as const;

function activeAuditKey(workspaceId: string) {
  return `norixo_active_audit:${workspaceId}`;
}

function auditRedirectKey(workspaceId: string) {
  return `norixo_audit_redirect:${workspaceId}`;
}

/** Date locale au format yyyy-mm-dd (champ `input type="date"`). */
function todayIsoDateLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ActiveAuditPending = {
  listingId: string;
  workspaceId: string;
  startedAt: number;
};

let globalAuditPoll: ReturnType<typeof setInterval> | null = null;

function disarmGlobalAuditPoll() {
  if (globalAuditPoll != null) {
    clearInterval(globalAuditPoll);
    globalAuditPoll = null;
  }
}

function armGlobalAuditPoll(
  workspaceId: string,
  handlers: { onFound: (auditId: string) => void; onStale: () => void }
) {
  disarmGlobalAuditPoll();
  const tick = async () => {
    const raw = sessionStorage.getItem(activeAuditKey(workspaceId));
    if (!raw) {
      disarmGlobalAuditPoll();
      return;
    }
    let pending: ActiveAuditPending;
    try {
      pending = JSON.parse(raw) as ActiveAuditPending;
    } catch {
      disarmGlobalAuditPoll();
      sessionStorage.removeItem(activeAuditKey(workspaceId));
      return;
    }
    if (Date.now() - pending.startedAt > AUDIT_STALE_MS) {
      disarmGlobalAuditPoll();
      sessionStorage.removeItem(activeAuditKey(workspaceId));
      handlers.onStale();
      return;
    }
    const threshold = new Date(pending.startedAt - 120_000).toISOString();
    const { data } = await supabase
      .from("audits")
      .select("id")
      .eq("listing_id", pending.listingId)
      .eq("workspace_id", workspaceId)
      .gte("created_at", threshold)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      disarmGlobalAuditPoll();
      sessionStorage.removeItem(activeAuditKey(workspaceId));
      handlers.onFound(data.id);
    }
  };
  void tick();
  globalAuditPoll = setInterval(() => void tick(), AUDIT_POLL_MS);
}

const ADVANCED_MARKET_TIER_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "haut_standing", label: "Haut standing" },
  { value: "premium", label: "Premium" },
  { value: "luxe_experientiel", label: "Luxe expérientiel" },
  { value: "ultra_luxe", label: "Ultra-luxe" },
] as const;

const ADVANCED_SIGNAL_OPTIONS = [
  { value: "private_pool", label: "Piscine privée" },
  { value: "sea_view", label: "Vue mer" },
  { value: "beachfront", label: "Beachfront" },
  { value: "jacuzzi", label: "Jacuzzi" },
  { value: "parking", label: "Parking" },
  { value: "ac", label: "Climatisation" },
  { value: "wifi", label: "Wifi" },
  { value: "gym", label: "Gym" },
  { value: "terrace", label: "Terrasse" },
  { value: "concierge", label: "Conciergerie" },
] as const;

export default function NewListingPage() {
  const { copy } = useTranslation(listingNewCopy);
  const router = useRouter();
  const pathname = usePathname();

  const [url, setUrl] = useState("");
  const [propertyTypeOverride, setPropertyTypeOverride] = useState("");
  const [stayCheckIn, setStayCheckIn] = useState("");
  const [stayCheckOut, setStayCheckOut] = useState("");
  const [platform, setPlatform] = useState("airbnb");
  const [advancedBedrooms, setAdvancedBedrooms] = useState("");
  const [advancedBathrooms, setAdvancedBathrooms] = useState("");
  const [advancedGuests, setAdvancedGuests] = useState("");
  const [advancedBeds, setAdvancedBeds] = useState("");
  const [advancedMinStay, setAdvancedMinStay] = useState("");
  const [advancedMarketTier, setAdvancedMarketTier] = useState("");
  const [advancedSignals, setAdvancedSignals] = useState<string[]>([]);
const SHOW_ADVANCED_MARKET_SETTINGS = false;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [bookingExtractionUnavailable, setBookingExtractionUnavailable] = useState(false);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [resumeAuditUi, setResumeAuditUi] = useState(false);
  const [formGateError, setFormGateError] = useState<string | null>(null);
  const [formGateMissingLabels, setFormGateMissingLabels] = useState<string[]>([]);
  const [formGateDateOrder, setFormGateDateOrder] = useState(false);
  const [invalidFields, setInvalidFields] = useState<{
    url?: boolean;
    dates?: boolean;
    platform?: boolean;
    propertyType?: boolean;
  }>({});
  const stayCheckInRef = useRef<HTMLInputElement | null>(null);
  const stayCheckOutRef = useRef<HTMLInputElement | null>(null);

  const minStayCheckInIso = useMemo(() => todayIsoDateLocal(), []);
  const minStayCheckOutIso = useMemo(() => {
    const cin = stayCheckIn.trim();
    if (cin) return addDaysToIsoDate(cin, 1);
    return addDaysToIsoDate(minStayCheckInIso, 1);
  }, [stayCheckIn, minStayCheckInIso]);

  function openNativeDatePicker(ref: { current: HTMLInputElement | null }) {
    const input = ref.current;
    if (!input || input.disabled) return;
    try {
      const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
      if (typeof pickerInput.showPicker === "function") {
        pickerInput.showPicker();
        return;
      }
    } catch {
      // Fallback below for browsers that throw on showPicker.
    }
    input.focus();
  }

  const workspaceForPollRef = useRef<string | null>(null);
  const pollHandlersRef = useRef({
    onFound: (_auditId: string) => {},
    onStale: () => {},
  });
  pollHandlersRef.current = {
    onFound(auditId: string) {
      setIsSubmitting(false);
      setResumeAuditUi(false);
      setBookingExtractionUnavailable(false);
      setError(null);
      setFormGateError(null);
      setFormGateMissingLabels([]);
      setFormGateDateOrder(false);
      setInvalidFields({});
      const ws = workspaceForPollRef.current;
      if (ws) sessionStorage.removeItem(auditRedirectKey(ws));
      router.replace(`/dashboard/audits/${auditId}`);
    },
    onStale() {
      setIsSubmitting(false);
      setResumeAuditUi(false);
      setError(copy.auditStaleError);
    },
  };

  useEffect(() => {
    let cancelled = false;

    async function bootRecovery() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user || cancelled) return;

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
      });
      const ws = workspace?.id;
      if (!ws || cancelled) return;

      workspaceForPollRef.current = ws;

      const rk = auditRedirectKey(ws);
      const redirectRaw = sessionStorage.getItem(rk);
      if (redirectRaw) {
        try {
          const parsed = JSON.parse(redirectRaw) as { auditId?: string; ts?: number };
          if (
            parsed.auditId &&
            typeof parsed.ts === "number" &&
            Date.now() - parsed.ts < AUDIT_REDIRECT_MAX_AGE_MS
          ) {
            disarmGlobalAuditPoll();
            sessionStorage.removeItem(rk);
            router.replace(`/dashboard/audits/${parsed.auditId}`);
            return;
          }
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem(rk);
      }

      const rawPending = sessionStorage.getItem(activeAuditKey(ws));
      if (!rawPending) return;

      let pending: ActiveAuditPending;
      try {
        pending = JSON.parse(rawPending) as ActiveAuditPending;
      } catch {
        sessionStorage.removeItem(activeAuditKey(ws));
        return;
      }
      if (pending.workspaceId !== ws) {
        sessionStorage.removeItem(activeAuditKey(ws));
        return;
      }
      if (Date.now() - pending.startedAt > AUDIT_STALE_MS) {
        sessionStorage.removeItem(activeAuditKey(ws));
        setError(copy.previousAuditTimeoutError);
        return;
      }

      setIsSubmitting(true);
      setResumeAuditUi(true);
      armGlobalAuditPoll(ws, {
        onFound: (id) => pollHandlersRef.current.onFound(id),
        onStale: () => pollHandlersRef.current.onStale(),
      });
    }

    void bootRecovery();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadingSteps = useMemo(() => {
    return url.toLowerCase().includes("booking")
      ? copy.loadingStepsBooking
      : copy.loadingStepsDefault;
  }, [url, copy]);

  const overlayHints = useMemo(() => {
    return url.toLowerCase().includes("booking")
      ? copy.overlayHintsBooking
      : copy.overlayHintsDefault;
  }, [url, copy]);

  const stepIntervalMs = useMemo(
    () => (url.toLowerCase().includes("booking") ? 4500 : 2400),
    [url]
  );

  useEffect(() => {
    if (!isSubmitting) {
      setStepIndex(0);
      setHintIndex(0);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, stepIntervalMs);

    const hintTimer = window.setInterval(() => {
      setHintIndex((prev) => prev + 1);
    }, 3200);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(hintTimer);
    };
  }, [isSubmitting, loadingSteps.length, stepIntervalMs]);

  const currentStep = useMemo(
    () => loadingSteps[stepIndex] ?? loadingSteps[0],
    [loadingSteps, stepIndex]
  );

  const rotatingHint = useMemo(() => {
    return overlayHints[hintIndex % overlayHints.length] ?? overlayHints[0];
  }, [hintIndex, overlayHints]);

  function normalizeListingUrlInput(nextUrl: string): string {
    const value = nextUrl.trim();

    if (!value) return value;
    if (/^https?:\/\//i.test(value)) return value;

    if (/^(www\.)?(airbnb|booking|agoda|vrbo|expedia)\./i.test(value)) {
      return `https://${value}`;
    }

    return value;
  }

  function detectPlatformFromInput(
    nextUrl: string
  ): string | null {
    const value = nextUrl.trim().toLowerCase();

    if (!value) return null;

    if (value.includes("airbnb")) return "airbnb";
    if (value.includes("booking")) return "booking";

    if (value.includes("agoda")) return "agoda";
    if (value.includes("vrbo")) return "vrbo";
    if (value.includes("expedia")) return "expedia";

    return null;
  }

  useEffect(() => {
    const detectedPlatform = detectPlatformFromInput(url);
    if (detectedPlatform && detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }
  }, [url, platform]);

  useEffect(() => {
    const cin = stayCheckIn.trim();
    if (!cin) return;
    setStayCheckOut((prev) => {
      const p = prev.trim();
      if (!p) return prev;
      const minOut = addDaysToIsoDate(cin, 1);
      if (p < minOut) return "";
      return prev;
    });
  }, [stayCheckIn]);

  useEffect(() => {
    setFormGateError(null);
    setFormGateMissingLabels([]);
    setFormGateDateOrder(false);
    setInvalidFields({});
  }, [
    url,
    stayCheckIn,
    stayCheckOut,
    platform,
  ]);

  function validateListingFormGate(): {
    ok: boolean;
    missingLabels: string[];
    dateOrderError: boolean;
    highlights: typeof invalidFields;
  } {
    const missingLabels: string[] = [];
    const highlights: typeof invalidFields = {};

    if (!url.trim()) {
      missingLabels.push(copy.listingUrlMissing);
      highlights.url = true;
    }
    if (!stayCheckIn.trim()) {
      missingLabels.push(copy.checkinDateMissing);
      highlights.dates = true;
    }
    if (!stayCheckOut.trim()) {
      missingLabels.push(copy.checkoutDateMissing);
      highlights.dates = true;
    }
    const cin = stayCheckIn.trim();
    const cout = stayCheckOut.trim();
    let dateOrderError = false;
    if (cin && cout) {
      const minOut = addDaysToIsoDate(cin, 1);
      if (cout <= cin || cout < minOut) {
        dateOrderError = true;
        highlights.dates = true;
      }
    }

    if (!platform.trim()) {
      missingLabels.push(copy.missingPlatformLabel);
      highlights.platform = true;
    }

    if (!propertyTypeOverride.trim()) {
      missingLabels.push(copy.missingPropertyTypeLabel);
      highlights.propertyType = true;
    }

    const ok = missingLabels.length === 0 && !dateOrderError;
    return { ok, missingLabels, dateOrderError, highlights };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsQuotaError(false);
    setBookingExtractionUnavailable(false);

    const gate = validateListingFormGate();
    if (!gate.ok) {
      const typeMissing = !propertyTypeOverride.trim();
      const otherMissing = gate.missingLabels.filter(
        (l) => l !== copy.missingPropertyTypeLabel
      );
      const parts: string[] = [];
      if (typeMissing) {
        parts.push(copy.choosePropertyTypeError);
      }
      if (otherMissing.length > 0) {
        parts.push(
          `${copy.completeRequiredFields}: ${otherMissing.join(", ")}.`
        );
      }
      if (gate.dateOrderError) {
        parts.push(copy.checkoutAfterCheckin);
      }
      const primaryMessage =
        parts.join(" ") ||
        copy.requiredFieldsFallback;
      setFormGateError(primaryMessage);
      setFormGateMissingLabels(gate.missingLabels);
      setFormGateDateOrder(gate.dateOrderError);
      setInvalidFields(gate.highlights);
      return;
    }
    setFormGateError(null);
    setFormGateMissingLabels([]);
    setFormGateDateOrder(false);
    setInvalidFields({});

    setIsSubmitting(true);
    setStepIndex(0);
    setHintIndex(0);

    let auditPendingWorkspace: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(copy.unauthenticatedUser);
      }

      const workspace = await getOrCreateWorkspaceForUser({
        userId: user.id,
        email: user.email ?? null,
      });

      const effectiveWorkspaceId = workspace?.id;

      if (!effectiveWorkspaceId) {
        throw new Error(copy.workspaceInitError);
      }

      workspaceForPollRef.current = effectiveWorkspaceId;

      const trimmedListingUrl = normalizeListingUrlInput(url);
      const cin = stayCheckIn.trim();
      const cout = stayCheckOut.trim();

      const finalUrl = applyStayDatesToListingUrl(trimmedListingUrl, {
        checkIn: cin,
        checkOut: cout,
      });
      const normalizedUrl = normalizeSourceUrl(finalUrl);

      if (process.env.NODE_ENV === "development") {
        console.log("[listing-new][geo-overrides-submit]", {
          country: null,
          city: null,
          url: finalUrl,
          note: "pays/ville déduits côté extraction",
        });
      }

      const { data: existingListings, error: existingListingsError } = await supabase
        .from("listings")
        .select("id, source_url")
        .eq("workspace_id", effectiveWorkspaceId)
        .is("deleted_at", null);

      if (existingListingsError) {
        throw new Error(
          existingListingsError.message ||
            copy.existingListingsCheckError
        );
      }

      const existingListing = (existingListings ?? []).find(
        (listing) => normalizeSourceUrl(listing.source_url) === normalizedUrl
      );

      let listingRow = existingListing ?? null;

      if (!listingRow) {
        const { data: createdListing, error: listingError } = await supabase
          .from("listings")
          .insert({
            workspace_id: effectiveWorkspaceId,
            created_by: user.id,
            source_platform: platform,
            source_url: finalUrl,
            title: copy.untitledListing,
            market_country_override: null,
            market_city_override: null,
          })
          .select("id, source_url")
          .single();

        if (listingError || !createdListing) {
          throw new Error(listingError?.message || copy.listingCreationFailed);
        }

        listingRow = createdListing;
      } else {
        const { error: geoUpdateError } = await supabase
          .from("listings")
          .update({
            source_url: finalUrl,
          })
          .eq("id", listingRow.id)
          .eq("workspace_id", effectiveWorkspaceId);

        if (geoUpdateError) {
          throw new Error(
            geoUpdateError.message || copy.updateListingUrlError
          );
        }
      }

      if (process.env.NODE_ENV === "development") {
        const { data: geoCheckRow } = await supabase
          .from("listings")
          .select("id, market_country_override, market_city_override")
          .eq("id", listingRow.id)
          .eq("workspace_id", effectiveWorkspaceId)
          .maybeSingle();
        console.log(
          "[listing-new][geo-overrides-db-check]",
          JSON.stringify({
            id: geoCheckRow?.id ?? null,
            market_country_override: geoCheckRow?.market_country_override ?? null,
            market_city_override: geoCheckRow?.market_city_override ?? null,
          })
        );
      }

      try {
        const plan = await getWorkspacePlan(effectiveWorkspaceId, supabase);
        setPlanCode(plan.planCode);
      } catch {
        setPlanCode(null);
      }

      const sk = activeAuditKey(effectiveWorkspaceId);
      const existingRaw = sessionStorage.getItem(sk);

      if (existingRaw) {
        try {
          const ex = JSON.parse(existingRaw) as ActiveAuditPending;
          if (ex.workspaceId === effectiveWorkspaceId && ex.listingId !== listingRow.id) {
            setError(
              copy.auditAlreadyRunningOtherListing
            );
            setIsSubmitting(false);
            setResumeAuditUi(false);
            return;
          }
          if (
            ex.workspaceId === effectiveWorkspaceId &&
            ex.listingId === listingRow.id &&
            Date.now() - ex.startedAt < AUDIT_STALE_MS
          ) {
            setResumeAuditUi(true);
            setIsSubmitting(true);
            armGlobalAuditPoll(effectiveWorkspaceId, {
              onFound: (id) => pollHandlersRef.current.onFound(id),
              onStale: () => pollHandlersRef.current.onStale(),
            });
            return;
          }
        } catch {
          sessionStorage.removeItem(sk);
        }
      }

      const pendingPayload: ActiveAuditPending = {
        listingId: listingRow.id as string,
        workspaceId: effectiveWorkspaceId,
        startedAt: Date.now(),
      };
      sessionStorage.setItem(sk, JSON.stringify(pendingPayload));
      auditPendingWorkspace = effectiveWorkspaceId;
      setResumeAuditUi(false);
      armGlobalAuditPoll(effectiveWorkspaceId, {
        onFound: (id) => pollHandlersRef.current.onFound(id),
        onStale: () => pollHandlersRef.current.onStale(),
      });

      const auditResult = await runAuditForListing(listingRow.id as string, {
        propertyTypeOverride: propertyTypeOverride.trim(),
      });

      disarmGlobalAuditPoll();
      sessionStorage.removeItem(sk);
      auditPendingWorkspace = null;

      if (!auditResult.success) {
        if (auditResult.code === "booking_extraction_unavailable") {
          setBookingExtractionUnavailable(true);
          setError(null);
          setIsQuotaError(false);
        } else if (auditResult.code === "quota_exceeded") {
          setBookingExtractionUnavailable(false);
          setError(auditResult.message);
          setIsQuotaError(true);
        } else {
          setBookingExtractionUnavailable(false);
          setError(auditResult.message);
          setIsQuotaError(false);
        }
        setIsSubmitting(false);
        setResumeAuditUi(false);
        return;
      }

      if (auditResult.auditId) {
        sessionStorage.setItem(
          auditRedirectKey(effectiveWorkspaceId),
          JSON.stringify({ auditId: auditResult.auditId, ts: Date.now() })
        );
        if (pathname === "/dashboard/listings/new") {
          setTimeout(() => {
            sessionStorage.removeItem(auditRedirectKey(effectiveWorkspaceId));
            router.push(`/dashboard/audits/${auditResult.auditId}`);
          }, 350);
        }
        setIsSubmitting(false);
        setResumeAuditUi(false);
      } else {
        setIsSubmitting(false);
        setResumeAuditUi(false);
        router.push("/dashboard/listings");
      }
    } catch (err) {
      disarmGlobalAuditPoll();
      if (auditPendingWorkspace) {
        sessionStorage.removeItem(activeAuditKey(auditPendingWorkspace));
      }
      setError(
        err instanceof Error ? err.message : copy.unknownError
      );
      setIsQuotaError(false);
      setBookingExtractionUnavailable(false);
      setIsSubmitting(false);
      setResumeAuditUi(false);
    }
  }

  console.log("[NEW AUDIT PAGE DEBUG]", {
    workspaceId: null,
    planCode,
    auditCount: null,
    canCreateAudit: null,
    upgradeCTA: isQuotaError ? "upgrade" : "launch",
  });

  return (
    <div className="space-y-4 md:space-y-5 text-sm">
      <div className="relative overflow-hidden rounded-[32px] nk-border nk-card-lg nk-page-header-card bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] px-6 py-5 md:flex md:items-center md:justify-between md:gap-10 md:px-8 backdrop-blur-[4px] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
        <div className="max-w-3xl space-y-2">
          <p className="nk-kicker-muted">{copy.newAudit}</p>
          <h1 className="nk-page-title nk-page-title-dashboard">
            {copy.addListing}
          </h1>
          <p className="nk-page-subtitle nk-page-subtitle-dashboard nk-body-muted text-sm leading-6 text-slate-600">
            {copy.addListingSubtitle} {copy.headerSubtitleSuffix}
          </p>
        </div>
      </div>

      <div className="relative">
      {isSubmitting && (
        <AuditLaunchOverlay
          currentStep={currentStep}
          steps={[...loadingSteps]}
          stepIndex={stepIndex}
          statusHint={rotatingHint}
          isAuditLoading={isSubmitting}
          leadTitle={copy.auditStillRunning}
          leadSubtitle={copy.resumeAuditLeadSubtitle}
          backgroundNote={
            resumeAuditUi
              ? copy.continueBackground
              : copy.keepScreenActive
          }
          stepLabel={(current, total) => `${current}/${total}`}
        />
      )}

      <div className={isSubmitting ? "pointer-events-none opacity-50" : ""}>
        <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.3fr)_340px]">
          <div className="nk-card nk-card-hover p-4 md:p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
            <p className="nk-section-title text-slate-900">{copy.listingSettings}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {copy.formIntro}
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">
                  {copy.listingUrl}{" "}
                  <span className="font-normal text-slate-500">{copy.requiredLabel}</span>
                </label>
                <input
                  value={url}
                  onChange={(e) => {
                    const nextUrl = e.target.value;
                    setUrl(nextUrl);
                    const detectedPlatform = detectPlatformFromInput(nextUrl);
                    if (detectedPlatform) {
                      setPlatform(detectedPlatform);
                    }
                  }}
                  type="url"
                  placeholder={copy.listingUrlPlaceholder}
                  className={`nk-form-field rounded-xl transition-shadow ${
                    invalidFields.url
                      ? "ring-2 ring-amber-400/85 ring-offset-2 ring-offset-white"
                      : ""
                  } min-h-10 px-3.5 py-2 text-sm`}
                />
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {copy.locationDetectedFromListing}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    {copy.propertyType}{" "}
                    <span className="font-normal text-slate-500">{copy.requiredLabel}</span>
                  </label>
                  <select
                    value={propertyTypeOverride}
                    onChange={(e) => setPropertyTypeOverride(e.target.value)}
                    disabled={isSubmitting}
                    required
                    className={`nk-form-select rounded-xl ${
                      invalidFields.propertyType
                        ? "ring-2 ring-amber-400/85 ring-offset-2 ring-offset-white"
                        : ""
                    } min-h-10 px-3.5 py-2 text-sm`}
                  >
                    {PROPERTY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value || "auto"} value={opt.value}>
                        {opt.value === "" ? copy.propertyTypePlaceholder : opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {copy.propertyTypeHelp}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    {copy.platform}{" "}
                    <span className="font-normal text-slate-500">{copy.requiredLabel}</span>
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className={`nk-form-select rounded-xl transition-shadow ${
                      invalidFields.platform
                        ? "ring-2 ring-amber-400/85 ring-offset-2 ring-offset-white"
                        : ""
                    } min-h-10 px-3.5 py-2 text-sm`}
                  >
                    <option value="airbnb">Airbnb</option>
                    <option value="booking">Booking</option>
                    <option value="agoda">Agoda</option>
                    <option value="vrbo">VRBO — admin test</option>
                    <option value="expedia">Expedia — admin test</option>
                  </select>
                </div>
              </div>

              <div
                className={`grid gap-3 sm:grid-cols-2 ${
                  invalidFields.dates
                    ? "rounded-xl p-0.5 ring-2 ring-amber-400/80 ring-offset-1 ring-offset-white"
                    : ""
                }`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => openNativeDatePicker(stayCheckInRef)}
                >
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    {copy.checkinDate}{" "}
                    <span className="font-normal text-slate-500">{copy.requiredLabel}</span>
                  </label>
                  <input
                    ref={stayCheckInRef}
                    value={stayCheckIn}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStayCheckIn(v);
                      setStayCheckOut((prev) => {
                        const p = prev.trim();
                        if (!v || !p) return prev;
                        const minOut = addDaysToIsoDate(v, 1);
                        if (p < minOut) return "";
                        return prev;
                      });
                    }}
                    type="date"
                    min={minStayCheckInIso}
                    disabled={isSubmitting}
                    onFocus={() => openNativeDatePicker(stayCheckInRef)}
                    className="nk-form-field min-h-10 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div
                  className="cursor-pointer"
                  onClick={() => openNativeDatePicker(stayCheckOutRef)}
                >
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    {copy.checkoutDate}{" "}
                    <span className="font-normal text-slate-500">{copy.requiredLabel}</span>
                  </label>
                  <input
                    ref={stayCheckOutRef}
                    value={stayCheckOut}
                    onChange={(e) => {
                      const v = e.target.value;
                      const cin = stayCheckIn.trim();
                      const minOut = cin
                        ? addDaysToIsoDate(cin, 1)
                        : addDaysToIsoDate(minStayCheckInIso, 1);
                      if (v && v < minOut) return;
                      setStayCheckOut(v);
                    }}
                    type="date"
                    min={minStayCheckOutIso}
                    disabled={isSubmitting}
                    onFocus={() => openNativeDatePicker(stayCheckOutRef)}
                    className="nk-form-field min-h-10 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500">
                {copy.availableDatesHelp}
              </p>
              <p className="mt-0.5 flex gap-2 text-[10px] leading-snug text-amber-900/90">
                <span
                  className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-amber-400/80 bg-amber-50 text-[9px] font-bold text-amber-700"
                  aria-hidden
                >
                  !
                </span>
                <span>
                  <span className="font-semibold">{copy.important}</span> {copy.respectMinimumNights}
                  {" "}{copy.minimumNightsPriceHint}
                </span>
              </p>

              {SHOW_ADVANCED_MARKET_SETTINGS ? (
              <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,250,252,0.93)_100%)] px-3.5 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.68)_inset] md:px-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-800">
                    Paramètres avancés du marché
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Optionnel — aide l’audit à mieux cibler les comparables dès le départ.
                  </p>
                </div>

                <div className="mt-3.5 grid gap-3.5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                  <div className="flex h-full flex-col">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                        Profil du bien
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          {
                            label: "Chambres",
                            value: advancedBedrooms,
                            setter: setAdvancedBedrooms,
                            options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"],
                          },
                          {
                            label: "Salles de bain",
                            value: advancedBathrooms,
                            setter: setAdvancedBathrooms,
                            options: ["1", "2", "3", "4", "5", "6", "7", "8+"],
                          },
                          {
                            label: "Voyageurs",
                            value: advancedGuests,
                            setter: setAdvancedGuests,
                            options: ["2", "4", "6", "8", "10", "12", "14", "16", "20+"],
                          },
                          {
                            label: "Lits",
                            value: advancedBeds,
                            setter: setAdvancedBeds,
                            options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"],
                          },
                          {
                            label: copy.minimumStayNights,
                            value: advancedMinStay,
                            setter: setAdvancedMinStay,
                            options: ["1", "2", "3", "5", "7", "14"],
                          },
                        ].map(({ label, value, setter, options }) => (
                          <div key={label}>
                            <label className="mb-1 block text-[10px] font-medium text-slate-600">
                              {label}
                            </label>
                            <select
                              value={value}
                              onChange={(e) => setter(e.target.value)}
                              disabled={isSubmitting}
                              className="nk-form-select min-h-9 rounded-xl px-2.5 py-1.5 text-[11px]"
                            >
                              <option value="">—</option>
                              {options.map((option) => (
                                <option key={option} value={option}>
                                  {label === copy.minimumStayNights && !option.includes("+")
                                    ? `${option} nuit${option === "1" ? "" : "s"}`
                                    : option}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                        Positionnement marché
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ADVANCED_MARKET_TIER_OPTIONS.map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setAdvancedMarketTier((current) => (current === value ? "" : value))
                            }
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.04em] transition ${
                              advancedMarketTier === value
                                ? "border-blue-500/60 bg-blue-50 text-blue-700 shadow-sm"
                                : "border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Signaux différenciants
                    </p>
                    <p className="mt-0.5 text-[9px] text-slate-500">
                      Les équipements servent de signaux de pondération, pas de filtres stricts.
                    </p>
                    <div className="mt-2 grid gap-x-2.5 gap-y-1.5 sm:grid-cols-2">
                      {ADVANCED_SIGNAL_OPTIONS.map(({ value, label }) => (
                        <label
                          key={value}
                          className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-1.5 text-[10px] text-slate-600 transition hover:border-slate-300 hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={advancedSignals.includes(value)}
                            onChange={(e) => {
                              setAdvancedSignals((current) =>
                                e.target.checked
                                  ? [...current, value]
                                  : current.filter((item) => item !== value)
                              );
                            }}
                            disabled={isSubmitting}
                            className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-400/50"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              ) : null}

              {formGateError ? (
                <div
                  className="rounded-2xl border border-amber-300/90 bg-gradient-to-b from-amber-50/98 to-amber-50/80 px-4 py-3.5 text-sm text-amber-950 shadow-[0_10px_28px_rgba(217,119,6,0.12)] ring-1 ring-amber-200/70"
                  role="alert"
                >
                  <p className="font-semibold leading-snug">{formGateError}</p>
                      {formGateMissingLabels.length > 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-amber-900/95">
                      {copy.missingFieldsLabel}{" "}
                      {formGateMissingLabels
                        .map((s) => (s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s))
                        .join(", ")}
                      .
                    </p>
                  ) : null}
                  {formGateDateOrder && formGateMissingLabels.length > 0 ? (
                    <p className="mt-2 text-xs font-medium text-amber-900">
                      {copy.checkoutAfterCheckin}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {(error || bookingExtractionUnavailable) && (
                <div
                  className={
                    isQuotaError
                      ? "rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-700"
                      : bookingExtractionUnavailable
                        ? "rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/98 to-amber-50/85 px-4 py-3.5 text-sm text-amber-950 shadow-[0_10px_28px_rgba(217,119,6,0.10)] ring-1 ring-amber-200/60"
                        : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  }
                >
                  {!isQuotaError && bookingExtractionUnavailable ? (
                    <div className="space-y-2" role="alert">
                      <p className="font-semibold text-amber-950">
                        {copy.bookingUnavailableTitle}
                      </p>
                      <p className="leading-relaxed text-amber-900/95">
                        {copy.bookingUnavailableText}
                      </p>
                      <p className="text-xs font-medium text-amber-800/90">
                        {copy.bookingUnavailableBalance}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingExtractionUnavailable(false);
                          setError(null);
                        }}
                        className="mt-1 inline-flex items-center justify-center rounded-xl border border-amber-300/80 bg-white/90 px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                      >
                        {copy.retry}
                      </button>
                    </div>
                  ) : !isQuotaError ? (
                    <p>{error}</p>
                  ) : (
                    <div className="rounded-2xl border border-blue-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.95)_55%,rgba(238,242,255,0.92)_100%)] px-4 py-4 text-slate-800 shadow-[0_12px_28px_rgba(59,130,246,0.13)] ring-1 ring-white/75">
                      <p className="text-sm font-semibold text-slate-950">
                        {copy.quotaUpsellTitle}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {copy.quotaUpsellText}
                      </p>

                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                        <div className="relative overflow-hidden rounded-xl border border-blue-200/80 bg-blue-50/75 px-3 py-2.5">
                          <span className="absolute inset-x-0 top-0 h-0.5 bg-blue-400/80" />
                          <p className="font-semibold text-slate-900">{copy.starterPackTitle}</p>
                          <p className="mt-1 text-slate-600">{copy.starterPackSubtitle}</p>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-indigo-200/85 bg-indigo-50/85 px-3 py-2.5 shadow-[0_8px_18px_rgba(99,102,241,0.12)] ring-1 ring-indigo-100/70">
                          <span className="absolute inset-x-0 top-0 h-0.5 bg-indigo-400/85" />
                          <p className="font-semibold text-slate-900">{copy.proPackTitle}</p>
                          <p className="mt-1 text-slate-600">{copy.proPackSubtitle}</p>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-cyan-200/80 bg-cyan-50/75 px-3 py-2.5">
                          <span className="absolute inset-x-0 top-0 h-0.5 bg-cyan-400/80" />
                          <p className="font-semibold text-slate-900">{copy.scalePackTitle}</p>
                          <p className="mt-1 text-slate-600">{copy.scalePackSubtitle}</p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <Link
                          href="/dashboard/billing"
                          className="inline-flex items-center justify-center rounded-xl border !border-blue-500/85 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_52%,#7c3aed_100%)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white !shadow-[0_14px_32px_rgba(59,130,246,0.32)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
                        >
                          {copy.viewOffersCta}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                  {copy.quickTipsTitle}
                </p>
                <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-slate-600">
                  <li>• {copy.quickTipsPasteUrl}</li>
                  <li>• {copy.useAvailableDates}</li>
                  <li>• {copy.advancedSettingsOptional}</li>
                </ul>
              </div>

              <div className="flex flex-col items-start gap-1.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || isQuotaError}
                  className="inline-flex items-center justify-center rounded-xl border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? copy.analysisRunning : copy.launchAudit}
                </button>

                <span className="text-[10px] text-slate-500">
                  {copy.automaticAudit}
                </span>
              </div>
            </form>
          </div>

          <div className="space-y-3.5">
            <div className="nk-card-accent nk-card-accent-purple nk-card-hover flex h-full flex-col p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.62)_inset]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="nk-section-title mb-0 text-slate-900">{copy.auditConsiders}</p>
                <span className="inline-flex items-center rounded-full border border-violet-200/90 bg-violet-50/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-800">
                  {copy.automaticAnalysisBadge}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                {copy.rightColumnDescription}
              </p>

              <ul className="mt-3.5 space-y-2.5 text-[13px] text-slate-800">
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>{copy.auditConsidersLocation}</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>{copy.auditConsidersComparables}</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>{copy.auditConsidersPrice}</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>{copy.auditConsidersAnalysis}</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>{copy.auditConsidersRecommendations}</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
