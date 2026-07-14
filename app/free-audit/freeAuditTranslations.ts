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
    benchmarkRange: string;
    medianPrice: string;
    marketTitle: string;
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
  compare: Readonly<{
    title: string;
    freeTitle: string;
    fullTitle: string;
    freeItems: readonly string[];
    fullItems: readonly string[];
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
      eyebrow: "Free audit preview",
      title: "Discover a market-only pricing snapshot",
      subtitle:
        "See the observed market range and median available for your listing category before launching a full audit.",
      reassurance:
        "No credit card. No scraping. No listing content or personal price is reviewed at this stage.",
    },
    form: {
      title: "Structured market preview",
      text:
        "Fill in the structured details below to receive a market-only benchmark preview.",
      listingUrlLabel: "Listing URL (optional)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Country",
      countryPlaceholder: "France",
      cityLabel: "City",
      cityPlaceholder: "Paris",
      platformLabel: "Platform",
      platformPlaceholder: "Select a platform",
      propertyTypeLabel: "Property type",
      propertyTypePlaceholder: "Select a property type",
      submitIdle: "See my free analysis",
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
      benchmarkRange: "Observed range",
      medianPrice: "Median",
      marketTitle: "Market snapshot",
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
        multi_currency_market:
          "Several competing currencies exist in this market and prevent an honest preview without extra context.",
      },
      recommendationCodes: {
        median_positions_market:
          "The observed median helps position the central level of this market.",
        listing_specific_factors_matter:
          "Photos, amenities, seasonality, and location can materially shift the right price.",
        full_audit_for_positioning:
          "A full audit will analyze your listing and real competitors to determine your exact positioning.",
      },
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
        "Check your market price range and median for free using aggregated data, with no scraping and no credit card.",
    },
  },
  fr: {
    hero: {
      eyebrow: "Apercu gratuit",
      title: "Decouvrez un apercu tarifaire du marche",
      subtitle:
        "Visualisez la fourchette observee et la mediane de votre categorie avant de lancer un audit complet.",
      reassurance:
        "Aucune carte bancaire. Aucun scraping. Aucun contenu ni prix personnel de votre annonce n'est consulte.",
    },
    form: {
      title: "Apercu du marche",
      text:
        "Renseignez les informations structurees ci-dessous pour recevoir un apercu fonde uniquement sur les benchmarks agreges du marche.",
      listingUrlLabel: "URL de l'annonce (facultative)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Pays",
      countryPlaceholder: "France",
      cityLabel: "Ville",
      cityPlaceholder: "Paris",
      platformLabel: "Plateforme",
      platformPlaceholder: "Selectionnez une plateforme",
      propertyTypeLabel: "Type de logement",
      propertyTypePlaceholder: "Selectionnez un type de logement",
      submitIdle: "Voir mon analyse gratuite",
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
      benchmarkRange: "Fourchette observee",
      medianPrice: "Mediane",
      marketTitle: "Instantane du marche",
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
        multi_currency_market:
          "Plusieurs devises concurrentes existent sur ce marche et ne permettent pas un apercu fiable sans contexte supplementaire.",
      },
      recommendationCodes: {
        median_positions_market:
          "La mediane observee permet de situer le niveau central de ce marche.",
        listing_specific_factors_matter:
          "Les photos, les equipements, la saisonnalite et l'emplacement peuvent fortement faire varier le bon prix.",
        full_audit_for_positioning:
          "L'audit complet analysera votre annonce et vos concurrents reels pour determiner votre positionnement exact.",
      },
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
        "Consultez gratuitement la fourchette de prix et la mediane de votre marche avec des donnees agregees, sans scraping ni carte bancaire.",
    },
  },
  es: {
    hero: {
      eyebrow: "Vista previa gratuita",
      title: "Descubre una vista tarifaria basada solo en el mercado",
      subtitle:
        "Consulta el rango de precios observado y la mediana disponible para tu categoria antes de lanzar una auditoria completa.",
      reassurance:
        "Sin tarjeta bancaria. Sin scraping. No se analiza el contenido del anuncio ni tu precio personal en esta etapa.",
    },
    form: {
      title: "Vista estructurada del mercado",
      text:
        "Completa los datos estructurados a continuacion para recibir una vista previa basada unicamente en benchmarks agregados del mercado.",
      listingUrlLabel: "URL del anuncio (opcional)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Pais",
      countryPlaceholder: "Espana",
      cityLabel: "Ciudad",
      cityPlaceholder: "Barcelona",
      platformLabel: "Plataforma",
      platformPlaceholder: "Selecciona una plataforma",
      propertyTypeLabel: "Tipo de alojamiento",
      propertyTypePlaceholder: "Selecciona un tipo de alojamiento",
      submitIdle: "Ver mi analisis gratuito",
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
      benchmarkRange: "Rango observado",
      medianPrice: "Mediana",
      marketTitle: "Instantanea del mercado",
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
        multi_currency_market:
          "Existen varias divisas en competencia en este mercado y no permiten una vista honesta sin contexto adicional.",
      },
      recommendationCodes: {
        median_positions_market:
          "La mediana observada ayuda a situar el nivel central de este mercado.",
        listing_specific_factors_matter:
          "Las fotos, los servicios, la estacionalidad y la ubicacion pueden modificar de forma importante el precio adecuado.",
        full_audit_for_positioning:
          "La auditoria completa analizara tu anuncio y a tus competidores reales para definir tu posicionamiento exacto.",
      },
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
        "Consulta gratis el rango de precios y la mediana de tu mercado con datos agregados, sin scraping ni tarjeta bancaria.",
    },
  },
  it: {
    hero: {
      eyebrow: "Anteprima gratuita",
      title: "Scopri una panoramica prezzi basata solo sul mercato",
      subtitle:
        "Visualizza l'intervallo di prezzo osservato e la mediana disponibile per la tua categoria prima di avviare un audit completo.",
      reassurance:
        "Nessuna carta di credito. Nessuno scraping. In questa fase non vengono analizzati ne il contenuto dell'annuncio ne il tuo prezzo personale.",
    },
    form: {
      title: "Panoramica strutturata del mercato",
      text:
        "Compila i dettagli strutturati qui sotto per ricevere un'anteprima basata esclusivamente su benchmark di mercato aggregati.",
      listingUrlLabel: "URL dell'annuncio (facoltativo)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Paese",
      countryPlaceholder: "Italia",
      cityLabel: "Citta",
      cityPlaceholder: "Roma",
      platformLabel: "Piattaforma",
      platformPlaceholder: "Seleziona una piattaforma",
      propertyTypeLabel: "Tipologia di alloggio",
      propertyTypePlaceholder: "Seleziona una tipologia di alloggio",
      submitIdle: "Vedi la mia analisi gratuita",
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
      unavailable: "L'anteprima gratuita non e temporaneamente disponibile.",
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
      benchmarkRange: "Intervallo osservato",
      medianPrice: "Mediana",
      marketTitle: "Panoramica del mercato",
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
        multi_currency_market:
          "In questo mercato coesistono piu valute e non consentono un'anteprima affidabile senza ulteriore contesto.",
      },
      recommendationCodes: {
        median_positions_market:
          "La mediana osservata aiuta a collocare il livello centrale di questo mercato.",
        listing_specific_factors_matter:
          "Foto, servizi, stagionalita e posizione possono modificare in modo significativo il prezzo corretto.",
        full_audit_for_positioning:
          "L'audit completo analizzera il tuo annuncio e i concorrenti reali per determinare il tuo posizionamento esatto.",
      },
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
        "Consulta gratuitamente fascia di prezzo e mediana del tuo mercato con dati aggregati, senza scraping e senza carta di credito.",
    },
  },
  pt: {
    hero: {
      eyebrow: "Pre-visualizacao gratuita",
      title: "Descubra uma visao de precos baseada apenas no mercado",
      subtitle:
        "Veja a faixa de precos observada e a mediana disponivel para a sua categoria antes de iniciar uma auditoria completa.",
      reassurance:
        "Sem cartao de credito. Sem scraping. Nesta fase nao analisamos o conteudo do anuncio nem o seu preco individual.",
    },
    form: {
      title: "Visao estruturada do mercado",
      text:
        "Preencha os dados estruturados abaixo para receber uma pre-visualizacao baseada apenas em benchmarks agregados do mercado.",
      listingUrlLabel: "URL do anuncio (opcional)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Pais",
      countryPlaceholder: "Portugal",
      cityLabel: "Cidade",
      cityPlaceholder: "Lisboa",
      platformLabel: "Plataforma",
      platformPlaceholder: "Selecione uma plataforma",
      propertyTypeLabel: "Tipo de alojamento",
      propertyTypePlaceholder: "Selecione um tipo de alojamento",
      submitIdle: "Ver a minha analise gratuita",
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
      benchmarkRange: "Faixa observada",
      medianPrice: "Mediana",
      marketTitle: "Panorama do mercado",
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
        multi_currency_market:
          "Existem varias moedas concorrentes neste mercado e isso impede uma pre-visualizacao fiavel sem contexto adicional.",
      },
      recommendationCodes: {
        median_positions_market:
          "A mediana observada ajuda a posicionar o nivel central deste mercado.",
        listing_specific_factors_matter:
          "Fotos, comodidades, sazonalidade e localizacao podem alterar materialmente o preco adequado.",
        full_audit_for_positioning:
          "A auditoria completa analisara o seu anuncio e os concorrentes reais para determinar o seu posicionamento exato.",
      },
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
        "Consulte gratuitamente a faixa de precos e a mediana do seu mercado com dados agregados, sem scraping e sem cartao de credito.",
    },
  },
  nl: {
    hero: {
      eyebrow: "Gratis preview",
      title: "Ontdek een prijsbeeld dat alleen op de markt is gebaseerd",
      subtitle:
        "Bekijk de waargenomen prijsvork en mediaan voor jouw categorie voordat je een volledige audit start.",
      reassurance:
        "Geen creditcard. Geen scraping. In deze stap wordt geen advertentie-inhoud of persoonlijke prijs geanalyseerd.",
    },
    form: {
      title: "Gestructureerde marktpreview",
      text:
        "Vul hieronder de gestructureerde gegevens in om een preview te ontvangen die uitsluitend op geaggregeerde marktbenchmarks is gebaseerd.",
      listingUrlLabel: "Advertentie-URL (optioneel)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Land",
      countryPlaceholder: "Nederland",
      cityLabel: "Stad",
      cityPlaceholder: "Amsterdam",
      platformLabel: "Platform",
      platformPlaceholder: "Selecteer een platform",
      propertyTypeLabel: "Accommodatietype",
      propertyTypePlaceholder: "Selecteer een accommodatietype",
      submitIdle: "Bekijk mijn gratis analyse",
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
      benchmarkRange: "Waargenomen bereik",
      medianPrice: "Mediaan",
      marketTitle: "Marktsnapshot",
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
        multi_currency_market:
          "Er zijn meerdere concurrerende valuta in deze markt, waardoor een eerlijke preview zonder extra context niet mogelijk is.",
      },
      recommendationCodes: {
        median_positions_market:
          "De waargenomen mediaan helpt het centrale niveau van deze markt te bepalen.",
        listing_specific_factors_matter:
          "Foto's, voorzieningen, seizoensinvloeden en locatie kunnen de juiste prijs merkbaar verschuiven.",
        full_audit_for_positioning:
          "De volledige audit analyseert je advertentie en echte concurrenten om je exacte positionering te bepalen.",
      },
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
        "Bekijk gratis de prijsvork en mediaan van jouw markt met geaggregeerde data, zonder scraping en zonder creditcard.",
    },
  },
  de: {
    hero: {
      eyebrow: "Kostenlose Vorschau",
      title: "Entdecken Sie einen Marktuberblick auf Basis aggregierter Preise",
      subtitle:
        "Sehen Sie die beobachtete Preisspanne und den Median Ihrer Kategorie, bevor Sie ein vollstandiges Audit starten.",
      reassurance:
        "Keine Kreditkarte. Kein Scraping. In dieser Phase werden weder der Inhalt Ihrer Anzeige noch Ihr individueller Preis analysiert.",
    },
    form: {
      title: "Strukturierte Marktvorschau",
      text:
        "Geben Sie unten die strukturierten Angaben ein, um eine Vorschau zu erhalten, die ausschliesslich auf aggregierten Marktbenchmarks basiert.",
      listingUrlLabel: "Inserats-URL (optional)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "Land",
      countryPlaceholder: "Deutschland",
      cityLabel: "Stadt",
      cityPlaceholder: "Berlin",
      platformLabel: "Plattform",
      platformPlaceholder: "Plattform auswahlen",
      propertyTypeLabel: "Unterkunftsart",
      propertyTypePlaceholder: "Unterkunftsart auswahlen",
      submitIdle: "Meine kostenlose Analyse ansehen",
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
      benchmarkRange: "Beobachtete Spanne",
      medianPrice: "Median",
      marketTitle: "Marktsnapshot",
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
        multi_currency_market:
          "In diesem Markt existieren mehrere konkurrierende Wahrungen, sodass ohne zusatzlichen Kontext keine verlassliche Vorschau moglich ist.",
      },
      recommendationCodes: {
        median_positions_market:
          "Der beobachtete Median hilft dabei, das zentrale Preisniveau dieses Marktes einzuordnen.",
        listing_specific_factors_matter:
          "Fotos, Ausstattung, Saisonverlauf und Lage konnen den passenden Preis deutlich beeinflussen.",
        full_audit_for_positioning:
          "Das vollstandige Audit analysiert Ihr Inserat und reale Wettbewerber, um Ihre genaue Positionierung zu bestimmen.",
      },
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
        "Vergleichen Sie kostenlos Preisspanne und Median Ihres Marktes anhand aggregierter Daten - ohne Scraping und ohne Kreditkarte.",
    },
  },
  ja: {
    hero: {
      eyebrow: "無料プレビュー",
      title: "市場データだけで価格感をすばやく把握",
      subtitle:
        "完全監査を始める前に、あなたのカテゴリで観測された価格帯と中央値を確認できます。",
      reassurance:
        "クレジットカード不要。スクレイピングなし。この段階では掲載内容やあなた自身の価格は分析しません。",
    },
    form: {
      title: "市場プレビュー",
      text:
        "以下の構造化情報を入力すると、集約された市場ベンチマークだけに基づくプレビューを受け取れます。",
      listingUrlLabel: "掲載URL（任意）",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "国",
      countryPlaceholder: "日本",
      cityLabel: "都市",
      cityPlaceholder: "東京",
      platformLabel: "プラットフォーム",
      platformPlaceholder: "プラットフォームを選択",
      propertyTypeLabel: "宿泊タイプ",
      propertyTypePlaceholder: "宿泊タイプを選択",
      submitIdle: "無料分析を見る",
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
      benchmarkRange: "観測レンジ",
      medianPrice: "中央値",
      marketTitle: "市場スナップショット",
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
        multi_currency_market:
          "この市場では複数の通貨が混在しており、追加情報なしでは信頼できるプレビューを提示できません。",
      },
      recommendationCodes: {
        median_positions_market:
          "観測された中央値は、この市場の中心的な価格水準を把握するのに役立ちます。",
        listing_specific_factors_matter:
          "写真、設備、季節性、立地によって適正価格は大きく左右されます。",
        full_audit_for_positioning:
          "完全監査では、掲載内容と実際の競合を分析し、正確なポジショニングを明らかにします。",
      },
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
        "集約データを使って、市場の価格帯と中央値を無料で確認できます。スクレイピング不要、クレジットカード不要です。",
    },
  },
  zh: {
    hero: {
      eyebrow: "免费预览",
      title: "快速查看仅基于市场数据的价格概览",
      subtitle:
        "在开始完整审计之前，先查看你所在类别的市场价格区间和中位数。",
      reassurance:
        "无需信用卡。无需抓取页面。这个阶段不会分析你的房源内容或个人定价。",
    },
    form: {
      title: "市场预览",
      text:
        "填写下方结构化信息，即可获得仅基于聚合市场基准数据的预览。",
      listingUrlLabel: "房源链接（可选）",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "国家",
      countryPlaceholder: "中国",
      cityLabel: "城市",
      cityPlaceholder: "上海",
      platformLabel: "平台",
      platformPlaceholder: "选择平台",
      propertyTypeLabel: "房源类型",
      propertyTypePlaceholder: "选择房源类型",
      submitIdle: "查看我的免费分析",
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
      benchmarkRange: "观察到的区间",
      medianPrice: "中位数",
      marketTitle: "市场快照",
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
        multi_currency_market:
          "该市场存在多种竞争货币，没有额外上下文时无法给出可靠预览。",
      },
      recommendationCodes: {
        median_positions_market:
          "观察到的中位数有助于判断该市场的中心价格水平。",
        listing_specific_factors_matter:
          "照片、设施、季节性和位置都会显著影响合理定价。",
        full_audit_for_positioning:
          "完整审计将分析你的房源与真实竞品，以确定你的精确市场定位。",
      },
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
        "使用聚合数据免费查看你所在市场的价格区间和中位数，无需抓取页面，也无需信用卡。",
    },
  },
  ko: {
    hero: {
      eyebrow: "무료 미리보기",
      title: "시장 데이터만으로 가격 포지션을 빠르게 확인하세요",
      subtitle:
        "전체 감사를 시작하기 전에 해당 카테고리의 관측 가격 범위와 중앙값을 확인할 수 있습니다.",
      reassurance:
        "신용카드가 필요 없습니다. 스크래핑도 하지 않습니다. 이 단계에서는 숙소 콘텐츠나 개인 가격을 분석하지 않습니다.",
    },
    form: {
      title: "시장 미리보기",
      text:
        "아래의 구조화된 정보를 입력하면 집계된 시장 벤치마크에만 기반한 미리보기를 받을 수 있습니다.",
      listingUrlLabel: "숙소 URL (선택 사항)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "국가",
      countryPlaceholder: "대한민국",
      cityLabel: "도시",
      cityPlaceholder: "서울",
      platformLabel: "플랫폼",
      platformPlaceholder: "플랫폼 선택",
      propertyTypeLabel: "숙소 유형",
      propertyTypePlaceholder: "숙소 유형 선택",
      submitIdle: "무료 분석 보기",
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
      benchmarkRange: "관측 범위",
      medianPrice: "중앙값",
      marketTitle: "시장 스냅샷",
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
        multi_currency_market:
          "이 시장에는 여러 통화가 혼재해 있어 추가 맥락 없이는 신뢰할 수 있는 미리보기를 제공할 수 없습니다.",
      },
      recommendationCodes: {
        median_positions_market:
          "관측된 중앙값은 이 시장의 중심 가격대를 파악하는 데 도움이 됩니다.",
        listing_specific_factors_matter:
          "사진, 편의시설, 계절성, 위치는 적정 가격에 큰 영향을 줄 수 있습니다.",
        full_audit_for_positioning:
          "전체 감사는 숙소와 실제 경쟁 숙소를 분석해 정확한 포지셔닝을 파악합니다.",
      },
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
        "집계 데이터를 기반으로 시장 가격 범위와 중앙값을 무료로 확인하세요. 스크래핑도, 신용카드도 필요 없습니다.",
    },
  },
  ar: {
    hero: {
      eyebrow: "معاينة مجانية",
      title: "اكتشف لمحة سعرية مبنية على بيانات السوق فقط",
      subtitle:
        "اطّلع على نطاق الأسعار المرصود والوسيط لفئتك قبل بدء التدقيق الكامل.",
      reassurance:
        "من دون بطاقة مصرفية. من دون scraping. لا يتم تحليل محتوى إعلانك ولا سعرك الفردي في هذه المرحلة.",
    },
    form: {
      title: "معاينة منظمة للسوق",
      text:
        "املأ البيانات المنظمة أدناه للحصول على معاينة تعتمد فقط على مؤشرات السوق المجمعة.",
      listingUrlLabel: "رابط الإعلان (اختياري)",
      listingUrlPlaceholder: "https://www.airbnb.com/rooms/123456789",
      countryLabel: "البلد",
      countryPlaceholder: "المغرب",
      cityLabel: "المدينة",
      cityPlaceholder: "مراكش",
      platformLabel: "المنصة",
      platformPlaceholder: "اختر منصة",
      propertyTypeLabel: "نوع الإقامة",
      propertyTypePlaceholder: "اختر نوع الإقامة",
      submitIdle: "عرض تحليلي المجاني",
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
      benchmarkRange: "النطاق المرصود",
      medianPrice: "الوسيط",
      marketTitle: "لقطة السوق",
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
        multi_currency_market:
          "توجد عدة عملات متنافسة في هذا السوق، لذلك لا يمكن تقديم معاينة موثوقة من دون سياق إضافي.",
      },
      recommendationCodes: {
        median_positions_market:
          "يساعد الوسيط المرصود على فهم المستوى السعري المركزي في هذا السوق.",
        listing_specific_factors_matter:
          "الصور والمرافق والموسمية والموقع قد تؤثر كثيرا في السعر المناسب.",
        full_audit_for_positioning:
          "سيحلل التدقيق الكامل إعلانك والمنافسين الحقيقيين لتحديد تموضعك الدقيق.",
      },
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
        "تحقق مجانا من نطاق الأسعار والوسيط في سوقك اعتمادا على بيانات مجمعة، من دون scraping ومن دون بطاقة مصرفية.",
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
