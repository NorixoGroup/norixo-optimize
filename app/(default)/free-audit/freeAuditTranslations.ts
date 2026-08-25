import type {
  FreeAuditMarketOverviewLimitationCode,
  FreeAuditMarketOverviewRecommendationCode,
} from "@/lib/freeAudit/publicPricingPreviewContract";
import { defaultLocale, type Locale } from "@/data/i18n";

type FreeAuditTranslation = Readonly<{
  hero: Readonly<{
    eyebrow: string;
    title: string;
    subtitle: string;
    reassurance: string;
  }>;
  form: Readonly<{
    title: string;
    text: string;
    listingUrlLabel: string;
    listingUrlPlaceholder: string;
    countryLabel: string;
    countryPlaceholder: string;
    cityLabel: string;
    cityPlaceholder: string;
    platformLabel: string;
    platformPlaceholder: string;
    propertyTypeLabel: string;
    propertyTypePlaceholder: string;
    submitIdle: string;
    submitLoading: string;
    helper: string;
    statusLoading: string;
  }>;
  options: Readonly<{
    platform: Readonly<Record<"airbnb" | "booking" | "expedia" | "agoda" | "vrbo", string>>;
    propertyType: Readonly<
      Record<"studio" | "apartment" | "villa" | "riad" | "room" | "hotel", string>
    >;
  }>;
  errors: Readonly<{
    listing_url_invalid: string;
    country_required: string;
    city_required: string;
    platform_required: string;
    property_type_required: string;
    invalid_request: string;
    rate_limited: string;
    unavailable: string;
    network_error: string;
    unknown_error: string;
  }>;
  result: Readonly<{
    title: string;
    text: string;
    initialTitle: string;
    initialText: string;
    initialGuideTitle: string;
    initialGuideItems: readonly Readonly<{
      title: string;
      text: string;
    }>[];
    initialPrompt: string;
    submittingTitle: string;
    submittingText: string;
    benchmarkRange: string;
    medianPrice: string;
    marketTitle: string;
    marketScopeAllPlatforms: string;
    confidenceTitle: string;
    recommendationsTitle: string;
    limitationsTitle: string;
    insufficientTitle: string;
    insufficientText: string;
    unavailableTitle: string;
    confidenceLevel: Readonly<Record<"standard" | "high", string>>;
    sampleBand: Readonly<Record<"sufficient" | "strong", string>>;
    limitationCodes: Readonly<Record<FreeAuditMarketOverviewLimitationCode, string>>;
    recommendationCodes: Readonly<Record<FreeAuditMarketOverviewRecommendationCode, string>>;
  }>;
  premium: Readonly<{
    rangeLabel: string;
    marketMedianLabel: string;
    marketNowTitle: string;
    lowPriceLabel: string;
    medianPriceLabel: string;
    highPriceLabel: string;
    compareToMarketCta: string;
    revealTitle: string;
    revealSubtitle: string;
    revealCards: readonly Readonly<{
      title: string;
      text: string;
    }>[];
    journeyTitle: string;
    journeySteps: readonly Readonly<{
      title: string;
      text: string;
    }>[];
    unlockCta: string;
  }>;
  clarity: Readonly<{
    title: string;
    cards: readonly Readonly<{
      title: string;
      text: string;
      items: readonly string[];
    }>[];
  }>;
  compare: Readonly<{
    title: string;
    freeTitle: string;
    fullTitle: string;
    freeItems: readonly string[];
    fullItems: readonly string[];
  }>;
  faq: Readonly<{
    title: string;
    items: readonly Readonly<{
      question: string;
      answer: string;
    }>[];
  }>;
  cta: Readonly<{
    title: string;
    text: string;
    primary: string;
    secondary: string;
    reassurance: string;
  }>;
  seo: Readonly<{
    title: string;
    description: string;
  }>;
}>;

export const freeAuditTranslations = {
  en: {
    hero: {
      eyebrow: "Free market snapshot",
      title: "Discover a market-only pricing snapshot",
      subtitle:
        "Norixo's free market snapshot for Airbnb and Booking listings shows the observed market range and median for your listing category before a full listing audit.",
      reassurance:
        "No credit card. No data extraction. No listing content or personal price is reviewed at this stage.",
    },
    form: {
      title: "Structured market preview",
      text:
        "Fill in the structured details below to receive a market-only benchmark preview.",
      listingUrlLabel: "Listing URL (optional — not analyzed or sent)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Country",
      countryPlaceholder: "France",
      cityLabel: "City",
      cityPlaceholder: "Paris",
      platformLabel: "Platform",
      platformPlaceholder: "Select a platform",
      propertyTypeLabel: "Property type",
      propertyTypePlaceholder: "Select a property type",
      submitIdle: "View my market snapshot",
      submitLoading: "Market analysis...",
      helper:
        "The URL stays local to your browser and is never sent to the preview API.",
      statusLoading: "Market preview in progress.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Studio",
        apartment: "Apartment",
        villa: "Villa",
        riad: "Riad",
        room: "Room",
        hotel: "Hotel",
      },
    },
    errors: {
      listing_url_invalid: "Enter a valid listing URL from a supported platform.",
      country_required: "Enter your country.",
      city_required: "Enter your city.",
      platform_required: "Select a platform.",
      property_type_required: "Select a property type.",
      invalid_request: "Some information needs to be corrected.",
      rate_limited: "You have made several requests. Please try again in a few minutes.",
      unavailable: "The free preview is temporarily unavailable.",
      network_error: "Unable to load the preview right now.",
      unknown_error: "Unable to load the preview right now.",
    },
    result: {
      title: "Market pricing overview",
      text:
        "Result based only on the aggregated market data currently available for this category.",
      initialTitle: "Your preview will appear here.",
      initialText:
        "Norixo will show the observed market range and median available for your market.",
      initialGuideTitle: "What you will discover",
      initialGuideItems: [
        {
          title: "Observed range",
          text: "Discover the low and high prices currently available for this market.",
        },
        {
          title: "Market median",
          text: "See the central price level observed for this category.",
        },
        {
          title: "Confidence level",
          text: "Understand how solid the available market data is.",
        },
      ],
      initialPrompt:
        "Complete the form to display the preview currently available for this market.",
      submittingTitle: "Preparing your market preview",
      submittingText:
        "Norixo is assembling the aggregated market signals currently available for this category.",
      benchmarkRange: "Observed range",
      medianPrice: "Median",
      marketTitle: "Market snapshot",
      marketScopeAllPlatforms: "All platforms",
      confidenceTitle: "Confidence",
      recommendationsTitle: "Recommendations",
      limitationsTitle: "What to know",
      insufficientTitle: "Coverage is still limited",
      insufficientText:
        "We do not yet have enough aggregated market data for this request.",
      unavailableTitle: "Preview unavailable",
      confidenceLevel: {
        standard: "Standard confidence",
        high: "High confidence",
      },
      sampleBand: {
        sufficient: "Sufficient sample",
        strong: "Strong sample",
      },
      limitationCodes: {
        market_only: "No listing price or content was analyzed.",
        aggregated_market_data: "Results are based on aggregated market data.",
        listing_specific_factors:
          "Property details, seasonality, and precise location can strongly influence the right price.",
        broad_market_segment:
          "The available benchmark covers a broader market segment than your initial request.",
        all_capacities_scope:
          "The preview aggregates all guest capacities in this market segment.",
        multi_platform_scope:
          "This preview combines aggregated data from multiple booking platforms.",
        limited_sample_size:
          "The current sample is still limited for this market segment.",
        limited_source_diversity:
          "The current sample comes from a limited set of market sources.",
        aging_data:
          "Some aggregated market data is starting to age.",
        multi_currency_market:
          "Several competing currencies exist in this market and prevent an honest preview without extra context.",
      },
      recommendationCodes: {
        median_positions_market:
          "The observed median helps position the central level of this market.",
        broader_segment_used:
          "The preview relies on a broader market segment than the exact type requested.",
        listing_specific_factors_matter:
          "Photos, amenities, seasonality, and location can materially shift the right price.",
        full_audit_for_positioning:
          "A full audit will analyze your listing and real competitors to determine your exact positioning.",
      },
    },
    premium: {
      rangeLabel: "Observed range",
      marketMedianLabel: "Market median",
      marketNowTitle: "Current market",
      lowPriceLabel: "Low price",
      medianPriceLabel: "Median price",
      highPriceLabel: "High price",
      compareToMarketCta: "Compare my listing to this market",
      revealTitle: "What your full audit will reveal",
      revealSubtitle:
        "The free preview shows the market. The full audit analyzes your actual listing.",
      revealCards: [
        {
          title: "Your real position",
          text:
            "Compare your listing to competitors in your market and identify your exact positioning.",
        },
        {
          title: "Your pricing potential",
          text:
            "Discover price levels adapted to your property, your season and your competitive environment.",
        },
        {
          title: "Your conversion levers",
          text:
            "Analyze your title, description, photos, amenities and the elements slowing bookings down.",
        },
        {
          title: "Your priority actions",
          text:
            "Receive a clear action plan ranked by likely impact on your performance.",
        },
      ],
      journeyTitle: "Your journey with Norixo",
      journeySteps: [
        {
          title: "Free market preview",
          text: "Discover the observed range and the market median.",
        },
        {
          title: "Complete listing analysis",
          text:
            "Norixo analyzes your content, competitors and positioning.",
        },
        {
          title: "Personalized action plan",
          text: "Receive concrete prioritized recommendations.",
        },
      ],
      unlockCta: "Unlock my full audit",
    },
    clarity: {
      title: "Free market snapshot clarity",
      cards: [
        {
          title: "What you get for free",
          text: "This stage is a public market preview, not a personalized listing audit.",
          items: [
            "Observed market range for your category",
            "Market median and confidence level",
            "Coverage and limitation signals for this market",
          ],
        },
        {
          title: "What is not analyzed yet",
          text: "Norixo does not inspect your private listing content before the full audit starts.",
          items: [
            "No title, description, photo or amenity review",
            "No private listing price analysis",
            "No full competitor diagnosis or action plan yet",
          ],
        },
        {
          title: "Why these results are credible",
          text: "The preview relies on public benchmark evidence selected for your market through Norixo's market intelligence rules.",
          items: [
            "Aggregated and anonymized market data only",
            "No private user data published or reused publicly",
            "Coverage can vary by city, platform and property type",
          ],
        },
        {
          title: "Why create an account next",
          text: "An account lets Norixo securely continue from this preview to the full audit workflow.",
          items: [
            "Save your handoff context",
            "Launch the full listing audit from the dashboard",
            "Recover access to your audits and purchases later",
          ],
        },
      ],
    },
    compare: {
      title: "Free preview vs full audit",
      freeTitle: "Free market preview",
      fullTitle: "Full audit",
      freeItems: [
        "Aggregated market price range",
        "Market median",
        "Confidence level",
        "General recommendations",
        "No listing content reviewed",
      ],
      fullItems: [
        "Real listing analysis",
        "Title and description",
        "Photos and amenities",
        "Real competitors",
        "Conversion opportunities",
        "Personalized recommendations",
        "Complete pricing analysis",
        "Occupancy analysis when available",
      ],
    },
    faq: {
      title: "Frequently asked questions",
      items: [
        {
          question: "Is the free preview really free?",
          answer:
            "Yes. The market preview does not require a card and does not consume a paid audit credit.",
        },
        {
          question: "Does Norixo connect to my Airbnb or Booking account?",
          answer:
            "No. The free preview uses structured market inputs only and does not require any account connection.",
        },
        {
          question: "Is my listing extracted during the free preview?",
          answer:
            "No. At this stage Norixo does not run a full listing extraction and does not review your listing content.",
        },
        {
          question: "Where does the preview data come from?",
          answer:
            "The preview is built from aggregated public market benchmark evidence selected for the requested market segment.",
        },
        {
          question: "Why is the full audit paid?",
          answer:
            "The paid audit goes beyond the public benchmark and analyzes your real listing, its content, its positioning and its priority actions.",
        },
        {
          question: "What happens if market coverage is still limited?",
          answer:
            "Norixo shows the market as insufficiently covered instead of pretending to have a precise answer when public benchmark evidence is still too thin.",
        },
      ],
    },
    cta: {
      title: "Ready to unlock the full audit?",
      text: "Move from a market snapshot to the complete Norixo listing audit.",
      primary: "Unlock the full audit",
      secondary: "Start from your real listing",
      reassurance: "Get your exact positioning and personalized recommendations.",
    },
    seo: {
      title: "Free Airbnb market snapshot: compare prices in your market | Norixo",
      description:
        "Check your market price range and median for free using aggregated data, with no data extraction and no credit card.",
    },
  },
  fr: {
    hero: {
      eyebrow: "Apercu gratuit du marche",
      title: "Decouvrez un apercu tarifaire du marche",
      subtitle:
        "L'apercu gratuit du marche de Norixo pour les annonces Airbnb et Booking montre la fourchette observee et la mediane de votre categorie avant un audit complet de l'annonce.",
      reassurance:
        "Aucune carte bancaire. Aucune extraction de donnees. Aucun contenu ni prix personnel de votre annonce n'est consulte.",
    },
    form: {
      title: "Apercu du marche",
      text:
        "Renseignez les informations structurees ci-dessous pour recevoir un apercu fonde uniquement sur les benchmarks agreges du marche.",
      listingUrlLabel: "URL de l'annonce (facultative — non analysee ni envoyee)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Pays",
      countryPlaceholder: "France",
      cityLabel: "Ville",
      cityPlaceholder: "Paris",
      platformLabel: "Plateforme",
      platformPlaceholder: "Selectionnez une plateforme",
      propertyTypeLabel: "Type de logement",
      propertyTypePlaceholder: "Selectionnez un type de logement",
      submitIdle: "Voir mon apercu du marche",
      submitLoading: "Analyse du marche...",
      helper:
        "L'URL reste locale a votre navigateur et n'est jamais envoyee a l'API d'apercu.",
      statusLoading: "Analyse du marche en cours.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Studio",
        apartment: "Appartement",
        villa: "Villa",
        riad: "Riad",
        room: "Chambre",
        hotel: "Hotel",
      },
    },
    errors: {
      listing_url_invalid: "Indiquez une URL valide sur une plateforme prise en charge.",
      country_required: "Indiquez votre pays.",
      city_required: "Indiquez votre ville.",
      platform_required: "Selectionnez une plateforme.",
      property_type_required: "Selectionnez un type de logement.",
      invalid_request: "Certaines informations doivent etre corrigees.",
      rate_limited:
        "Vous avez effectue plusieurs demandes. Reessayez dans quelques minutes.",
      unavailable: "L'apercu gratuit est temporairement indisponible.",
      network_error: "Impossible de charger l'apercu pour le moment.",
      unknown_error: "Impossible de charger l'apercu pour le moment.",
    },
    result: {
      title: "Apercu tarifaire du marche",
      text:
        "Resultat fonde uniquement sur les donnees de marche agregees disponibles pour cette categorie.",
      initialTitle: "Votre apercu apparaitra ici.",
      initialText:
        "Norixo affichera la fourchette observee et la mediane disponibles pour votre marche.",
      initialGuideTitle: "Ce que vous decouvrirez",
      initialGuideItems: [
        {
          title: "Fourchette observee",
          text: "Decouvrez les prix bas et hauts disponibles pour ce marche.",
        },
        {
          title: "Mediane du marche",
          text: "Visualisez le niveau central observe sur cette categorie.",
        },
        {
          title: "Niveau de confiance",
          text: "Comprenez la solidite des donnees actuellement disponibles.",
        },
      ],
      initialPrompt:
        "Completez le formulaire pour afficher l'apercu disponible pour ce marche.",
      submittingTitle: "Preparation de votre apercu marche",
      submittingText:
        "Norixo assemble les signaux de marche agreges disponibles pour cette categorie.",
      benchmarkRange: "Fourchette observee",
      medianPrice: "Mediane",
      marketTitle: "Instantane du marche",
      marketScopeAllPlatforms: "Toutes plateformes",
      confidenceTitle: "Confiance",
      recommendationsTitle: "Recommandations",
      limitationsTitle: "A savoir",
      insufficientTitle: "Couverture encore insuffisante",
      insufficientText:
        "Nous ne disposons pas encore d'un volume suffisant de donnees agregees pour cette demande.",
      unavailableTitle: "Apercu indisponible",
      confidenceLevel: {
        standard: "Confiance standard",
        high: "Confiance elevee",
      },
      sampleBand: {
        sufficient: "Echantillon suffisant",
        strong: "Echantillon solide",
      },
      limitationCodes: {
        market_only: "Aucun prix ni contenu de votre annonce n'a ete analyse.",
        aggregated_market_data:
          "Les resultats reposent sur des donnees de marche agregees.",
        listing_specific_factors:
          "Les caracteristiques du logement, la saison et l'emplacement precis peuvent fortement modifier le tarif adapte.",
        broad_market_segment:
          "Le benchmark disponible couvre un segment de marche plus large que la demande initiale.",
        all_capacities_scope:
          "L'apercu agrege toutes les capacites d'accueil dans ce segment de marche.",
        multi_platform_scope:
          "Cet apercu regroupe des donnees agregees issues de plusieurs plateformes de reservation.",
        limited_sample_size:
          "L'echantillon reste encore limite pour ce segment de marche.",
        limited_source_diversity:
          "La diversite des sources reste encore limitee pour ce segment de marche.",
        aging_data:
          "Une partie des donnees agregees commence a vieillir.",
        multi_currency_market:
          "Plusieurs devises concurrentes existent sur ce marche et ne permettent pas un apercu fiable sans contexte supplementaire.",
      },
      recommendationCodes: {
        median_positions_market:
          "La mediane observee permet de situer le niveau central de ce marche.",
        broader_segment_used:
          "Le segment utilise couvre un marche plus large que le type demande.",
        listing_specific_factors_matter:
          "Les photos, les equipements, la saisonnalite et l'emplacement peuvent fortement faire varier le bon prix.",
        full_audit_for_positioning:
          "L'audit complet analysera votre annonce et vos concurrents reels pour determiner votre positionnement exact.",
      },
    },
    premium: {
      rangeLabel: "Fourchette observee",
      marketMedianLabel: "Mediane marche",
      marketNowTitle: "Marche actuel",
      lowPriceLabel: "Prix bas",
      medianPriceLabel: "Prix median",
      highPriceLabel: "Prix haut",
      compareToMarketCta: "Comparer mon annonce a ce marche",
      revealTitle: "Ce que votre audit complet va reveler",
      revealSubtitle:
        "L'apercu gratuit vous montre le marche. L'audit complet analyse reellement votre annonce.",
      revealCards: [
        {
          title: "Votre position reelle",
          text:
            "Comparez votre annonce aux concurrents de votre marche et identifiez votre positionnement exact.",
        },
        {
          title: "Votre potentiel tarifaire",
          text:
            "Decouvrez les niveaux de prix adaptes a votre logement, a votre saison et a votre environnement concurrentiel.",
        },
        {
          title: "Vos leviers de conversion",
          text:
            "Analysez votre titre, votre description, vos photos, vos equipements et les elements qui freinent les reservations.",
        },
        {
          title: "Vos actions prioritaires",
          text:
            "Recevez un plan d'action clair, classe selon l'impact potentiel sur vos performances.",
        },
      ],
      journeyTitle: "Votre parcours avec Norixo",
      journeySteps: [
        {
          title: "Apercu marche gratuit",
          text: "Decouvrez la fourchette et la mediane du marche.",
        },
        {
          title: "Analyse complete de l'annonce",
          text:
            "Norixo analyse votre contenu, vos concurrents et votre positionnement.",
        },
        {
          title: "Plan d'action personnalise",
          text: "Recevez des recommandations concretes et prioritaires.",
        },
      ],
      unlockCta: "Debloquer mon audit complet",
    },
    clarity: {
      title: "Comprendre l'apercu gratuit",
      cards: [
        {
          title: "Ce que vous obtenez gratuitement",
          text: "Cette etape est un apercu de marche public, pas encore un audit personnalise de l'annonce.",
          items: [
            "Fourchette observee pour votre categorie",
            "Mediane du marche et niveau de confiance",
            "Signaux de couverture et de limites pour ce marche",
          ],
        },
        {
          title: "Ce qui n'est pas encore analyse",
          text: "Norixo n'inspecte pas le contenu prive de votre annonce avant le lancement de l'audit complet.",
          items: [
            "Aucune revue du titre, de la description, des photos ou des equipements",
            "Aucune analyse de votre prix prive",
            "Aucun diagnostic complet des concurrents ni plan d'action a ce stade",
          ],
        },
        {
          title: "Pourquoi ces resultats sont credibles",
          text: "L'apercu s'appuie sur des benchmarks publics agreges, selectionnes pour votre marche par les regles d'intelligence de Norixo.",
          items: [
            "Donnees de marche agregees et anonymisees uniquement",
            "Aucune donnee privee utilisateur publiee ni reutilisee publiquement",
            "La couverture peut varier selon la ville, la plateforme et le type de logement",
          ],
        },
        {
          title: "Pourquoi creer un compte ensuite",
          text: "Le compte permet a Norixo de poursuivre de maniere securisee depuis cet apercu vers le parcours d'audit complet.",
          items: [
            "Sauvegarder le contexte de reprise",
            "Lancer l'audit complet depuis le dashboard",
            "Retrouver plus tard vos audits et vos achats",
          ],
        },
      ],
    },
    compare: {
      title: "Apercu gratuit vs audit complet",
      freeTitle: "Apercu de marche gratuit",
      fullTitle: "Audit complet",
      freeItems: [
        "Fourchette de prix agregee",
        "Mediane du marche",
        "Niveau de confiance",
        "Recommandations generales",
        "Aucun contenu de l'annonce consulte",
      ],
      fullItems: [
        "Analyse reelle de l'annonce",
        "Titre et description",
        "Photos et equipements",
        "Concurrents reels",
        "Opportunites de conversion",
        "Recommandations personnalisees",
        "Analyse pricing complete",
        "Analyse d'occupation si disponible",
      ],
    },
    faq: {
      title: "Questions frequentes",
      items: [
        {
          question: "L'apercu gratuit est-il vraiment gratuit ?",
          answer:
            "Oui. L'apercu marche ne demande aucune carte bancaire et ne consomme aucun credit d'audit payant.",
        },
        {
          question: "Norixo se connecte-t-il a mon compte Airbnb ou Booking ?",
          answer:
            "Non. L'apercu gratuit utilise uniquement des informations structurees de marche et ne necessite aucune connexion a votre compte.",
        },
        {
          question: "Mon annonce est-elle extraite pendant l'apercu gratuit ?",
          answer:
            "Non. A ce stade Norixo ne lance pas d'extraction complete de l'annonce et n'analyse pas encore le contenu de votre annonce.",
        },
        {
          question: "D'ou viennent les donnees affichees ?",
          answer:
            "L'apercu est construit a partir de benchmarks publics agreges selectionnes pour le segment de marche demande.",
        },
        {
          question: "Pourquoi l'audit complet est-il payant ?",
          answer:
            "L'audit payant va au-dela du benchmark public et analyse votre annonce reelle, son contenu, son positionnement et ses actions prioritaires.",
        },
        {
          question: "Que se passe-t-il si la couverture du marche est encore insuffisante ?",
          answer:
            "Norixo indique que la couverture est insuffisante au lieu de simuler une precision que les benchmarks publics ne permettent pas encore.",
        },
      ],
    },
    cta: {
      title: "Pret a debloquer l'audit complet ?",
      text: "Passez d'un apercu du marche a l'audit complet de votre annonce avec Norixo.",
      primary: "Debloquer l'audit complet",
      secondary: "Partir de votre annonce reelle",
      reassurance: "Obtenez votre positionnement exact et des recommandations personnalisees.",
    },
    seo: {
      title: "Audit Airbnb gratuit : consultez les prix de votre marche | Norixo",
      description:
        "Consultez gratuitement la fourchette de prix et la mediane de votre marche avec des donnees agregees, sans extraction de donnees ni carte bancaire.",
    },
  },
  es: {
    hero: {
      eyebrow: "Vista previa gratuita del mercado",
      title: "Descubre una vision general de los precios del mercado",
      subtitle:
        "La vista previa gratuita del mercado de Norixo para anuncios de Airbnb y Booking muestra el rango observado y la mediana de tu categoria antes de una auditoria completa del anuncio.",
      reassurance:
        "Sin tarjeta bancaria. Sin extraccion de datos. No se analiza el contenido del anuncio ni tu precio personal en esta etapa.",
    },
    form: {
      title: "Vista estructurada del mercado",
      text:
        "Completa los datos estructurados a continuacion para recibir una vista previa basada unicamente en benchmarks agregados del mercado.",
      listingUrlLabel: "URL del anuncio (opcional — no se analiza ni se envia)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Pais",
      countryPlaceholder: "Espana",
      cityLabel: "Ciudad",
      cityPlaceholder: "Barcelona",
      platformLabel: "Plataforma",
      platformPlaceholder: "Selecciona una plataforma",
      propertyTypeLabel: "Tipo de alojamiento",
      propertyTypePlaceholder: "Selecciona un tipo de alojamiento",
      submitIdle: "Ver mi vista del mercado",
      submitLoading: "Analisis del mercado...",
      helper:
        "La URL permanece en tu navegador y nunca se envia a la API de vista previa.",
      statusLoading: "Vista previa del mercado en curso.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Estudio",
        apartment: "Apartamento",
        villa: "Villa",
        riad: "Riad",
        room: "Habitacion",
        hotel: "Hotel",
      },
    },
    errors: {
      listing_url_invalid: "Introduce una URL valida de una plataforma compatible.",
      country_required: "Introduce tu pais.",
      city_required: "Introduce tu ciudad.",
      platform_required: "Selecciona una plataforma.",
      property_type_required: "Selecciona un tipo de alojamiento.",
      invalid_request: "Hay informacion que debe corregirse.",
      rate_limited: "Has realizado varias solicitudes. Vuelve a intentarlo en unos minutos.",
      unavailable: "La vista previa gratuita no esta disponible temporalmente.",
      network_error: "No es posible cargar la vista previa ahora mismo.",
      unknown_error: "No es posible cargar la vista previa ahora mismo.",
    },
    result: {
      title: "Resumen de precios del mercado",
      text:
        "Resultado basado unicamente en los datos agregados del mercado disponibles para esta categoria.",
      initialTitle: "Tu vista previa aparecera aqui.",
      initialText:
        "Norixo mostrara el rango de precios observado y la mediana disponible para tu mercado.",
      initialGuideTitle: "Lo que descubriras",
      initialGuideItems: [
        {
          title: "Rango observado",
          text: "Descubre los precios bajos y altos disponibles para este mercado.",
        },
        {
          title: "Mediana del mercado",
          text: "Visualiza el nivel central observado para esta categoria.",
        },
        {
          title: "Nivel de confianza",
          text: "Comprende la solidez de los datos de mercado disponibles.",
        },
      ],
      initialPrompt:
        "Completa el formulario para mostrar la vista previa disponible para este mercado.",
      submittingTitle: "Preparando tu vista previa del mercado",
      submittingText:
        "Norixo esta reuniendo las senales agregadas del mercado disponibles para esta categoria.",
      benchmarkRange: "Rango observado",
      medianPrice: "Mediana",
      marketTitle: "Instantanea del mercado",
      marketScopeAllPlatforms: "Todas las plataformas",
      confidenceTitle: "Confianza",
      recommendationsTitle: "Recomendaciones",
      limitationsTitle: "Que debes saber",
      insufficientTitle: "La cobertura sigue siendo limitada",
      insufficientText:
        "Todavia no disponemos de suficiente volumen de datos agregados para esta solicitud.",
      unavailableTitle: "Vista previa no disponible",
      confidenceLevel: {
        standard: "Confianza estandar",
        high: "Confianza alta",
      },
      sampleBand: {
        sufficient: "Muestra suficiente",
        strong: "Muestra solida",
      },
      limitationCodes: {
        market_only: "No se analizo el precio ni el contenido de tu anuncio.",
        aggregated_market_data:
          "Los resultados se basan en datos agregados del mercado.",
        listing_specific_factors:
          "Las caracteristicas del alojamiento, la estacionalidad y la ubicacion exacta pueden cambiar mucho el precio adecuado.",
        broad_market_segment:
          "El benchmark disponible cubre un segmento de mercado mas amplio que tu solicitud inicial.",
        all_capacities_scope:
          "La vista previa agrega todas las capacidades de huespedes de este segmento de mercado.",
        multi_platform_scope:
          "Esta vista previa combina datos agregados de varias plataformas de reserva.",
        limited_sample_size:
          "La muestra actual sigue siendo limitada para este segmento de mercado.",
        limited_source_diversity:
          "La muestra actual procede de un conjunto limitado de fuentes de mercado.",
        aging_data:
          "Parte de los datos agregados del mercado empieza a quedarse antigua.",
        multi_currency_market:
          "Existen varias divisas en competencia en este mercado y no permiten una vista honesta sin contexto adicional.",
      },
      recommendationCodes: {
        median_positions_market:
          "La mediana observada ayuda a situar el nivel central de este mercado.",
        broader_segment_used:
          "La vista previa se apoya en un segmento de mercado mas amplio que el tipo exacto solicitado.",
        listing_specific_factors_matter:
          "Las fotos, los servicios, la estacionalidad y la ubicacion pueden modificar de forma importante el precio adecuado.",
        full_audit_for_positioning:
          "La auditoria completa analizara tu anuncio y a tus competidores reales para definir tu posicionamiento exacto.",
      },
    },
    premium: {
      rangeLabel: "Rango observado",
      marketMedianLabel: "Mediana del mercado",
      marketNowTitle: "Mercado actual",
      lowPriceLabel: "Precio bajo",
      medianPriceLabel: "Precio mediano",
      highPriceLabel: "Precio alto",
      compareToMarketCta: "Comparar mi anuncio con este mercado",
      revealTitle: "Lo que revelara tu auditoria completa",
      revealSubtitle:
        "La vista previa gratuita te muestra el mercado. La auditoria completa analiza tu anuncio real.",
      revealCards: [
        {
          title: "La posicion real de tu anuncio",
          text:
            "Compara tu anuncio con los competidores de tu mercado e identifica su posicionamiento exacto.",
        },
        {
          title: "Tu potencial de precio",
          text:
            "Descubre los niveles de precio adecuados para tu alojamiento, tu temporada y tu entorno competitivo.",
        },
        {
          title: "Tus palancas de conversion",
          text:
            "Analiza tu titulo, descripcion, fotos, servicios y los elementos que frenan las reservas.",
        },
        {
          title: "Tus acciones prioritarias",
          text:
            "Recibe un plan de accion claro, ordenado segun el impacto potencial en tu rendimiento.",
        },
      ],
      journeyTitle: "Tu recorrido con Norixo",
      journeySteps: [
        {
          title: "Vista previa gratuita del mercado",
          text: "Descubre el rango observado y la mediana del mercado.",
        },
        {
          title: "Analisis completo del anuncio",
          text:
            "Norixo analiza tu contenido, tus competidores y tu posicionamiento.",
        },
        {
          title: "Plan de accion personalizado",
          text: "Recibe recomendaciones concretas y priorizadas.",
        },
      ],
      unlockCta: "Desbloquear mi auditoria completa",
    },
    clarity: {
      title: "Entender la vista previa gratuita",
      cards: [
        {
          title: "Lo que recibes gratis",
          text: "Esta etapa es una vista previa del mercado publico, no una auditoria personalizada del anuncio.",
          items: [
            "Rango observado para tu categoria",
            "Mediana del mercado y nivel de confianza",
            "Senales de cobertura y limitaciones de este mercado",
          ],
        },
        {
          title: "Lo que aun no se analiza",
          text: "Norixo no inspecciona el contenido privado de tu anuncio antes de iniciar la auditoria completa.",
          items: [
            "Sin revision de titulo, descripcion, fotos o servicios",
            "Sin analisis de tu precio privado",
            "Sin diagnostico completo de competidores ni plan de accion todavia",
          ],
        },
        {
          title: "Por que estos resultados son creibles",
          text: "La vista previa se basa en evidencia publica de benchmark seleccionada para tu mercado segun las reglas de inteligencia de Norixo.",
          items: [
            "Solo datos de mercado agregados y anonimizados",
            "Ningun dato privado de usuarios se publica ni se reutiliza publicamente",
            "La cobertura puede variar segun ciudad, plataforma y tipo de propiedad",
          ],
        },
        {
          title: "Por que crear una cuenta despues",
          text: "La cuenta permite a Norixo continuar de forma segura desde esta vista previa hacia la auditoria completa.",
          items: [
            "Guardar el contexto de traspaso",
            "Lanzar la auditoria completa desde el panel",
            "Recuperar mas tarde tus auditorias y compras",
          ],
        },
      ],
    },
    compare: {
      title: "Vista gratuita vs auditoria completa",
      freeTitle: "Vista gratuita del mercado",
      fullTitle: "Auditoria completa",
      freeItems: [
        "Rango de precios agregado del mercado",
        "Mediana del mercado",
        "Nivel de confianza",
        "Recomendaciones generales",
        "No se revisa el contenido del anuncio",
      ],
      fullItems: [
        "Analisis real del anuncio",
        "Titulo y descripcion",
        "Fotos y servicios",
        "Competidores reales",
        "Oportunidades de conversion",
        "Recomendaciones personalizadas",
        "Analisis completo de precios",
        "Analisis de ocupacion cuando este disponible",
      ],
    },
    faq: {
      title: "Preguntas frecuentes",
      items: [
        {
          question: "La vista previa gratuita es realmente gratuita?",
          answer:
            "Si. La vista previa del mercado no requiere tarjeta y no consume ningun credito de auditoria de pago.",
        },
        {
          question: "Norixo se conecta a mi cuenta de Airbnb o Booking?",
          answer:
            "No. La vista previa gratuita usa solo entradas estructuradas del mercado y no requiere ninguna conexion de cuenta.",
        },
        {
          question: "Mi anuncio se extrae durante la vista previa gratuita?",
          answer:
            "No. En esta etapa Norixo no lanza una extraccion completa del anuncio ni revisa el contenido de tu anuncio.",
        },
        {
          question: "De donde vienen los datos de la vista previa?",
          answer:
            "La vista previa se construye a partir de evidencia publica agregada de benchmark seleccionada para el segmento de mercado solicitado.",
        },
        {
          question: "Por que la auditoria completa es de pago?",
          answer:
            "La auditoria de pago va mas alla del benchmark publico y analiza tu anuncio real, su contenido, su posicionamiento y sus acciones prioritarias.",
        },
        {
          question: "Que pasa si la cobertura del mercado sigue siendo limitada?",
          answer:
            "Norixo muestra que la cobertura es insuficiente en lugar de fingir una respuesta precisa cuando la evidencia publica disponible sigue siendo demasiado limitada.",
        },
      ],
    },
    cta: {
      title: "Listo para desbloquear la auditoria completa?",
      text: "Pasa de una instantanea del mercado a la auditoria completa de tu anuncio con Norixo.",
      primary: "Desbloquear la auditoria completa",
      secondary: "Empezar con tu anuncio real",
      reassurance: "Obtén tu posicionamiento exacto y recomendaciones personalizadas.",
    },
    seo: {
      title: "Auditoria Airbnb gratis: consulta los precios de tu mercado | Norixo",
      description:
        "Consulta gratis el rango de precios y la mediana de tu mercado con datos agregados, sin extraccion de datos ni tarjeta bancaria.",
    },
  },
  it: {
    hero: {
      eyebrow: "Anteprima gratuita del mercato",
      title: "Scopri una panoramica dei prezzi di mercato",
      subtitle:
        "L'anteprima gratuita del mercato di Norixo per gli annunci Airbnb e Booking mostra l'intervallo osservato e la mediana della tua categoria prima di un audit completo dell'annuncio.",
      reassurance:
        "Nessuna carta di credito. Nessuna estrazione di dati. In questa fase non vengono analizzati ne il contenuto dell'annuncio ne il tuo prezzo personale.",
    },
    form: {
      title: "Panoramica strutturata del mercato",
      text:
        "Compila i dettagli strutturati qui sotto per ricevere un'anteprima basata esclusivamente su benchmark di mercato aggregati.",
      listingUrlLabel: "URL dell'annuncio (facoltativo — non analizzato ne inviato)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Paese",
      countryPlaceholder: "Italia",
      cityLabel: "Citta",
      cityPlaceholder: "Roma",
      platformLabel: "Piattaforma",
      platformPlaceholder: "Seleziona una piattaforma",
      propertyTypeLabel: "Tipologia di alloggio",
      propertyTypePlaceholder: "Seleziona una tipologia di alloggio",
      submitIdle: "Vedi la mia panoramica del mercato",
      submitLoading: "Analisi del mercato...",
      helper:
        "L'URL resta nel tuo browser e non viene mai inviato all'API di anteprima.",
      statusLoading: "Anteprima del mercato in corso.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Monolocale",
        apartment: "Appartamento",
        villa: "Villa",
        riad: "Riad",
        room: "Camera",
        hotel: "Hotel",
      },
    },
    errors: {
      listing_url_invalid: "Inserisci un URL valido da una piattaforma supportata.",
      country_required: "Inserisci il tuo paese.",
      city_required: "Inserisci la tua citta.",
      platform_required: "Seleziona una piattaforma.",
      property_type_required: "Seleziona una tipologia di alloggio.",
      invalid_request: "Alcune informazioni devono essere corrette.",
      rate_limited: "Hai inviato diverse richieste. Riprova tra qualche minuto.",
      unavailable: "L'anteprima gratuita e temporaneamente non disponibile.",
      network_error: "Impossibile caricare l'anteprima in questo momento.",
      unknown_error: "Impossibile caricare l'anteprima in questo momento.",
    },
    result: {
      title: "Panoramica prezzi del mercato",
      text:
        "Risultato basato solo sui dati di mercato aggregati attualmente disponibili per questa categoria.",
      initialTitle: "La tua anteprima apparira qui.",
      initialText:
        "Norixo mostrera l'intervallo di prezzo osservato e la mediana disponibili per il tuo mercato.",
      initialGuideTitle: "Cosa scoprirai",
      initialGuideItems: [
        {
          title: "Intervallo osservato",
          text: "Scopri i prezzi piu bassi e piu alti disponibili per questo mercato.",
        },
        {
          title: "Mediana del mercato",
          text: "Visualizza il livello centrale osservato per questa categoria.",
        },
        {
          title: "Livello di affidabilita",
          text: "Comprendi quanto sono solidi i dati di mercato disponibili.",
        },
      ],
      initialPrompt:
        "Compila il modulo per visualizzare l'anteprima disponibile per questo mercato.",
      submittingTitle: "Preparazione della tua anteprima di mercato",
      submittingText:
        "Norixo sta assemblando i segnali di mercato aggregati disponibili per questa categoria.",
      benchmarkRange: "Intervallo osservato",
      medianPrice: "Mediana",
      marketTitle: "Panoramica del mercato",
      marketScopeAllPlatforms: "Tutte le piattaforme",
      confidenceTitle: "Affidabilita",
      recommendationsTitle: "Raccomandazioni",
      limitationsTitle: "Da sapere",
      insufficientTitle: "Copertura ancora limitata",
      insufficientText:
        "Non disponiamo ancora di un volume sufficiente di dati aggregati per questa richiesta.",
      unavailableTitle: "Anteprima non disponibile",
      confidenceLevel: {
        standard: "Affidabilita standard",
        high: "Affidabilita alta",
      },
      sampleBand: {
        sufficient: "Campione sufficiente",
        strong: "Campione solido",
      },
      limitationCodes: {
        market_only: "Non e stato analizzato ne il prezzo ne il contenuto del tuo annuncio.",
        aggregated_market_data:
          "I risultati si basano su dati di mercato aggregati.",
        listing_specific_factors:
          "Caratteristiche dell'alloggio, stagionalita e posizione precisa possono influenzare molto il prezzo corretto.",
        broad_market_segment:
          "Il benchmark disponibile copre un segmento di mercato piu ampio rispetto alla richiesta iniziale.",
        all_capacities_scope:
          "L'anteprima aggrega tutte le capacita degli ospiti di questo segmento di mercato.",
        multi_platform_scope:
          "Questa anteprima combina dati aggregati provenienti da piu piattaforme di prenotazione.",
        limited_sample_size:
          "Il campione attuale e ancora limitato per questo segmento di mercato.",
        limited_source_diversity:
          "Il campione attuale proviene da un insieme limitato di fonti di mercato.",
        aging_data:
          "Una parte dei dati aggregati di mercato sta iniziando a invecchiare.",
        multi_currency_market:
          "In questo mercato coesistono piu valute e non consentono un'anteprima affidabile senza ulteriore contesto.",
      },
      recommendationCodes: {
        median_positions_market:
          "La mediana osservata aiuta a collocare il livello centrale di questo mercato.",
        broader_segment_used:
          "L'anteprima si basa su un segmento di mercato piu ampio rispetto al tipo richiesto.",
        listing_specific_factors_matter:
          "Foto, servizi, stagionalita e posizione possono modificare in modo significativo il prezzo corretto.",
        full_audit_for_positioning:
          "L'audit completo analizzera il tuo annuncio e i concorrenti reali per determinare il tuo posizionamento esatto.",
      },
    },
    premium: {
      rangeLabel: "Fascia osservata",
      marketMedianLabel: "Mediana di mercato",
      marketNowTitle: "Mercato attuale",
      lowPriceLabel: "Prezzo basso",
      medianPriceLabel: "Prezzo mediano",
      highPriceLabel: "Prezzo alto",
      compareToMarketCta: "Confronta il mio annuncio con questo mercato",
      revealTitle: "Cosa rivelera il tuo audit completo",
      revealSubtitle:
        "L'anteprima gratuita ti mostra il mercato. L'audit completo analizza davvero il tuo annuncio.",
      revealCards: [
        {
          title: "La posizione reale del tuo annuncio",
          text:
            "Confronta il tuo annuncio con i concorrenti del tuo mercato e individua il suo posizionamento esatto.",
        },
        {
          title: "Il tuo potenziale tariffario",
          text:
            "Scopri i livelli di prezzo adatti al tuo alloggio, alla tua stagione e al tuo contesto competitivo.",
        },
        {
          title: "Le tue leve di conversione",
          text:
            "Analizza titolo, descrizione, foto, servizi e gli elementi che frenano le prenotazioni.",
        },
        {
          title: "Le tue azioni prioritarie",
          text:
            "Ricevi un piano d'azione chiaro, ordinato in base all'impatto potenziale sulle tue performance.",
        },
      ],
      journeyTitle: "Il tuo percorso con Norixo",
      journeySteps: [
        {
          title: "Anteprima gratuita del mercato",
          text: "Scopri la fascia osservata e la mediana del mercato.",
        },
        {
          title: "Analisi completa dell'annuncio",
          text:
            "Norixo analizza il tuo contenuto, i tuoi concorrenti e il tuo posizionamento.",
        },
        {
          title: "Piano d'azione personalizzato",
          text: "Ricevi raccomandazioni concrete e prioritarie.",
        },
      ],
      unlockCta: "Sblocca il mio audit completo",
    },
    clarity: {
      title: "Capire l'anteprima gratuita",
      cards: [
        {
          title: "Cosa ottieni gratuitamente",
          text: "Questa fase e un'anteprima pubblica del mercato, non ancora un audit personalizzato dell'annuncio.",
          items: [
            "Fascia osservata per la tua categoria",
            "Mediana di mercato e livello di affidabilita",
            "Segnali di copertura e limiti per questo mercato",
          ],
        },
        {
          title: "Cosa non viene ancora analizzato",
          text: "Norixo non esamina il contenuto privato del tuo annuncio prima dell'avvio dell'audit completo.",
          items: [
            "Nessuna revisione di titolo, descrizione, foto o servizi",
            "Nessuna analisi del tuo prezzo privato",
            "Nessuna diagnosi completa dei concorrenti o piano d'azione in questa fase",
          ],
        },
        {
          title: "Perche questi risultati sono credibili",
          text: "L'anteprima si basa su benchmark pubblici aggregati, selezionati per il tuo mercato dalle regole di intelligence di Norixo.",
          items: [
            "Solo dati di mercato aggregati e anonimizzati",
            "Nessun dato privato utente pubblicato o riutilizzato pubblicamente",
            "La copertura puo variare in base a citta, piattaforma e tipo di alloggio",
          ],
        },
        {
          title: "Perche creare un account dopo",
          text: "L'account permette a Norixo di proseguire in modo sicuro da questa anteprima verso il percorso di audit completo.",
          items: [
            "Salvare il contesto di ripresa",
            "Avviare l'audit completo dal dashboard",
            "Ritrovare in seguito audit e acquisti",
          ],
        },
      ],
    },
    compare: {
      title: "Anteprima gratuita vs audit completo",
      freeTitle: "Anteprima gratuita del mercato",
      fullTitle: "Audit completo",
      freeItems: [
        "Intervallo di prezzo aggregato del mercato",
        "Mediana del mercato",
        "Livello di affidabilita",
        "Raccomandazioni generali",
        "Nessun contenuto dell'annuncio analizzato",
      ],
      fullItems: [
        "Analisi reale dell'annuncio",
        "Titolo e descrizione",
        "Foto e servizi",
        "Concorrenti reali",
        "Opportunita di conversione",
        "Raccomandazioni personalizzate",
        "Analisi completa del pricing",
        "Analisi dell'occupazione quando disponibile",
      ],
    },
    faq: {
      title: "Domande frequenti",
      items: [
        {
          question: "L'anteprima gratuita e davvero gratuita?",
          answer:
            "Si. L'anteprima di mercato non richiede alcuna carta bancaria e non consuma alcun credito di audit a pagamento.",
        },
        {
          question: "Norixo si collega al mio account Airbnb o Booking?",
          answer:
            "No. L'anteprima gratuita usa solo informazioni strutturate di mercato e non richiede alcun accesso al tuo account.",
        },
        {
          question: "Il mio annuncio viene estratto durante l'anteprima gratuita?",
          answer:
            "No. In questa fase Norixo non avvia alcuna estrazione completa dell'annuncio e non analizza ancora il contenuto del tuo annuncio.",
        },
        {
          question: "Da dove provengono i dati mostrati?",
          answer:
            "L'anteprima e costruita a partire da benchmark pubblici aggregati selezionati per il segmento di mercato richiesto.",
        },
        {
          question: "Perche l'audit completo e a pagamento?",
          answer:
            "L'audit a pagamento va oltre il benchmark pubblico e analizza il tuo annuncio reale, il suo contenuto, il suo posizionamento e le azioni prioritarie.",
        },
        {
          question: "Cosa succede se la copertura del mercato e ancora insufficiente?",
          answer:
            "Norixo indica che la copertura e insufficiente invece di simulare una precisione che i benchmark pubblici non permettono ancora.",
        },
      ],
    },
    cta: {
      title: "Pronto a sbloccare l'audit completo?",
      text: "Passa da una panoramica del mercato all'audit completo del tuo annuncio con Norixo.",
      primary: "Sblocca l'audit completo",
      secondary: "Parti dal tuo annuncio reale",
      reassurance: "Ottieni il tuo posizionamento esatto e raccomandazioni personalizzate.",
    },
    seo: {
      title: "Audit Airbnb gratuito: confronta i prezzi del tuo mercato | Norixo",
      description:
        "Consulta gratuitamente fascia di prezzo e mediana del tuo mercato con dati aggregati, senza estrazione di dati e senza carta di credito.",
    },
  },
  pt: {
    hero: {
      eyebrow: "Pre-visualizacao gratuita do mercado",
      title: "Descubra uma visao de precos baseada apenas no mercado",
      subtitle:
        "A pre-visualizacao gratuita do mercado da Norixo para anuncios Airbnb e Booking mostra a faixa observada e a mediana da sua categoria antes de uma auditoria completa do anuncio.",
      reassurance:
        "Sem cartao de credito. Sem extracao de dados. Nesta fase nao analisamos o conteudo do anuncio nem o seu preco individual.",
    },
    form: {
      title: "Visao estruturada do mercado",
      text:
        "Preencha os dados estruturados abaixo para receber uma pre-visualizacao baseada apenas em benchmarks agregados do mercado.",
      listingUrlLabel: "URL do anuncio (opcional — nao e analisado nem enviado)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Pais",
      countryPlaceholder: "Portugal",
      cityLabel: "Cidade",
      cityPlaceholder: "Lisboa",
      platformLabel: "Plataforma",
      platformPlaceholder: "Selecione uma plataforma",
      propertyTypeLabel: "Tipo de alojamento",
      propertyTypePlaceholder: "Selecione um tipo de alojamento",
      submitIdle: "Ver a minha visao do mercado",
      submitLoading: "Analise do mercado...",
      helper:
        "O URL permanece no seu navegador e nunca e enviado para a API de pre-visualizacao.",
      statusLoading: "Pre-visualizacao do mercado em curso.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Estudio",
        apartment: "Apartamento",
        villa: "Moradia",
        riad: "Riad",
        room: "Quarto",
        hotel: "Hotel",
      },
    },
    errors: {
      listing_url_invalid: "Introduza um URL valido de uma plataforma suportada.",
      country_required: "Introduza o seu pais.",
      city_required: "Introduza a sua cidade.",
      platform_required: "Selecione uma plataforma.",
      property_type_required: "Selecione um tipo de alojamento.",
      invalid_request: "Algumas informacoes precisam de ser corrigidas.",
      rate_limited: "Fez varios pedidos. Tente novamente dentro de alguns minutos.",
      unavailable: "A pre-visualizacao gratuita esta temporariamente indisponivel.",
      network_error: "Nao foi possivel carregar a pre-visualizacao neste momento.",
      unknown_error: "Nao foi possivel carregar a pre-visualizacao neste momento.",
    },
    result: {
      title: "Visao geral de precos do mercado",
      text:
        "Resultado baseado apenas nos dados agregados do mercado atualmente disponiveis para esta categoria.",
      initialTitle: "A sua pre-visualizacao aparecera aqui.",
      initialText:
        "A Norixo mostrara a faixa de precos observada e a mediana disponivel para o seu mercado.",
      initialGuideTitle: "O que vai descobrir",
      initialGuideItems: [
        {
          title: "Faixa observada",
          text: "Descubra os precos mais baixos e mais altos disponiveis para este mercado.",
        },
        {
          title: "Mediana do mercado",
          text: "Visualize o nivel central observado para esta categoria.",
        },
        {
          title: "Nivel de confianca",
          text: "Compreenda a solidez dos dados de mercado disponiveis.",
        },
      ],
      initialPrompt:
        "Preencha o formulario para mostrar a pre-visualizacao disponivel para este mercado.",
      submittingTitle: "A preparar a sua pre-visualizacao do mercado",
      submittingText:
        "A Norixo esta a reunir os sinais agregados do mercado disponiveis para esta categoria.",
      benchmarkRange: "Faixa observada",
      medianPrice: "Mediana",
      marketTitle: "Panorama do mercado",
      marketScopeAllPlatforms: "Todas as plataformas",
      confidenceTitle: "Confianca",
      recommendationsTitle: "Recomendacoes",
      limitationsTitle: "O que saber",
      insufficientTitle: "A cobertura ainda e limitada",
      insufficientText:
        "Ainda nao dispomos de volume suficiente de dados agregados para este pedido.",
      unavailableTitle: "Pre-visualizacao indisponivel",
      confidenceLevel: {
        standard: "Confianca padrao",
        high: "Confianca alta",
      },
      sampleBand: {
        sufficient: "Amostra suficiente",
        strong: "Amostra forte",
      },
      limitationCodes: {
        market_only: "Nem o preco nem o conteudo do seu anuncio foram analisados.",
        aggregated_market_data:
          "Os resultados baseiam-se em dados agregados do mercado.",
        listing_specific_factors:
          "Caracteristicas do alojamento, sazonalidade e localizacao exata podem alterar bastante o preco certo.",
        broad_market_segment:
          "O benchmark disponivel cobre um segmento de mercado mais amplo do que o pedido inicial.",
        all_capacities_scope:
          "A pre-visualizacao agrega todas as capacidades de hospedes deste segmento de mercado.",
        multi_platform_scope:
          "Esta pre-visualizacao combina dados agregados de varias plataformas de reserva.",
        limited_sample_size:
          "A amostra atual ainda e limitada para este segmento de mercado.",
        limited_source_diversity:
          "A amostra atual vem de um conjunto limitado de fontes de mercado.",
        aging_data:
          "Parte dos dados agregados de mercado esta a comecar a envelhecer.",
        multi_currency_market:
          "Existem varias moedas concorrentes neste mercado e isso impede uma pre-visualizacao fiavel sem contexto adicional.",
      },
      recommendationCodes: {
        median_positions_market:
          "A mediana observada ajuda a posicionar o nivel central deste mercado.",
        broader_segment_used:
          "A pre-visualizacao baseia-se num segmento de mercado mais amplo do que o tipo pedido.",
        listing_specific_factors_matter:
          "Fotos, comodidades, sazonalidade e localizacao podem alterar materialmente o preco adequado.",
        full_audit_for_positioning:
          "A auditoria completa analisara o seu anuncio e os concorrentes reais para determinar o seu posicionamento exato.",
      },
    },
    premium: {
      rangeLabel: "Faixa observada",
      marketMedianLabel: "Mediana do mercado",
      marketNowTitle: "Mercado atual",
      lowPriceLabel: "Preco baixo",
      medianPriceLabel: "Preco mediano",
      highPriceLabel: "Preco alto",
      compareToMarketCta: "Comparar meu anuncio com este mercado",
      revealTitle: "O que a sua auditoria completa vai revelar",
      revealSubtitle:
        "A pre-visualizacao gratuita mostra o mercado. A auditoria completa analisa de fato o seu anuncio.",
      revealCards: [
        {
          title: "A posicao real do seu anuncio",
          text:
            "Compare o seu anuncio com os concorrentes do seu mercado e identifique o seu posicionamento exato.",
        },
        {
          title: "O seu potencial tarifario",
          text:
            "Descubra os niveis de preco adequados ao seu alojamento, a sua sazonalidade e ao seu ambiente competitivo.",
        },
        {
          title: "As suas alavancas de conversao",
          text:
            "Analise o seu titulo, descricao, fotos, comodidades e os elementos que travam as reservas.",
        },
        {
          title: "As suas acoes prioritarias",
          text:
            "Receba um plano de acao claro, ordenado pelo impacto potencial no seu desempenho.",
        },
      ],
      journeyTitle: "O seu percurso com a Norixo",
      journeySteps: [
        {
          title: "Pre-visualizacao gratuita do mercado",
          text: "Descubra a faixa observada e a mediana do mercado.",
        },
        {
          title: "Analise completa do anuncio",
          text:
            "A Norixo analisa o seu conteudo, os seus concorrentes e o seu posicionamento.",
        },
        {
          title: "Plano de acao personalizado",
          text: "Receba recomendacoes concretas e priorizadas.",
        },
      ],
      unlockCta: "Desbloquear a minha auditoria completa",
    },
    clarity: {
      title: "Compreender a pre-visualizacao gratuita",
      cards: [
        {
          title: "O que recebe gratuitamente",
          text: "Esta etapa e uma pre-visualizacao publica do mercado, ainda nao uma auditoria personalizada do anuncio.",
          items: [
            "Faixa observada para a sua categoria",
            "Mediana do mercado e nivel de confianca",
            "Sinais de cobertura e limites para este mercado",
          ],
        },
        {
          title: "O que ainda nao e analisado",
          text: "A Norixo nao inspeciona o conteudo privado do seu anuncio antes do inicio da auditoria completa.",
          items: [
            "Nenhuma revisao do titulo, descricao, fotos ou comodidades",
            "Nenhuma analise do seu preco privado",
            "Nenhum diagnostico completo dos concorrentes nem plano de acao nesta fase",
          ],
        },
        {
          title: "Porque estes resultados sao crediveis",
          text: "A pre-visualizacao baseia-se em benchmarks publicos agregados, selecionados para o seu mercado pelas regras de intelligence da Norixo.",
          items: [
            "Apenas dados de mercado agregados e anonimizados",
            "Nenhum dado privado de utilizador publicado ou reutilizado publicamente",
            "A cobertura pode variar consoante a cidade, a plataforma e o tipo de alojamento",
          ],
        },
        {
          title: "Porque criar uma conta a seguir",
          text: "A conta permite que a Norixo continue de forma segura desta pre-visualizacao para o percurso de auditoria completa.",
          items: [
            "Guardar o contexto de retoma",
            "Iniciar a auditoria completa a partir do dashboard",
            "Recuperar mais tarde as suas auditorias e compras",
          ],
        },
      ],
    },
    compare: {
      title: "Pre-visualizacao gratuita vs auditoria completa",
      freeTitle: "Pre-visualizacao gratuita do mercado",
      fullTitle: "Auditoria completa",
      freeItems: [
        "Faixa de precos agregada do mercado",
        "Mediana do mercado",
        "Nivel de confianca",
        "Recomendacoes gerais",
        "Nenhum conteudo do anuncio analisado",
      ],
      fullItems: [
        "Analise real do anuncio",
        "Titulo e descricao",
        "Fotos e comodidades",
        "Concorrentes reais",
        "Oportunidades de conversao",
        "Recomendacoes personalizadas",
        "Analise completa de precos",
        "Analise de ocupacao quando disponivel",
      ],
    },
    faq: {
      title: "Perguntas frequentes",
      items: [
        {
          question: "A pre-visualizacao gratuita e mesmo gratuita?",
          answer:
            "Sim. A pre-visualizacao do mercado nao exige cartao bancario e nao consome qualquer credito de auditoria paga.",
        },
        {
          question: "A Norixo liga-se a minha conta Airbnb ou Booking?",
          answer:
            "Nao. A pre-visualizacao gratuita usa apenas informacao estruturada de mercado e nao requer qualquer ligacao a sua conta.",
        },
        {
          question: "O meu anuncio e extraido durante a pre-visualizacao gratuita?",
          answer:
            "Nao. Nesta fase a Norixo nao inicia qualquer extracao completa do anuncio e ainda nao analisa o conteudo do seu anuncio.",
        },
        {
          question: "De onde vem os dados apresentados?",
          answer:
            "A pre-visualizacao e construida a partir de benchmarks publicos agregados selecionados para o segmento de mercado pedido.",
        },
        {
          question: "Porque a auditoria completa e paga?",
          answer:
            "A auditoria paga vai alem do benchmark publico e analisa o seu anuncio real, o seu conteudo, o seu posicionamento e as acoes prioritarias.",
        },
        {
          question: "O que acontece se a cobertura do mercado ainda for insuficiente?",
          answer:
            "A Norixo indica que a cobertura e insuficiente em vez de simular uma precisao que os benchmarks publicos ainda nao permitem.",
        },
      ],
    },
    cta: {
      title: "Pronto para desbloquear a auditoria completa?",
      text: "Passe de um panorama do mercado para a auditoria completa do seu anuncio com a Norixo.",
      primary: "Desbloquear a auditoria completa",
      secondary: "Comecar com o seu anuncio real",
      reassurance: "Obtenha o seu posicionamento exato e recomendacoes personalizadas.",
    },
    seo: {
      title: "Auditoria Airbnb gratis: consulte os precos do seu mercado | Norixo",
      description:
        "Consulte gratuitamente a faixa de precos e a mediana do seu mercado com dados agregados, sem extracao de dados e sem cartao de credito.",
    },
  },
  nl: {
    hero: {
      eyebrow: "Gratis marktpreview",
      title: "Ontdek een prijsbeeld dat alleen op de markt is gebaseerd",
      subtitle:
        "De gratis marktpreview van Norixo voor Airbnb- en Booking-accommodaties toont de waargenomen prijsvork en mediaan voor jouw categorie voordat je een volledige advertentie-audit start.",
      reassurance:
        "Geen creditcard. Geen gegevensverzameling. In deze stap wordt geen advertentie-inhoud of persoonlijke prijs geanalyseerd.",
    },
    form: {
      title: "Gestructureerde marktpreview",
      text:
        "Vul hieronder de gestructureerde gegevens in om een preview te ontvangen die uitsluitend op geaggregeerde marktbenchmarks is gebaseerd.",
      listingUrlLabel: "Advertentie-URL (optioneel — niet geanalyseerd of verzonden)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Land",
      countryPlaceholder: "Nederland",
      cityLabel: "Stad",
      cityPlaceholder: "Amsterdam",
      platformLabel: "Platform",
      platformPlaceholder: "Selecteer een platform",
      propertyTypeLabel: "Accommodatietype",
      propertyTypePlaceholder: "Selecteer een accommodatietype",
      submitIdle: "Bekijk mijn marktpreview",
      submitLoading: "Marktanalyse...",
      helper:
        "De URL blijft in je browser en wordt nooit naar de preview-API verzonden.",
      statusLoading: "Marktpreview wordt geladen.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Studio",
        apartment: "Appartement",
        villa: "Villa",
        riad: "Riad",
        room: "Kamer",
        hotel: "Hotel",
      },
    },
    errors: {
      listing_url_invalid: "Voer een geldige URL van een ondersteund platform in.",
      country_required: "Voer je land in.",
      city_required: "Voer je stad in.",
      platform_required: "Selecteer een platform.",
      property_type_required: "Selecteer een accommodatietype.",
      invalid_request: "Sommige gegevens moeten worden gecorrigeerd.",
      rate_limited: "Je hebt meerdere aanvragen gedaan. Probeer het over enkele minuten opnieuw.",
      unavailable: "De gratis preview is tijdelijk niet beschikbaar.",
      network_error: "De preview kan nu niet worden geladen.",
      unknown_error: "De preview kan nu niet worden geladen.",
    },
    result: {
      title: "Marktoverzicht van prijzen",
      text:
        "Resultaat dat uitsluitend is gebaseerd op de geaggregeerde marktgegevens die momenteel voor deze categorie beschikbaar zijn.",
      initialTitle: "Je preview verschijnt hier.",
      initialText:
        "Norixo toont de waargenomen prijsvork en mediaan die voor jouw markt beschikbaar zijn.",
      initialGuideTitle: "Wat je zult ontdekken",
      initialGuideItems: [
        {
          title: "Waargenomen bereik",
          text: "Ontdek de laagste en hoogste prijzen die voor deze markt beschikbaar zijn.",
        },
        {
          title: "Marktmediaan",
          text: "Bekijk het centrale prijsniveau dat voor deze categorie is waargenomen.",
        },
        {
          title: "Betrouwbaarheidsniveau",
          text: "Begrijp hoe solide de beschikbare marktdata is.",
        },
      ],
      initialPrompt:
        "Vul het formulier in om de preview te tonen die momenteel voor deze markt beschikbaar is.",
      submittingTitle: "Je marktpreview wordt voorbereid",
      submittingText:
        "Norixo verzamelt de geaggregeerde marktsignalen die voor deze categorie beschikbaar zijn.",
      benchmarkRange: "Waargenomen bereik",
      medianPrice: "Mediaan",
      marketTitle: "Marktsnapshot",
      marketScopeAllPlatforms: "Alle platforms",
      confidenceTitle: "Betrouwbaarheid",
      recommendationsTitle: "Aanbevelingen",
      limitationsTitle: "Goed om te weten",
      insufficientTitle: "De dekking is nog beperkt",
      insufficientText:
        "We beschikken nog niet over voldoende geaggregeerde gegevens voor deze aanvraag.",
      unavailableTitle: "Preview niet beschikbaar",
      confidenceLevel: {
        standard: "Standaard betrouwbaarheid",
        high: "Hoge betrouwbaarheid",
      },
      sampleBand: {
        sufficient: "Voldoende steekproef",
        strong: "Sterke steekproef",
      },
      limitationCodes: {
        market_only: "Er is geen prijs of inhoud van je advertentie geanalyseerd.",
        aggregated_market_data:
          "De resultaten zijn gebaseerd op geaggregeerde marktgegevens.",
        listing_specific_factors:
          "Eigenschappen van de accommodatie, seizoensinvloeden en de exacte locatie kunnen de juiste prijs sterk veranderen.",
        broad_market_segment:
          "De beschikbare benchmark dekt een breder marktsegment dan je oorspronkelijke aanvraag.",
        all_capacities_scope:
          "De preview bundelt alle gastcapaciteiten binnen dit marktsegment.",
        multi_platform_scope:
          "Deze preview combineert geaggregeerde gegevens van meerdere boekingsplatforms.",
        limited_sample_size:
          "De huidige steekproef is nog beperkt voor dit marktsegment.",
        limited_source_diversity:
          "De huidige steekproef komt uit een beperkte reeks marktbronnen.",
        aging_data:
          "Een deel van de geaggregeerde marktgegevens begint te verouderen.",
        multi_currency_market:
          "Er zijn meerdere concurrerende valuta in deze markt, waardoor een eerlijke preview zonder extra context niet mogelijk is.",
      },
      recommendationCodes: {
        median_positions_market:
          "De waargenomen mediaan helpt het centrale niveau van deze markt te bepalen.",
        broader_segment_used:
          "De preview steunt op een breder marktsegment dan het exact gevraagde type.",
        listing_specific_factors_matter:
          "Foto's, voorzieningen, seizoensinvloeden en locatie kunnen de juiste prijs merkbaar verschuiven.",
        full_audit_for_positioning:
          "De volledige audit analyseert je advertentie en echte concurrenten om je exacte positionering te bepalen.",
      },
    },
    premium: {
      rangeLabel: "Waargenomen bereik",
      marketMedianLabel: "Marktmediaan",
      marketNowTitle: "Huidige markt",
      lowPriceLabel: "Lage prijs",
      medianPriceLabel: "Mediaanprijs",
      highPriceLabel: "Hoge prijs",
      compareToMarketCta: "Vergelijk mijn advertentie met deze markt",
      revealTitle: "Wat je volledige audit zal onthullen",
      revealSubtitle:
        "De gratis preview laat de markt zien. De volledige audit analyseert je echte advertentie.",
      revealCards: [
        {
          title: "De echte positie van je advertentie",
          text:
            "Vergelijk je advertentie met concurrenten in jouw markt en bepaal de exacte positionering.",
        },
        {
          title: "Je prijspotentieel",
          text:
            "Ontdek prijsniveaus die passen bij je accommodatie, je seizoen en je concurrentieomgeving.",
        },
        {
          title: "Je conversiehefbomen",
          text:
            "Analyseer je titel, beschrijving, foto's, voorzieningen en de elementen die boekingen afremmen.",
        },
        {
          title: "Je prioritaire acties",
          text:
            "Ontvang een duidelijk actieplan, geordend op verwachte impact op je prestaties.",
        },
      ],
      journeyTitle: "Je traject met Norixo",
      journeySteps: [
        {
          title: "Gratis marktpreview",
          text: "Ontdek de waargenomen bandbreedte en de marktmediaan.",
        },
        {
          title: "Volledige advertentieanalyse",
          text:
            "Norixo analyseert je content, je concurrenten en je positionering.",
        },
        {
          title: "Persoonlijk actieplan",
          text: "Ontvang concrete, geprioriteerde aanbevelingen.",
        },
      ],
      unlockCta: "Mijn volledige audit ontgrendelen",
    },
    clarity: {
      title: "Begrijp de gratis preview",
      cards: [
        {
          title: "Wat je gratis krijgt",
          text: "Deze stap is een publieke marktpreview, nog geen gepersonaliseerde audit van je advertentie.",
          items: [
            "Waargenomen bandbreedte voor jouw categorie",
            "Marktmediaan en betrouwbaarheidsniveau",
            "Signalen over dekking en beperkingen voor deze markt",
          ],
        },
        {
          title: "Wat nog niet wordt geanalyseerd",
          text: "Norixo bekijkt de prive-inhoud van je advertentie nog niet voordat de volledige audit wordt gestart.",
          items: [
            "Geen beoordeling van titel, beschrijving, foto's of voorzieningen",
            "Geen analyse van je priveprijs",
            "Nog geen volledige concurrentiediagnose of actieplan in deze fase",
          ],
        },
        {
          title: "Waarom deze resultaten geloofwaardig zijn",
          text: "De preview is gebaseerd op geaggregeerde publieke benchmarks die door de intelligentieregels van Norixo voor jouw markt zijn geselecteerd.",
          items: [
            "Alleen geaggregeerde en geanonimiseerde marktdata",
            "Geen privegebruikersdata wordt publiek gemaakt of publiek hergebruikt",
            "De dekking kan verschillen per stad, platform en type accommodatie",
          ],
        },
        {
          title: "Waarom je daarna een account maakt",
          text: "Met een account kan Norixo veilig doorgaan van deze preview naar het volledige audittraject.",
          items: [
            "De hervatcontext bewaren",
            "De volledige audit starten vanuit het dashboard",
            "Later je audits en aankopen terugvinden",
          ],
        },
      ],
    },
    compare: {
      title: "Gratis preview vs volledige audit",
      freeTitle: "Gratis marktpreview",
      fullTitle: "Volledige audit",
      freeItems: [
        "Geaggregeerde prijsvork van de markt",
        "Marktmediaan",
        "Betrouwbaarheidsniveau",
        "Algemene aanbevelingen",
        "Geen advertentie-inhoud beoordeeld",
      ],
      fullItems: [
        "Echte advertentie-analyse",
        "Titel en beschrijving",
        "Foto's en voorzieningen",
        "Echte concurrenten",
        "Conversiekansen",
        "Persoonlijke aanbevelingen",
        "Volledige prijsanalyse",
        "Bezettingsanalyse indien beschikbaar",
      ],
    },
    faq: {
      title: "Veelgestelde vragen",
      items: [
        {
          question: "Is de gratis preview echt gratis?",
          answer:
            "Ja. De marktpreview vraagt geen creditcard en verbruikt geen betaalde auditcredits.",
        },
        {
          question: "Verbindt Norixo met mijn Airbnb- of Booking-account?",
          answer:
            "Nee. De gratis preview gebruikt alleen gestructureerde marktinformatie en vereist geen verbinding met je account.",
        },
        {
          question: "Wordt mijn advertentie opgehaald tijdens de gratis preview?",
          answer:
            "Nee. In deze fase start Norixo geen volledige extractie van de advertentie en analyseert het de inhoud van je advertentie nog niet.",
        },
        {
          question: "Waar komen de getoonde gegevens vandaan?",
          answer:
            "De preview is opgebouwd uit geaggregeerde publieke benchmarks die zijn geselecteerd voor het gevraagde marktsegment.",
        },
        {
          question: "Waarom is de volledige audit betaald?",
          answer:
            "De betaalde audit gaat verder dan de publieke benchmark en analyseert je echte advertentie, de inhoud, de positionering en de prioritaire acties.",
        },
        {
          question: "Wat gebeurt er als de markdekking nog onvoldoende is?",
          answer:
            "Norixo geeft aan dat de dekking onvoldoende is in plaats van een nauwkeurigheid te simuleren die de publieke benchmarks nog niet ondersteunen.",
        },
      ],
    },
    cta: {
      title: "Klaar om de volledige audit te ontgrendelen?",
      text: "Ga van een marktsnapshot naar de volledige Norixo-audit van je advertentie.",
      primary: "Volledige audit ontgrendelen",
      secondary: "Start met je echte advertentie",
      reassurance: "Ontvang je exacte positionering en persoonlijke aanbevelingen.",
    },
    seo: {
      title: "Gratis Airbnb-marktcheck: vergelijk prijzen in jouw markt | Norixo",
      description:
        "Bekijk gratis de prijsvork en mediaan van jouw markt met geaggregeerde data, zonder gegevensverzameling en zonder creditcard.",
    },
  },
  de: {
    hero: {
      eyebrow: "Kostenlose Marktübersicht",
      title: "Entdecken Sie einen Marktuberblick auf Basis aggregierter Preise",
      subtitle:
        "Die kostenlose Marktübersicht von Norixo für Airbnb- und Booking-Inserate zeigt die beobachtete Preisspanne und den Median Ihrer Kategorie vor einem vollständigen Inserats-Audit.",
      reassurance:
        "Keine Kreditkarte. Kein Datenabruf. In dieser Phase werden weder der Inhalt Ihrer Anzeige noch Ihr individueller Preis analysiert.",
    },
    form: {
      title: "Strukturierte Marktvorschau",
      text:
        "Geben Sie unten die strukturierten Angaben ein, um eine Vorschau zu erhalten, die ausschliesslich auf aggregierten Marktbenchmarks basiert.",
      listingUrlLabel: "Inserats-URL (optional — wird nicht analysiert oder gesendet)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Land",
      countryPlaceholder: "Deutschland",
      cityLabel: "Stadt",
      cityPlaceholder: "Berlin",
      platformLabel: "Plattform",
      platformPlaceholder: "Plattform auswahlen",
      propertyTypeLabel: "Unterkunftsart",
      propertyTypePlaceholder: "Unterkunftsart auswahlen",
      submitIdle: "Meine Marktübersicht ansehen",
      submitLoading: "Marktanalyse...",
      helper:
        "Die URL bleibt in Ihrem Browser und wird nie an die Vorschau-API gesendet.",
      statusLoading: "Marktvorschau wird geladen.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "Studio",
        apartment: "Wohnung",
        villa: "Villa",
        riad: "Riad",
        room: "Zimmer",
        hotel: "Hotel",
      },
    },
    errors: {
      listing_url_invalid: "Geben Sie eine gultige URL einer unterstutzten Plattform ein.",
      country_required: "Geben Sie Ihr Land ein.",
      city_required: "Geben Sie Ihre Stadt ein.",
      platform_required: "Wahlen Sie eine Plattform aus.",
      property_type_required: "Wahlen Sie eine Unterkunftsart aus.",
      invalid_request: "Einige Angaben mussen korrigiert werden.",
      rate_limited: "Sie haben mehrere Anfragen gestellt. Bitte versuchen Sie es in einigen Minuten erneut.",
      unavailable: "Die kostenlose Vorschau ist vorubergehend nicht verfugbar.",
      network_error: "Die Vorschau kann derzeit nicht geladen werden.",
      unknown_error: "Die Vorschau kann derzeit nicht geladen werden.",
    },
    result: {
      title: "Marktuberblick zu Preisen",
      text:
        "Ergebnis ausschliesslich auf Basis der aktuell fur diese Kategorie verfugbaren aggregierten Marktdaten.",
      initialTitle: "Ihre Vorschau erscheint hier.",
      initialText:
        "Norixo zeigt die beobachtete Preisspanne und den verfugbaren Median fur Ihren Markt.",
      initialGuideTitle: "Was Sie entdecken werden",
      initialGuideItems: [
        {
          title: "Beobachtete Spanne",
          text: "Entdecken Sie die aktuell fur diesen Markt verfugbaren niedrigen und hohen Preise.",
        },
        {
          title: "Marktmedian",
          text: "Sehen Sie das zentrale Preisniveau, das fur diese Kategorie beobachtet wurde.",
        },
        {
          title: "Vertrauensniveau",
          text: "Verstehen Sie, wie belastbar die verfugbaren Marktdaten sind.",
        },
      ],
      initialPrompt:
        "Fullen Sie das Formular aus, um die aktuell fur diesen Markt verfugbare Vorschau anzuzeigen.",
      submittingTitle: "Ihre Marktvorschau wird vorbereitet",
      submittingText:
        "Norixo stellt die aggregierten Marktsignale zusammen, die fur diese Kategorie verfugbar sind.",
      benchmarkRange: "Beobachtete Spanne",
      medianPrice: "Median",
      marketTitle: "Marktsnapshot",
      marketScopeAllPlatforms: "Alle Plattformen",
      confidenceTitle: "Vertrauen",
      recommendationsTitle: "Empfehlungen",
      limitationsTitle: "Wissenswertes",
      insufficientTitle: "Die Abdeckung ist noch begrenzt",
      insufficientText:
        "Fur diese Anfrage liegen noch nicht genug aggregierte Marktdaten vor.",
      unavailableTitle: "Vorschau nicht verfugbar",
      confidenceLevel: {
        standard: "Standardvertrauen",
        high: "Hohes Vertrauen",
      },
      sampleBand: {
        sufficient: "Ausreichende Stichprobe",
        strong: "Starke Stichprobe",
      },
      limitationCodes: {
        market_only: "Weder Preis noch Inhalt Ihres Inserats wurden analysiert.",
        aggregated_market_data:
          "Die Ergebnisse basieren auf aggregierten Marktdaten.",
        listing_specific_factors:
          "Unterkunftsmerkmale, Saisonverlauf und der genaue Standort konnen den passenden Preis stark verandern.",
        broad_market_segment:
          "Der verfugbare Benchmark deckt ein breiteres Marktsegment ab als Ihre ursprungliche Anfrage.",
        all_capacities_scope:
          "Die Vorschau fasst alle Gastekapazitaten in diesem Marktsegment zusammen.",
        multi_platform_scope:
          "Diese Vorschau kombiniert aggregierte Daten aus mehreren Buchungsplattformen.",
        limited_sample_size:
          "Die aktuelle Stichprobe ist fur dieses Marktsegment noch begrenzt.",
        limited_source_diversity:
          "Die aktuelle Stichprobe stammt aus einer begrenzten Anzahl von Marktquellen.",
        aging_data:
          "Ein Teil der aggregierten Marktdaten beginnt zu veralten.",
        multi_currency_market:
          "In diesem Markt existieren mehrere konkurrierende Wahrungen, sodass ohne zusatzlichen Kontext keine verlassliche Vorschau moglich ist.",
      },
      recommendationCodes: {
        median_positions_market:
          "Der beobachtete Median hilft dabei, das zentrale Preisniveau dieses Marktes einzuordnen.",
        broader_segment_used:
          "Die Vorschau basiert auf einem breiteren Marktsegment als dem exakt angefragten Typ.",
        listing_specific_factors_matter:
          "Fotos, Ausstattung, Saisonverlauf und Lage konnen den passenden Preis deutlich beeinflussen.",
        full_audit_for_positioning:
          "Das vollstandige Audit analysiert Ihr Inserat und reale Wettbewerber, um Ihre genaue Positionierung zu bestimmen.",
      },
    },
    premium: {
      rangeLabel: "Beobachtete Spanne",
      marketMedianLabel: "Marktmedian",
      marketNowTitle: "Aktueller Markt",
      lowPriceLabel: "Niedriger Preis",
      medianPriceLabel: "Medianpreis",
      highPriceLabel: "Hoher Preis",
      compareToMarketCta: "Mein Inserat mit diesem Markt vergleichen",
      revealTitle: "Was Ihr vollstandiges Audit aufdecken wird",
      revealSubtitle:
        "Die kostenlose Vorschau zeigt Ihnen den Markt. Das vollstandige Audit analysiert Ihr tatsachliches Inserat.",
      revealCards: [
        {
          title: "Die tatsachliche Position Ihres Inserats",
          text:
            "Vergleichen Sie Ihr Inserat mit den Wettbewerbern in Ihrem Markt und bestimmen Sie seine genaue Positionierung.",
        },
        {
          title: "Ihr Preispotenzial",
          text:
            "Entdecken Sie Preisniveaus, die zu Ihrer Unterkunft, Ihrer Saison und Ihrem Wettbewerbsumfeld passen.",
        },
        {
          title: "Ihre Conversion-Hebel",
          text:
            "Analysieren Sie Titel, Beschreibung, Fotos, Ausstattung und alle Elemente, die Buchungen bremsen.",
        },
        {
          title: "Ihre wichtigsten Massnahmen",
          text:
            "Erhalten Sie einen klaren Aktionsplan, priorisiert nach dem voraussichtlichen Einfluss auf Ihre Performance.",
        },
      ],
      journeyTitle: "Ihr Weg mit Norixo",
      journeySteps: [
        {
          title: "Kostenlose Marktvorschau",
          text: "Entdecken Sie die beobachtete Spanne und den Marktmedian.",
        },
        {
          title: "Vollstandige Inseratsanalyse",
          text:
            "Norixo analysiert Ihr Inserat, Ihre Wettbewerber und Ihre Positionierung.",
        },
        {
          title: "Personalisierter Aktionsplan",
          text: "Sie erhalten konkrete, priorisierte Empfehlungen.",
        },
      ],
      unlockCta: "Mein vollstandiges Audit freischalten",
    },
    clarity: {
      title: "Die kostenlose Vorschau verstehen",
      cards: [
        {
          title: "Was Sie kostenlos erhalten",
          text: "Dieser Schritt ist eine offentliche Marktvorschau, noch kein personalisiertes Audit Ihres Inserats.",
          items: [
            "Beobachtete Spanne fur Ihre Kategorie",
            "Marktmedian und Vertrauensniveau",
            "Hinweise zu Abdeckung und Grenzen dieses Marktes",
          ],
        },
        {
          title: "Was noch nicht analysiert wird",
          text: "Norixo pruft die privaten Inhalte Ihres Inserats noch nicht, bevor das vollstandige Audit gestartet wird.",
          items: [
            "Keine Prufung von Titel, Beschreibung, Fotos oder Ausstattung",
            "Keine Analyse Ihres privaten Preises",
            "Noch keine vollstandige Wettbewerbsdiagnose oder kein Aktionsplan in dieser Phase",
          ],
        },
        {
          title: "Warum diese Ergebnisse glaubwurdig sind",
          text: "Die Vorschau basiert auf aggregierten offentlichen Benchmarks, die von den Intelligence-Regeln von Norixo fur Ihren Markt ausgewahlt werden.",
          items: [
            "Nur aggregierte und anonymisierte Marktdaten",
            "Keine privaten Nutzerdaten werden offentlich veroffentlicht oder offentlich wiederverwendet",
            "Die Abdeckung kann je nach Stadt, Plattform und Unterkunftstyp variieren",
          ],
        },
        {
          title: "Warum Sie danach ein Konto erstellen",
          text: "Mit dem Konto kann Norixo sicher von dieser Vorschau zum vollstandigen Auditpfad ubergehen.",
          items: [
            "Den Wiederaufnahmekontext speichern",
            "Das vollstandige Audit aus dem Dashboard starten",
            "Spater Audits und Kaufe wiederfinden",
          ],
        },
      ],
    },
    compare: {
      title: "Kostenlose Vorschau vs vollstandiges Audit",
      freeTitle: "Kostenlose Marktvorschau",
      fullTitle: "Vollstandiges Audit",
      freeItems: [
        "Aggregierte Marktpreisspanne",
        "Marktmedian",
        "Vertrauensniveau",
        "Allgemeine Empfehlungen",
        "Keine Inseratsinhalte gepruft",
      ],
      fullItems: [
        "Reale Inseratsanalyse",
        "Titel und Beschreibung",
        "Fotos und Ausstattung",
        "Reale Wettbewerber",
        "Konversionschancen",
        "Personalisierte Empfehlungen",
        "Vollstandige Preisanalyse",
        "Auslastungsanalyse, wenn verfugbar",
      ],
    },
    faq: {
      title: "Haufige Fragen",
      items: [
        {
          question: "Ist die kostenlose Vorschau wirklich kostenlos?",
          answer:
            "Ja. Die Marktvorschau erfordert keine Kreditkarte und verbraucht keine kostenpflichtigen Audit-Credits.",
        },
        {
          question: "Verbindet sich Norixo mit meinem Airbnb- oder Booking-Konto?",
          answer:
            "Nein. Die kostenlose Vorschau nutzt nur strukturierte Marktinformationen und benotigt keine Verbindung zu Ihrem Konto.",
        },
        {
          question: "Wird mein Inserat wahrend der kostenlosen Vorschau ausgelesen?",
          answer:
            "Nein. In dieser Phase startet Norixo keine vollstandige Extraktion des Inserats und analysiert den Inhalt Ihres Inserats noch nicht.",
        },
        {
          question: "Woher stammen die angezeigten Daten?",
          answer:
            "Die Vorschau wird aus aggregierten offentlichen Benchmarks aufgebaut, die fur das angeforderte Marktsegment ausgewahlt wurden.",
        },
        {
          question: "Warum ist das vollstandige Audit kostenpflichtig?",
          answer:
            "Das kostenpflichtige Audit geht uber den offentlichen Benchmark hinaus und analysiert Ihr echtes Inserat, dessen Inhalt, Positionierung und priorisierte Aktionen.",
        },
        {
          question: "Was passiert, wenn die Marktabdeckung noch nicht ausreicht?",
          answer:
            "Norixo weist auf eine unzureichende Abdeckung hin, statt eine Genauigkeit vorzutauschen, die die offentlichen Benchmarks noch nicht erlauben.",
        },
      ],
    },
    cta: {
      title: "Bereit fur das vollstandige Audit?",
      text: "Wechseln Sie von einem Marktsnapshot zum vollstandigen Norixo-Audit Ihres Inserats.",
      primary: "Vollstandiges Audit freischalten",
      secondary: "Mit Ihrem echten Inserat starten",
      reassurance: "Erhalten Sie Ihre exakte Positionierung und personliche Empfehlungen.",
    },
    seo: {
      title: "Kostenloser Airbnb-Marktcheck: Preise vergleichen | Norixo",
      description:
        "Vergleichen Sie kostenlos Preisspanne und Median Ihres Marktes anhand aggregierter Daten - ohne Datenabruf und ohne Kreditkarte.",
    },
  },
  ja: {
    hero: {
      eyebrow: "無料の市場スナップショット",
      title: "市場データだけで価格感をすばやく把握",
      subtitle:
        "NorixoのAirbnbおよびBooking掲載向け無料市場スナップショットでは、完全なリスティング監査の前に、カテゴリーの観測価格帯と中央値を確認できます。",
      reassurance:
        "クレジットカード不要。データ抽出なし。この段階では掲載内容やあなた自身の価格は分析しません。",
    },
    form: {
      title: "市場プレビュー",
      text:
        "以下の構造化情報を入力すると、集約された市場ベンチマークだけに基づくプレビューを受け取れます。",
      listingUrlLabel: "掲載URL（任意・分析も送信もしません）",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "国",
      countryPlaceholder: "日本",
      cityLabel: "都市",
      cityPlaceholder: "東京",
      platformLabel: "プラットフォーム",
      platformPlaceholder: "プラットフォームを選択",
      propertyTypeLabel: "宿泊タイプ",
      propertyTypePlaceholder: "宿泊タイプを選択",
      submitIdle: "市場スナップショットを見る",
      submitLoading: "市場を分析中...",
      helper:
        "URL はブラウザ内にとどまり、プレビュー API に送信されることはありません。",
      statusLoading: "市場プレビューを生成しています。",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "スタジオ",
        apartment: "アパート",
        villa: "ヴィラ",
        riad: "リアド",
        room: "個室",
        hotel: "ホテル",
      },
    },
    errors: {
      listing_url_invalid: "対応プラットフォームの有効な URL を入力してください。",
      country_required: "国を入力してください。",
      city_required: "都市を入力してください。",
      platform_required: "プラットフォームを選択してください。",
      property_type_required: "宿泊タイプを選択してください。",
      invalid_request: "修正が必要な項目があります。",
      rate_limited: "短時間に複数回リクエストされています。数分後にもう一度お試しください。",
      unavailable: "無料プレビューは現在一時的に利用できません。",
      network_error: "現在プレビューを読み込めません。",
      unknown_error: "現在プレビューを読み込めません。",
    },
    result: {
      title: "市場価格の概要",
      text:
        "このカテゴリで現在利用可能な集約市場データのみに基づく結果です。",
      initialTitle: "ここにプレビューが表示されます。",
      initialText:
        "Norixo は、あなたの市場で観測された価格帯と中央値を表示します。",
      initialGuideTitle: "表示される内容",
      initialGuideItems: [
        {
          title: "観測レンジ",
          text: "この市場で利用できる低価格帯と高価格帯を確認できます。",
        },
        {
          title: "市場中央値",
          text: "このカテゴリで観測された中心的な価格水準を把握できます。",
        },
        {
          title: "信頼度レベル",
          text: "利用可能な市場データの確かさを理解できます。",
        },
      ],
      initialPrompt:
        "フォームを入力すると、この市場で利用可能なプレビューを表示できます。",
      submittingTitle: "市場プレビューを準備しています",
      submittingText:
        "Norixo がこのカテゴリで利用可能な集約市場シグナルをまとめています。",
      benchmarkRange: "観測レンジ",
      medianPrice: "中央値",
      marketTitle: "市場スナップショット",
      marketScopeAllPlatforms: "すべてのプラットフォーム",
      confidenceTitle: "信頼度",
      recommendationsTitle: "推奨事項",
      limitationsTitle: "ご確認ください",
      insufficientTitle: "データカバレッジはまだ限定的です",
      insufficientText:
        "このリクエストに対して、十分な集約市場データがまだありません。",
      unavailableTitle: "プレビューを利用できません",
      confidenceLevel: {
        standard: "標準的な信頼度",
        high: "高い信頼度",
      },
      sampleBand: {
        sufficient: "十分なサンプル",
        strong: "強いサンプル",
      },
      limitationCodes: {
        market_only: "掲載内容や価格そのものは分析していません。",
        aggregated_market_data:
          "結果は集約された市場データに基づいています。",
        listing_specific_factors:
          "宿の特徴、季節性、正確な立地によって適正価格は大きく変わる場合があります。",
        broad_market_segment:
          "利用可能なベンチマークは、当初の条件より広い市場セグメントを対象にしています。",
        all_capacities_scope:
          "このプレビューは、この市場セグメントの全ての定員帯をまとめて集計しています。",
        multi_platform_scope:
          "このプレビューは複数の予約プラットフォームから集計したデータを組み合わせています。",
        limited_sample_size:
          "この市場セグメントでは、現在のサンプル数がまだ限られています。",
        limited_source_diversity:
          "現在のサンプルは限られた市場ソースに基づいています。",
        aging_data:
          "集計された市場データの一部は古くなり始めています。",
        multi_currency_market:
          "この市場では複数の通貨が混在しており、追加情報なしでは信頼できるプレビューを提示できません。",
      },
      recommendationCodes: {
        median_positions_market:
          "観測された中央値は、この市場の中心的な価格水準を把握するのに役立ちます。",
        broader_segment_used:
          "このプレビューは、要求された正確なタイプより広い市場セグメントに基づいています。",
        listing_specific_factors_matter:
          "写真、設備、季節性、立地によって適正価格は大きく左右されます。",
        full_audit_for_positioning:
          "完全監査では、掲載内容と実際の競合を分析し、正確なポジショニングを明らかにします。",
      },
    },
    premium: {
      rangeLabel: "観測レンジ",
      marketMedianLabel: "市場中央値",
      marketNowTitle: "現在の市場",
      lowPriceLabel: "低価格",
      medianPriceLabel: "中央値",
      highPriceLabel: "高価格",
      compareToMarketCta: "この市場と自分の掲載を比較する",
      revealTitle: "完全監査でわかること",
      revealSubtitle:
        "無料プレビューでは市場の状況を表示します。完全監査では、実際の掲載内容を詳しく分析します。",
      revealCards: [
        {
          title: "あなたの掲載の実際のポジション",
          text:
            "あなたの掲載を同市場の競合と比較し、正確なポジショニングを把握します。",
        },
        {
          title: "あなたの料金ポテンシャル",
          text:
            "物件の特性、シーズン、競争環境に合った価格帯を把握できます。",
        },
        {
          title: "改善すべきコンバージョン要素",
          text:
            "タイトル、説明文、写真、設備、予約を妨げている要素を分析します。",
        },
        {
          title: "優先して取り組むべき施策",
          text:
            "期待される効果の大きい順に、明確なアクションプランを受け取れます。",
        },
      ],
      journeyTitle: "Norixoでの流れ",
      journeySteps: [
        {
          title: "無料の市場プレビュー",
          text: "観測レンジと市場中央値を確認します。",
        },
        {
          title: "掲載内容の完全分析",
          text:
            "Norixoが掲載内容、競合、ポジショニングを分析します。",
        },
        {
          title: "パーソナライズされたアクションプラン",
          text: "具体的で優先順位付きの推奨事項を受け取れます。",
        },
      ],
      unlockCta: "完全監査を開始する",
    },
    clarity: {
      title: "無料プレビューでわかること",
      cards: [
        {
          title: "無料で受け取れる内容",
          text: "この段階は公開市場データのプレビューであり、まだ掲載内容の個別監査ではありません。",
          items: [
            "あなたのカテゴリで観測された価格帯",
            "市場中央値と信頼度",
            "この市場におけるカバレッジと制約のシグナル",
          ],
        },
        {
          title: "まだ分析されない内容",
          text: "完全監査を開始する前に、Norixo が掲載の非公開コンテンツを確認することはありません。",
          items: [
            "タイトル、説明文、写真、設備のレビューはまだ行いません",
            "あなた自身の価格はまだ分析しません",
            "この段階では競合の完全診断や行動計画もまだ行いません",
          ],
        },
        {
          title: "なぜこの結果を信頼できるのか",
          text: "このプレビューは、Norixo のインテリジェンスルールが対象市場向けに選定した集約型の公開ベンチマークに基づいています。",
          items: [
            "使用するのは集約・匿名化された市場データのみ",
            "ユーザーの非公開データが公開されたり公開用途に再利用されたりすることはありません",
            "カバレッジは都市、プラットフォーム、物件タイプによって変わる場合があります",
          ],
        },
        {
          title: "その後にアカウントが必要な理由",
          text: "アカウントを作成すると、このプレビューから完全監査の流れへ安全に進めます。",
          items: [
            "再開用のコンテキストを保存するため",
            "ダッシュボードから完全監査を開始するため",
            "後で監査履歴や購入内容を確認するため",
          ],
        },
      ],
    },
    compare: {
      title: "無料プレビューと完全監査の比較",
      freeTitle: "無料の市場プレビュー",
      fullTitle: "完全監査",
      freeItems: [
        "集約された市場価格レンジ",
        "市場中央値",
        "信頼度レベル",
        "一般的な推奨事項",
        "掲載内容は未分析",
      ],
      fullItems: [
        "実際の掲載分析",
        "タイトルと説明文",
        "写真と設備",
        "実際の競合",
        "コンバージョン機会",
        "パーソナライズされた推奨事項",
        "完全な価格分析",
        "利用可能な場合は稼働率分析",
      ],
    },
    faq: {
      title: "よくある質問",
      items: [
        {
          question: "無料プレビューは本当に無料ですか？",
          answer:
            "はい。市場プレビューにクレジットカードは不要で、有料監査クレジットも消費しません。",
        },
        {
          question: "Norixo は Airbnb や Booking のアカウントに接続しますか？",
          answer:
            "いいえ。無料プレビューで使うのは構造化された市場情報だけで、アカウント接続は必要ありません。",
        },
        {
          question: "無料プレビューの間に自分の掲載は抽出されますか？",
          answer:
            "いいえ。この段階で Norixo が掲載の完全抽出を開始することはなく、掲載内容もまだ分析しません。",
        },
        {
          question: "表示されるデータはどこから来ますか？",
          answer:
            "このプレビューは、要求された市場セグメント向けに選定された集約型の公開ベンチマークから構築されます。",
        },
        {
          question: "なぜ完全監査は有料なのですか？",
          answer:
            "有料監査は公開ベンチマークを超えて、実際の掲載内容、ポジショニング、優先アクションまで分析するためです。",
        },
        {
          question: "市場カバレッジがまだ不十分な場合はどうなりますか？",
          answer:
            "公開ベンチマークでまだ正確に示せない場合、Norixo は精度を装うのではなく、カバレッジ不足を明示します。",
        },
      ],
    },
    cta: {
      title: "完全監査を開始しますか？",
      text: "市場スナップショットから、Norixo の完全な掲載監査へ進みましょう。",
      primary: "完全監査を開始",
      secondary: "実際の掲載から始める",
      reassurance: "正確なポジショニングと個別の推奨事項を取得できます。",
    },
    seo: {
      title: "無料 Airbnb 市場チェック：相場価格を確認 | Norixo",
      description:
        "集約データを使って、市場の価格帯と中央値を無料で確認できます。データ抽出不要、クレジットカード不要です。",
    },
  },
  zh: {
    hero: {
      eyebrow: "免费市场快照",
      title: "快速查看仅基于市场数据的价格概览",
      subtitle:
        "Norixo 面向 Airbnb 和 Booking 房源的免费市场快照，可在进行完整房源审核前展示你所在类别的观察价格范围和中位数。",
      reassurance:
        "无需信用卡。无需数据抓取。这个阶段不会分析你的房源内容或个人定价。",
    },
    form: {
      title: "市场预览",
      text:
        "填写下方结构化信息，即可获得仅基于聚合市场基准数据的预览。",
      listingUrlLabel: "房源链接（可选，不会被分析或发送）",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "国家",
      countryPlaceholder: "中国",
      cityLabel: "城市",
      cityPlaceholder: "上海",
      platformLabel: "平台",
      platformPlaceholder: "选择平台",
      propertyTypeLabel: "房源类型",
      propertyTypePlaceholder: "选择房源类型",
      submitIdle: "查看我的市场快照",
      submitLoading: "正在分析市场...",
      helper:
        "该链接仅保留在你的浏览器中，不会发送到预览 API。",
      statusLoading: "正在生成市场预览。",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "开间",
        apartment: "公寓",
        villa: "别墅",
        riad: "Riad",
        room: "房间",
        hotel: "酒店",
      },
    },
    errors: {
      listing_url_invalid: "请输入受支持平台的有效房源链接。",
      country_required: "请输入国家。",
      city_required: "请输入城市。",
      platform_required: "请选择平台。",
      property_type_required: "请选择房源类型。",
      invalid_request: "部分信息需要更正。",
      rate_limited: "你已提交多次请求，请几分钟后再试。",
      unavailable: "免费预览当前暂时不可用。",
      network_error: "目前无法加载预览。",
      unknown_error: "目前无法加载预览。",
    },
    result: {
      title: "市场价格概览",
      text:
        "结果仅基于当前该类别可用的聚合市场数据。",
      initialTitle: "你的预览将显示在这里。",
      initialText:
        "Norixo 将展示你所在市场的价格区间和中位数。",
      initialGuideTitle: "你将看到什么",
      initialGuideItems: [
        {
          title: "观察区间",
          text: "了解这个市场目前可用的低价和高价范围。",
        },
        {
          title: "市场中位数",
          text: "查看该类别当前观察到的中心价格水平。",
        },
        {
          title: "置信度级别",
          text: "理解当前可用市场数据的可靠程度。",
        },
      ],
      initialPrompt: "填写表单后，即可显示该市场当前可用的预览。",
      submittingTitle: "正在准备你的市场预览",
      submittingText:
        "Norixo 正在汇总该类别当前可用的聚合市场信号。",
      benchmarkRange: "观察到的区间",
      medianPrice: "中位数",
      marketTitle: "市场快照",
      marketScopeAllPlatforms: "所有平台",
      confidenceTitle: "置信度",
      recommendationsTitle: "建议",
      limitationsTitle: "需要了解",
      insufficientTitle: "当前覆盖仍然有限",
      insufficientText:
        "我们目前还没有足够的聚合市场数据来支持此请求。",
      unavailableTitle: "预览不可用",
      confidenceLevel: {
        standard: "标准置信度",
        high: "高置信度",
      },
      sampleBand: {
        sufficient: "样本充足",
        strong: "样本较强",
      },
      limitationCodes: {
        market_only: "未分析你的房源内容或个人定价。",
        aggregated_market_data:
          "结果基于聚合后的市场数据。",
        listing_specific_factors:
          "房源特征、季节性和精确位置都可能显著影响合适的价格。",
        broad_market_segment:
          "当前可用的基准覆盖范围比你的初始请求更广。",
        all_capacities_scope:
          "该预览汇总了这个市场分段中的所有接待容量。",
        multi_platform_scope:
          "该预览汇总了来自多个预订平台的聚合数据。",
        limited_sample_size:
          "这个市场分段当前的样本量仍然有限。",
        limited_source_diversity:
          "当前样本来自数量有限的市场来源。",
        aging_data:
          "部分聚合市场数据已经开始变旧。",
        multi_currency_market:
          "该市场存在多种竞争货币，没有额外上下文时无法给出可靠预览。",
      },
      recommendationCodes: {
        median_positions_market:
          "观察到的中位数有助于判断该市场的中心价格水平。",
        broader_segment_used:
          "该预览依赖于比所请求精确类型更宽泛的市场分段。",
        listing_specific_factors_matter:
          "照片、设施、季节性和位置都会显著影响合理定价。",
        full_audit_for_positioning:
          "完整审计将分析你的房源与真实竞品，以确定你的精确市场定位。",
      },
    },
    premium: {
      rangeLabel: "观察区间",
      marketMedianLabel: "市场中位数",
      marketNowTitle: "当前市场",
      lowPriceLabel: "低价",
      medianPriceLabel: "中位价",
      highPriceLabel: "高价",
      compareToMarketCta: "将我的房源与该市场比较",
      revealTitle: "完整审计将揭示什么",
      revealSubtitle:
        "免费预览向你展示市场，而完整审计会真正分析你的房源。",
      revealCards: [
        {
          title: "你的房源真实定位",
          text:
            "将你的房源与同市场竞品进行比较，识别其准确定位。",
        },
        {
          title: "你的定价潜力",
          text:
            "了解适合你的房源、季节和竞争环境的价格区间。",
        },
        {
          title: "你的转化杠杆",
          text:
            "分析标题、描述、照片、设施以及阻碍预订的因素。",
        },
        {
          title: "你的优先行动",
          text:
            "获得一份清晰的行动计划，并按潜在影响排序。",
        },
      ],
      journeyTitle: "你在 Norixo 的路径",
      journeySteps: [
        {
          title: "免费市场预览",
          text: "查看市场价格区间和市场中位数。",
        },
        {
          title: "完整房源分析",
          text:
            "Norixo 会分析你的内容、竞品和定位。",
        },
        {
          title: "个性化行动计划",
          text: "获得具体且有优先级的建议。",
        },
      ],
      unlockCta: "解锁我的完整审计",
    },
    clarity: {
      title: "理解这份免费预览",
      cards: [
        {
          title: "你可以免费获得什么",
          text: "这一步是公开市场预览，还不是针对你房源的个性化完整审计。",
          items: [
            "你所在类别的市场观察价格区间",
            "市场中位数与置信度",
            "该市场的覆盖情况与限制信号",
          ],
        },
        {
          title: "目前还不会分析什么",
          text: "在启动完整审计之前，Norixo 不会检查你房源的私有内容。",
          items: [
            "不会审查标题、描述、图片或设施",
            "不会分析你的私有定价",
            "此阶段也不会给出完整竞品诊断或行动计划",
          ],
        },
        {
          title: "为什么这些结果可信",
          text: "这份预览基于 Norixo 智能规则为你的市场筛选出的聚合公开基准数据。",
          items: [
            "只使用聚合且匿名化的市场数据",
            "不会公开或公开复用任何用户私有数据",
            "覆盖范围会因城市、平台和房源类型而变化",
          ],
        },
        {
          title: "为什么下一步要创建账户",
          text: "创建账户后，Norixo 才能从这份预览安全地继续进入完整审计流程。",
          items: [
            "保存你的继续上下文",
            "从仪表板启动完整审计",
            "之后找回你的审计记录和购买记录",
          ],
        },
      ],
    },
    compare: {
      title: "免费预览与完整审计",
      freeTitle: "免费市场预览",
      fullTitle: "完整审计",
      freeItems: [
        "聚合市场价格区间",
        "市场中位数",
        "置信度级别",
        "通用建议",
        "不分析房源内容",
      ],
      fullItems: [
        "真实房源分析",
        "标题与描述",
        "图片与设施",
        "真实竞品",
        "转化机会",
        "个性化建议",
        "完整价格分析",
        "如可用则提供入住率分析",
      ],
    },
    faq: {
      title: "常见问题",
      items: [
        {
          question: "免费预览真的完全免费吗？",
          answer:
            "是的。市场预览不需要信用卡，也不会消耗任何付费审计额度。",
        },
        {
          question: "Norixo 会连接我的 Airbnb 或 Booking 账户吗？",
          answer:
            "不会。免费预览只使用结构化市场信息，不需要连接你的账户。",
        },
        {
          question: "免费预览阶段会抓取我的房源吗？",
          answer:
            "不会。在这个阶段 Norixo 不会启动完整房源提取，也不会分析你的房源内容。",
        },
        {
          question: "显示的数据来自哪里？",
          answer:
            "这份预览基于为所请求市场细分选择的聚合公开基准数据构建。",
        },
        {
          question: "为什么完整审计是付费的？",
          answer:
            "付费审计超出了公开基准范围，会分析你的真实房源、内容、定位以及优先行动。",
        },
        {
          question: "如果市场覆盖仍然不足会怎样？",
          answer:
            "如果公开基准还不足以支撑可靠结果，Norixo 会明确提示覆盖不足，而不是假装精确。",
        },
      ],
    },
    cta: {
      title: "准备解锁完整审计了吗？",
      text: "从市场快照升级到 Norixo 的完整房源审计。",
      primary: "解锁完整审计",
      secondary: "从你的真实房源开始",
      reassurance: "获得精确定位和个性化建议。",
    },
    seo: {
      title: "免费 Airbnb 市场价格预览：查看你的市场价格 | Norixo",
      description:
        "使用聚合数据免费查看你所在市场的价格区间和中位数，无需数据抓取，也无需信用卡。",
    },
  },
  ko: {
    hero: {
      eyebrow: "무료 시장 스냅샷",
      title: "시장 데이터만으로 가격 포지션을 빠르게 확인하세요",
      subtitle:
        "Norixo의 Airbnb 및 Booking 숙소용 무료 시장 스냅샷은 전체 숙소 감사 전에 해당 카테고리의 관측 가격 범위와 중앙값을 보여 줍니다.",
      reassurance:
        "신용카드가 필요 없습니다. 데이터 추출도 하지 않습니다. 이 단계에서는 숙소 콘텐츠나 개인 가격을 분석하지 않습니다.",
    },
    form: {
      title: "시장 미리보기",
      text:
        "아래의 구조화된 정보를 입력하면 집계된 시장 벤치마크에만 기반한 미리보기를 받을 수 있습니다.",
      listingUrlLabel: "숙소 URL (선택 사항 — 분석하거나 전송하지 않음)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "국가",
      countryPlaceholder: "대한민국",
      cityLabel: "도시",
      cityPlaceholder: "서울",
      platformLabel: "플랫폼",
      platformPlaceholder: "플랫폼 선택",
      propertyTypeLabel: "숙소 유형",
      propertyTypePlaceholder: "숙소 유형 선택",
      submitIdle: "시장 스냅샷 보기",
      submitLoading: "시장 분석 중...",
      helper:
        "URL 은 브라우저에만 남아 있으며 미리보기 API 로 전송되지 않습니다.",
      statusLoading: "시장 미리보기를 생성하고 있습니다.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "스튜디오",
        apartment: "아파트",
        villa: "빌라",
        riad: "리아드",
        room: "객실",
        hotel: "호텔",
      },
    },
    errors: {
      listing_url_invalid: "지원되는 플랫폼의 올바른 URL 을 입력하세요.",
      country_required: "국가를 입력하세요.",
      city_required: "도시를 입력하세요.",
      platform_required: "플랫폼을 선택하세요.",
      property_type_required: "숙소 유형을 선택하세요.",
      invalid_request: "수정이 필요한 정보가 있습니다.",
      rate_limited: "여러 번 요청하셨습니다. 몇 분 후 다시 시도해 주세요.",
      unavailable: "무료 미리보기를 현재 일시적으로 이용할 수 없습니다.",
      network_error: "지금은 미리보기를 불러올 수 없습니다.",
      unknown_error: "지금은 미리보기를 불러올 수 없습니다.",
    },
    result: {
      title: "시장 가격 개요",
      text:
        "현재 이 카테고리에서 사용할 수 있는 집계 시장 데이터만을 기반으로 한 결과입니다.",
      initialTitle: "여기에 미리보기가 표시됩니다.",
      initialText:
        "Norixo 가 해당 시장의 관측 가격 범위와 중앙값을 보여줍니다.",
      initialGuideTitle: "확인하게 될 내용",
      initialGuideItems: [
        {
          title: "관측 범위",
          text: "이 시장에서 현재 확인 가능한 최저가와 최고가를 살펴보세요.",
        },
        {
          title: "시장 중앙값",
          text: "이 카테고리에서 관측된 중심 가격대를 확인하세요.",
        },
        {
          title: "신뢰도 수준",
          text: "현재 이용 가능한 시장 데이터가 얼마나 탄탄한지 이해하세요.",
        },
      ],
      initialPrompt:
        "양식을 입력하면 이 시장에서 현재 이용 가능한 미리보기를 표시할 수 있습니다.",
      submittingTitle: "시장 미리보기를 준비하고 있습니다",
      submittingText:
        "Norixo 가 이 카테고리에서 사용할 수 있는 집계 시장 신호를 모으고 있습니다.",
      benchmarkRange: "관측 범위",
      medianPrice: "중앙값",
      marketTitle: "시장 스냅샷",
      marketScopeAllPlatforms: "모든 플랫폼",
      confidenceTitle: "신뢰도",
      recommendationsTitle: "추천 사항",
      limitationsTitle: "알아둘 점",
      insufficientTitle: "현재 데이터 범위가 아직 제한적입니다",
      insufficientText:
        "이 요청을 지원할 만큼의 집계 시장 데이터가 아직 충분하지 않습니다.",
      unavailableTitle: "미리보기를 사용할 수 없습니다",
      confidenceLevel: {
        standard: "표준 신뢰도",
        high: "높은 신뢰도",
      },
      sampleBand: {
        sufficient: "충분한 표본",
        strong: "강한 표본",
      },
      limitationCodes: {
        market_only: "숙소 콘텐츠나 개인 가격은 분석하지 않았습니다.",
        aggregated_market_data:
          "결과는 집계된 시장 데이터를 기반으로 합니다.",
        listing_specific_factors:
          "숙소 특성, 계절성, 정확한 위치에 따라 적정 가격은 크게 달라질 수 있습니다.",
        broad_market_segment:
          "현재 사용 가능한 벤치마크는 초기 요청보다 더 넓은 시장 세그먼트를 다룹니다.",
        all_capacities_scope:
          "이 미리보기는 이 시장 세그먼트의 모든 수용 인원을 함께 집계합니다.",
        multi_platform_scope:
          "이 미리보기는 여러 예약 플랫폼의 집계 데이터를 함께 반영합니다.",
        limited_sample_size:
          "이 시장 세그먼트에서는 현재 표본이 아직 제한적입니다.",
        limited_source_diversity:
          "현재 표본은 제한된 시장 출처에 기반합니다.",
        aging_data:
          "집계된 시장 데이터의 일부가 오래되기 시작했습니다.",
        multi_currency_market:
          "이 시장에는 여러 통화가 혼재해 있어 추가 맥락 없이는 신뢰할 수 있는 미리보기를 제공할 수 없습니다.",
      },
      recommendationCodes: {
        median_positions_market:
          "관측된 중앙값은 이 시장의 중심 가격대를 파악하는 데 도움이 됩니다.",
        broader_segment_used:
          "이 미리보기는 요청한 정확한 유형보다 더 넓은 시장 세그먼트에 기반합니다.",
        listing_specific_factors_matter:
          "사진, 편의시설, 계절성, 위치는 적정 가격에 큰 영향을 줄 수 있습니다.",
        full_audit_for_positioning:
          "전체 감사는 숙소와 실제 경쟁 숙소를 분석해 정확한 포지셔닝을 파악합니다.",
      },
    },
    premium: {
      rangeLabel: "관측 범위",
      marketMedianLabel: "시장 중앙값",
      marketNowTitle: "현재 시장",
      lowPriceLabel: "저가",
      medianPriceLabel: "중간 가격",
      highPriceLabel: "고가",
      compareToMarketCta: "내 숙소를 이 시장과 비교하기",
      revealTitle: "전체 감사에서 드러나는 내용",
      revealSubtitle:
        "무료 미리보기는 시장을 보여주고, 전체 감사는 실제 숙소를 분석합니다.",
      revealCards: [
        {
          title: "숙소의 실제 포지션",
          text:
            "숙소를 같은 시장의 경쟁 숙소와 비교해 정확한 포지셔닝을 파악합니다.",
        },
        {
          title: "가격 잠재력",
          text:
            "숙소, 시즌, 경쟁 환경에 맞는 가격 수준을 파악합니다.",
        },
        {
          title: "전환 레버",
          text:
            "제목, 설명, 사진, 편의시설과 예약을 막는 요소를 분석합니다.",
        },
        {
          title: "우선 실행 항목",
          text:
            "성과에 미칠 가능성이 큰 순서대로 명확한 실행 계획을 받습니다.",
        },
      ],
      journeyTitle: "Norixo와 함께하는 여정",
      journeySteps: [
        {
          title: "무료 시장 미리보기",
          text: "관측 범위와 시장 중앙값을 확인합니다.",
        },
        {
          title: "전체 숙소 분석",
          text:
            "Norixo가 콘텐츠, 경쟁 숙소, 포지셔닝을 분석합니다.",
        },
        {
          title: "맞춤형 실행 계획",
          text: "구체적이고 우선순위가 정리된 추천을 받습니다.",
        },
      ],
      unlockCta: "전체 감사 열기",
    },
    clarity: {
      title: "무료 미리보기 이해하기",
      cards: [
        {
          title: "무료로 받게 되는 내용",
          text: "이 단계는 공개 시장 미리보기이며, 아직 숙소에 대한 개인화된 전체 감사는 아닙니다.",
          items: [
            "해당 카테고리에서 관측된 가격 범위",
            "시장 중앙값과 신뢰도",
            "이 시장의 커버리지와 제한 신호",
          ],
        },
        {
          title: "아직 분석되지 않는 내용",
          text: "전체 감사를 시작하기 전에는 Norixo가 숙소의 비공개 콘텐츠를 검사하지 않습니다.",
          items: [
            "제목, 설명, 사진, 편의시설 검토 없음",
            "개별 숙소 가격 분석 없음",
            "이 단계에서는 전체 경쟁 진단이나 실행 계획도 제공되지 않음",
          ],
        },
        {
          title: "왜 이 결과를 신뢰할 수 있나요",
          text: "이 미리보기는 Norixo의 인텔리전스 규칙이 해당 시장에 맞게 선택한 집계형 공개 벤치마크를 기반으로 합니다.",
          items: [
            "집계되고 익명화된 시장 데이터만 사용",
            "사용자의 비공개 데이터는 공개되거나 공개 용도로 재사용되지 않음",
            "커버리지는 도시, 플랫폼, 숙소 유형에 따라 달라질 수 있음",
          ],
        },
        {
          title: "왜 다음 단계에서 계정이 필요한가요",
          text: "계정을 만들면 이 미리보기에서 전체 감사 흐름으로 안전하게 이어갈 수 있습니다.",
          items: [
            "이어보기용 컨텍스트 저장",
            "대시보드에서 전체 감사 시작",
            "나중에 감사 기록과 구매 내역 다시 확인",
          ],
        },
      ],
    },
    compare: {
      title: "무료 미리보기 vs 전체 감사",
      freeTitle: "무료 시장 미리보기",
      fullTitle: "전체 감사",
      freeItems: [
        "집계 시장 가격 범위",
        "시장 중앙값",
        "신뢰도 수준",
        "일반 추천 사항",
        "숙소 콘텐츠 미분석",
      ],
      fullItems: [
        "실제 숙소 분석",
        "제목과 설명",
        "사진과 편의시설",
        "실제 경쟁 숙소",
        "전환 기회",
        "개인화된 추천",
        "전체 가격 분석",
        "가능한 경우 점유율 분석",
      ],
    },
    faq: {
      title: "자주 묻는 질문",
      items: [
        {
          question: "무료 미리보기는 정말 무료인가요?",
          answer:
            "네. 시장 미리보기에는 신용카드가 필요 없고, 유료 감사 크레딧도 소모되지 않습니다.",
        },
        {
          question: "Norixo가 제 Airbnb 또는 Booking 계정에 연결되나요?",
          answer:
            "아니요. 무료 미리보기는 구조화된 시장 정보만 사용하며 계정 연결이 필요하지 않습니다.",
        },
        {
          question: "무료 미리보기 중에 제 숙소가 추출되나요?",
          answer:
            "아니요. 이 단계에서 Norixo는 숙소의 전체 추출을 시작하지 않으며 숙소 콘텐츠도 아직 분석하지 않습니다.",
        },
        {
          question: "표시되는 데이터는 어디에서 오나요?",
          answer:
            "이 미리보기는 요청한 시장 세그먼트에 맞게 선택된 집계형 공개 벤치마크를 기반으로 구성됩니다.",
        },
        {
          question: "왜 전체 감사는 유료인가요?",
          answer:
            "유료 감사는 공개 벤치마크를 넘어 실제 숙소, 콘텐츠, 포지셔닝, 우선 실행 항목까지 분석하기 때문입니다.",
        },
        {
          question: "시장 커버리지가 아직 부족하면 어떻게 되나요?",
          answer:
            "공개 벤치마크만으로는 신뢰할 만한 결과를 만들 수 없을 때 Norixo는 정밀도를 가장하지 않고 커버리지 부족을 명확히 알립니다.",
        },
      ],
    },
    cta: {
      title: "전체 감사를 시작할 준비가 되었나요?",
      text: "시장 스냅샷에서 Norixo 전체 숙소 감사로 넘어가세요.",
      primary: "전체 감사 시작",
      secondary: "실제 숙소로 시작하기",
      reassurance: "정확한 포지셔닝과 개인화된 추천을 받을 수 있습니다.",
    },
    seo: {
      title: "무료 Airbnb 시장 점검: 내 시장 가격 확인 | Norixo",
      description:
        "집계 데이터를 기반으로 시장 가격 범위와 중앙값을 무료로 확인하세요. 데이터 추출도, 신용카드도 필요 없습니다.",
    },
  },
  ar: {
    hero: {
      eyebrow: "لقطة مجانية للسوق",
      title: "اكتشف لمحة سعرية مبنية على بيانات السوق فقط",
      subtitle:
        "تعرض اللقطة المجانية للسوق من Norixo لإعلانات Airbnb وBooking النطاق السعري المرصود والقيمة الوسيطة لفئتك قبل التدقيق الكامل للإعلان.",
      reassurance:
        "من دون بطاقة مصرفية. من دون استخراج البيانات. لا يتم تحليل محتوى إعلانك ولا سعرك الفردي في هذه المرحلة.",
    },
    form: {
      title: "معاينة منظمة للسوق",
      text:
        "املأ البيانات المنظمة أدناه للحصول على معاينة تعتمد فقط على مؤشرات السوق المجمعة.",
      listingUrlLabel: "رابط الإعلان (اختياري — لا يتم تحليله أو إرساله)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "البلد",
      countryPlaceholder: "المغرب",
      cityLabel: "المدينة",
      cityPlaceholder: "مراكش",
      platformLabel: "المنصة",
      platformPlaceholder: "اختر منصة",
      propertyTypeLabel: "نوع الإقامة",
      propertyTypePlaceholder: "اختر نوع الإقامة",
      submitIdle: "عرض لقطة السوق",
      submitLoading: "جار تحليل السوق...",
      helper:
        "يبقى الرابط داخل متصفحك ولا يتم إرساله أبدا إلى واجهة المعاينة.",
      statusLoading: "جار إنشاء معاينة السوق.",
    },
    options: {
      platform: {
        airbnb: "Airbnb",
        booking: "Booking",
        expedia: "Expedia",
        agoda: "Agoda",
        vrbo: "Vrbo",
      },
      propertyType: {
        studio: "استوديو",
        apartment: "شقة",
        villa: "فيلا",
        riad: "رياض",
        room: "غرفة",
        hotel: "فندق",
      },
    },
    errors: {
      listing_url_invalid: "أدخل رابطا صالحا من منصة مدعومة.",
      country_required: "أدخل البلد.",
      city_required: "أدخل المدينة.",
      platform_required: "اختر منصة.",
      property_type_required: "اختر نوع الإقامة.",
      invalid_request: "هناك معلومات تحتاج إلى تصحيح.",
      rate_limited: "لقد أجريت عدة طلبات. حاول مرة أخرى بعد بضع دقائق.",
      unavailable: "المعاينة المجانية غير متاحة مؤقتا.",
      network_error: "لا يمكن تحميل المعاينة حاليا.",
      unknown_error: "لا يمكن تحميل المعاينة حاليا.",
    },
    result: {
      title: "نظرة عامة على أسعار السوق",
      text:
        "هذه النتيجة مبنية فقط على بيانات السوق المجمعة المتاحة حاليا لهذه الفئة.",
      initialTitle: "ستظهر المعاينة هنا.",
      initialText:
        "ستعرض Norixo نطاق الأسعار المرصود والوسيط المتاحين في سوقك.",
      initialGuideTitle: "ما الذي ستكتشفه",
      initialGuideItems: [
        {
          title: "النطاق المرصود",
          text: "اكتشف الأسعار المنخفضة والمرتفعة المتاحة حاليا لهذا السوق.",
        },
        {
          title: "وسيط السوق",
          text: "اطلع على المستوى السعري المركزي المرصود لهذه الفئة.",
        },
        {
          title: "مستوى الثقة",
          text: "افهم مدى قوة بيانات السوق المتاحة حاليا.",
        },
      ],
      initialPrompt: "املأ النموذج لعرض المعاينة المتاحة حاليا لهذا السوق.",
      submittingTitle: "جار تجهيز معاينة السوق",
      submittingText:
        "تجمع Norixo إشارات السوق المجمعة المتاحة حاليا لهذه الفئة.",
      benchmarkRange: "النطاق المرصود",
      medianPrice: "الوسيط",
      marketTitle: "لقطة السوق",
      marketScopeAllPlatforms: "جميع المنصات",
      confidenceTitle: "مستوى الثقة",
      recommendationsTitle: "التوصيات",
      limitationsTitle: "ما ينبغي معرفته",
      insufficientTitle: "التغطية ما زالت محدودة",
      insufficientText:
        "لا نملك بعد حجما كافيا من البيانات المجمعة لهذا الطلب.",
      unavailableTitle: "المعاينة غير متاحة",
      confidenceLevel: {
        standard: "ثقة قياسية",
        high: "ثقة مرتفعة",
      },
      sampleBand: {
        sufficient: "عينة كافية",
        strong: "عينة قوية",
      },
      limitationCodes: {
        market_only: "لم يتم تحليل سعر إعلانك أو محتواه.",
        aggregated_market_data:
          "النتائج مبنية على بيانات سوق مجمعة.",
        listing_specific_factors:
          "خصائص السكن والموسمية والموقع الدقيق قد تغيّر السعر المناسب بشكل كبير.",
        broad_market_segment:
          "المعيار المتاح يغطي شريحة سوقية أوسع من طلبك الأصلي.",
        all_capacities_scope:
          "تعرض هذه المعاينة جميع سعات الاستضافة المجمعة داخل هذه الشريحة السوقية.",
        multi_platform_scope:
          "تجمع هذه المعاينة بيانات مجمعة من عدة منصات حجز.",
        limited_sample_size:
          "لا تزال العينة الحالية محدودة لهذه الشريحة السوقية.",
        limited_source_diversity:
          "تعتمد العينة الحالية على مجموعة محدودة من مصادر السوق.",
        aging_data:
          "بدأ جزء من بيانات السوق المجمعة يشيخ.",
        multi_currency_market:
          "توجد عدة عملات متنافسة في هذا السوق، لذلك لا يمكن تقديم معاينة موثوقة من دون سياق إضافي.",
      },
      recommendationCodes: {
        median_positions_market:
          "يساعد الوسيط المرصود على فهم المستوى السعري المركزي في هذا السوق.",
        broader_segment_used:
          "تعتمد هذه المعاينة على شريحة سوقية أوسع من النوع المطلوب بدقة.",
        listing_specific_factors_matter:
          "الصور والمرافق والموسمية والموقع قد تؤثر كثيرا في السعر المناسب.",
        full_audit_for_positioning:
          "سيحلل التدقيق الكامل إعلانك والمنافسين الحقيقيين لتحديد تموضعك الدقيق.",
      },
    },
    premium: {
      rangeLabel: "النطاق المرصود",
      marketMedianLabel: "وسيط السوق",
      marketNowTitle: "السوق الحالي",
      lowPriceLabel: "السعر المنخفض",
      medianPriceLabel: "السعر الوسيط",
      highPriceLabel: "السعر المرتفع",
      compareToMarketCta: "قارن إعلاني بهذا السوق",
      revealTitle: "ما الذي سيكشفه التدقيق الكامل؟",
      revealSubtitle:
        "تعرض لك المعاينة المجانية وضع السوق، بينما يحلل التدقيق الكامل إعلانك الحقيقي.",
      revealCards: [
        {
          title: "الموقع الحقيقي لإعلانك",
          text:
            "قارن إعلانك بالمنافسين وحدد موقعه بدقة.",
        },
        {
          title: "إمكاناتك السعرية",
          text:
            "اكتشف مستوى الأسعار المناسب لعقارك ولموسمك.",
        },
        {
          title: "عوامل تحسين التحويل",
          text:
            "حلل العنوان والوصف والصور والمرافق وكل ما يؤثر على الحجوزات.",
        },
        {
          title: "إجراءاتك ذات الأولوية",
          text:
            "احصل على خطة عمل مرتبة حسب التأثير المتوقع.",
        },
      ],
      journeyTitle: "رحلتك مع Norixo",
      journeySteps: [
        {
          title: "معاينة مجانية للسوق",
          text: "اكتشف النطاق السعري ومتوسط السوق.",
        },
        {
          title: "تحليل كامل للإعلان",
          text:
            "تحلل Norixo إعلانك ومنافسيك وموقعك.",
        },
        {
          title: "خطة عمل مخصصة",
          text: "احصل على توصيات عملية مرتبة حسب الأولوية.",
        },
      ],
      unlockCta: "افتح التدقيق الكامل",
    },
    clarity: {
      title: "فهم المعاينة المجانية",
      cards: [
        {
          title: "ما الذي تحصل عليه مجانا",
          text: "هذه المرحلة هي معاينة عامة للسوق وليست بعد تدقيقا كاملا مخصصا لإعلانك.",
          items: [
            "النطاق السعري المرصود لفئتك",
            "وسيط السوق ومستوى الثقة",
            "إشارات التغطية والقيود الخاصة بهذا السوق",
          ],
        },
        {
          title: "ما الذي لا يتم تحليله بعد",
          text: "لا تفحص Norixo المحتوى الخاص لإعلانك قبل بدء التدقيق الكامل.",
          items: [
            "لا تتم مراجعة العنوان أو الوصف أو الصور أو المرافق بعد",
            "لا يتم تحليل سعرك الخاص بعد",
            "لا توجد بعد تشخيصات كاملة للمنافسين أو خطة عمل في هذه المرحلة",
          ],
        },
        {
          title: "لماذا تعد هذه النتائج موثوقة",
          text: "تعتمد هذه المعاينة على معايير سوق عامة ومجمعة تختارها قواعد Intelligence في Norixo لسوقك.",
          items: [
            "يتم استخدام بيانات سوق مجمعة ومجهولة الهوية فقط",
            "لا يتم نشر بيانات المستخدمين الخاصة ولا إعادة استخدامها علنا",
            "قد تختلف التغطية بحسب المدينة والمنصة ونوع العقار",
          ],
        },
        {
          title: "لماذا تحتاج إلى إنشاء حساب بعد ذلك",
          text: "يتيح الحساب لـ Norixo الانتقال بشكل آمن من هذه المعاينة إلى مسار التدقيق الكامل.",
          items: [
            "حفظ سياق الاستئناف",
            "بدء التدقيق الكامل من لوحة التحكم",
            "العثور لاحقا على عمليات التدقيق والمشتريات",
          ],
        },
      ],
    },
    compare: {
      title: "المعاينة المجانية مقابل التدقيق الكامل",
      freeTitle: "معاينة سوق مجانية",
      fullTitle: "تدقيق كامل",
      freeItems: [
        "نطاق أسعار سوقي مجمع",
        "وسيط السوق",
        "مستوى الثقة",
        "توصيات عامة",
        "من دون تحليل محتوى الإعلان",
      ],
      fullItems: [
        "تحليل فعلي للإعلان",
        "العنوان والوصف",
        "الصور والمرافق",
        "المنافسون الحقيقيون",
        "فرص التحويل",
        "توصيات مخصصة",
        "تحليل تسعير كامل",
        "تحليل الإشغال عند توفره",
      ],
    },
    faq: {
      title: "الاسئلة الشائعة",
      items: [
        {
          question: "هل المعاينة المجانية مجانية فعلا؟",
          answer:
            "نعم. معاينة السوق لا تتطلب بطاقة مصرفية ولا تستهلك اي رصيد لتدقيق مدفوع.",
        },
        {
          question: "هل تتصل Norixo بحسابي على Airbnb او Booking؟",
          answer:
            "لا. تستخدم المعاينة المجانية معلومات سوق منظمة فقط ولا تتطلب اي اتصال بحسابك.",
        },
        {
          question: "هل يتم استخراج إعلاني خلال المعاينة المجانية؟",
          answer:
            "لا. في هذه المرحلة لا تطلق Norixo اي استخراج كامل للإعلان ولا تحلل محتوى إعلانك بعد.",
        },
        {
          question: "من اين تأتي البيانات المعروضة؟",
          answer:
            "يتم بناء المعاينة انطلاقا من معايير سوق عامة مجمعة تم اختيارها لقطاع السوق المطلوب.",
        },
        {
          question: "لماذا يكون التدقيق الكامل مدفوعا؟",
          answer:
            "لأن التدقيق المدفوع يتجاوز المعيار العام ويحلل إعلانك الحقيقي ومحتواه وتموضعه والإجراءات ذات الأولوية.",
        },
        {
          question: "ماذا يحدث إذا كانت تغطية السوق غير كافية بعد؟",
          answer:
            "توضح Norixo أن التغطية غير كافية بدلا من الادعاء بدقة لا تسمح بها المعايير العامة حتى الآن.",
        },
      ],
    },
    cta: {
      title: "هل أنت مستعد لفتح التدقيق الكامل؟",
      text: "انتقل من لقطة للسوق إلى التدقيق الكامل لإعلانك مع Norixo.",
      primary: "فتح التدقيق الكامل",
      secondary: "ابدأ من إعلانك الحقيقي",
      reassurance: "احصل على تموضعك الدقيق وتوصيات مخصصة.",
    },
    seo: {
      title: "فحص Airbnb مجاني للسوق: قارن الأسعار | Norixo",
      description:
        "تحقق مجانا من نطاق الأسعار والوسيط في سوقك اعتمادا على بيانات مجمعة، من دون استخراج البيانات ومن دون بطاقة مصرفية.",
    },
  },
} as const satisfies Record<Locale, FreeAuditTranslation>;

export type FreeAuditTranslationCopy = (typeof freeAuditTranslations)[Locale];

export function getFreeAuditTranslation(locale: Locale): FreeAuditTranslationCopy {
  return freeAuditTranslations[locale] ?? freeAuditTranslations[defaultLocale];
}

export function getFreeAuditSeoCopy(locale: Locale) {
  return getFreeAuditTranslation(locale).seo;
}
