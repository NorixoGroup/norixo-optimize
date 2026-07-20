import type { Locale } from "@/data/i18n";

export type AuthorityTrustVariant = "home" | "pricing" | "freeAudit";

export type AuthorityTrustCopy = Readonly<{
  eyebrow: string;
  title: string;
  intro: string;
  pillars: readonly Readonly<{
    title: string;
    text: string;
  }>[];
  privacyTitle: string;
  privacyText: string;
  limitsTitle: string;
  limitsText: string;
}>;

export const authorityTrustI18n = {
  en: {
    home: {
      eyebrow: "TRUST LAYER",
      title: "How Norixo explains a result instead of only generating one",
      intro:
        "Norixo combines observable market signals, structured calculations and listing context so each recommendation can be read as a decision aid, not as a black-box opinion.",
      pillars: [
        {
          title: "Public market data",
          text:
            "Norixo starts from observable listing and market signals rather than relying on broad generic prompts alone.",
        },
        {
          title: "Calculated signals",
          text:
            "Scores and recommendations are organized from calculated pricing, conversion and positioning signals.",
        },
        {
          title: "Aggregated benchmarks",
          text:
            "Public intelligence is built from aggregated benchmark layers designed to describe a market, not to expose a single listing.",
        },
        {
          title: "Private audit context",
          text:
            "A paid audit adds your real listing context so the action plan stays specific to your property and workspace.",
        },
      ],
      privacyTitle: "Privacy and confidentiality",
      privacyText:
        "Public market intelligence uses aggregated market inputs where relevant. Private audit content stays in your workspace and is not published as a public listing example.",
      limitsTitle: "What this analysis does not do",
      limitsText:
        "Norixo supports decisions, but it does not guarantee revenue, ranking or occupancy. Real performance still depends on the property, pricing, photos, demand and competition.",
    },
    pricing: {
      eyebrow: "METHODOLOGY",
      title: "What you are paying for in a Norixo audit",
      intro:
        "The paid audit is valuable because it connects a real listing to structured market context, calculated signals and prioritized actions instead of returning generic advice only.",
      pillars: [
        {
          title: "Real listing inputs",
          text:
            "The audit reads the listing you choose and evaluates the visible elements that influence positioning and conversion.",
        },
        {
          title: "Structured analysis",
          text:
            "Norixo organizes pricing, trust, content and positioning signals into a readable audit instead of a free-form answer.",
        },
        {
          title: "Benchmark context",
          text:
            "When relevant, market benchmarks are used to frame price and positioning decisions with aggregated context.",
        },
        {
          title: "Prioritized action plan",
          text:
            "Recommendations are ordered so you can act on the highest-leverage changes first, without guessing what matters most.",
        },
      ],
      privacyTitle: "Your audit remains private",
      privacyText:
        "Workspace data and paid audit content stay private. Public benchmark layers may inform market context, but client listings are not published as public results.",
      limitsTitle: "What payment does not buy",
      limitsText:
        "A Norixo audit is a decision-support product. It does not promise guaranteed revenue, occupancy or ranking improvements, and it does not auto-edit or auto-publish your listing.",
    },
    freeAudit: {
      eyebrow: "MARKET PREVIEW METHOD",
      title: "What the free market preview is based on",
      intro:
        "The free preview is intentionally narrower than the full audit. It shows an aggregated market reference point for a market segment before any listing-specific analysis begins.",
      pillars: [
        {
          title: "Observed market range",
          text:
            "The preview starts from the aggregated market data currently available for the selected market segment.",
        },
        {
          title: "Calculated median",
          text:
            "Norixo surfaces a central market price point to make the range easier to interpret at a glance.",
        },
        {
          title: "Confidence and limits",
          text:
            "Confidence and limitation labels explain when the preview is broad, partial or based on lighter coverage.",
        },
        {
          title: "Full audit boundary",
          text:
            "The free preview does not analyze your title, photos, description or real positioning. That deeper reading starts only in the full audit.",
        },
      ],
      privacyTitle: "What stays private",
      privacyText:
        "The preview uses market-level aggregated data where available. Your personal listing strategy and any future paid audit content remain private and are not published.",
      limitsTitle: "What the preview does not claim",
      limitsText:
        "This preview is not a guaranteed pricing recommendation. It is an initial market reference point, and real performance still depends on the property, positioning, photos, pricing and competition.",
    },
  },
  fr: {
    home: {
      eyebrow: "METHODOLOGIE",
      title: "Pourquoi Norixo peut expliquer un résultat, pas seulement en générer un",
      intro:
        "Norixo combine des signaux de marché observables, des calculs structurés et le contexte de l’annonce afin que chaque recommandation puisse se lire comme une aide à la décision, et non comme une opinion opaque.",
      pillars: [
        {
          title: "Données de marché publiques",
          text:
            "Norixo s’appuie d’abord sur des signaux observables d’annonce et de marché, plutôt que sur des prompts génériques sans contexte.",
        },
        {
          title: "Signaux calculés",
          text:
            "Les scores et recommandations sont structurés à partir de signaux calculés de pricing, de conversion et de positionnement.",
        },
        {
          title: "Benchmarks agrégés",
          text:
            "L’intelligence publique repose sur des couches de benchmarks agrégés conçues pour décrire un marché, pas pour exposer une annonce isolée.",
        },
        {
          title: "Contexte d’audit privé",
          text:
            "Un audit payant ajoute le contexte réel de votre annonce afin que le plan d’action reste spécifique à votre logement et à votre workspace.",
        },
      ],
      privacyTitle: "Confidentialité et vie privée",
      privacyText:
        "L’intelligence marché publique utilise des données agrégées quand c’est pertinent. Le contenu d’un audit privé reste dans votre workspace et n’est pas publié comme exemple public.",
      limitsTitle: "Ce que l’analyse ne fait pas",
      limitsText:
        "Norixo aide à décider, mais ne garantit ni revenus, ni classement, ni taux d’occupation. Les performances réelles dépendent aussi du logement, du prix, des photos, de la demande et de la concurrence.",
    },
    pricing: {
      eyebrow: "METHODOLOGIE",
      title: "Ce que vous payez réellement dans un audit Norixo",
      intro:
        "La valeur de l’audit payant vient du lien entre une annonce réelle, un contexte marché structuré, des signaux calculés et des actions priorisées, et non d’un simple texte générique.",
      pillars: [
        {
          title: "Annonce réelle analysée",
          text:
            "L’audit lit l’annonce choisie et évalue les éléments visibles qui influencent le positionnement et la conversion.",
        },
        {
          title: "Analyse structurée",
          text:
            "Norixo organise les signaux de pricing, de confiance, de contenu et de positionnement dans un audit lisible, plutôt qu’une réponse libre.",
        },
        {
          title: "Contexte benchmark",
          text:
            "Quand c’est pertinent, des benchmarks de marché encadrent les décisions de prix et de positionnement avec un contexte agrégé.",
        },
        {
          title: "Plan d’action priorisé",
          text:
            "Les recommandations sont ordonnées pour vous aider à agir d’abord sur les changements les plus utiles.",
        },
      ],
      privacyTitle: "Votre audit reste privé",
      privacyText:
        "Les données du workspace et le contenu de l’audit payant restent privés. Les couches de benchmark public peuvent nourrir le contexte marché, mais les annonces clientes ne sont pas publiées.",
      limitsTitle: "Ce que le paiement n’achète pas",
      limitsText:
        "Un audit Norixo est un outil d’aide à la décision. Il ne promet pas une hausse garantie du revenu, du taux d’occupation ou du classement, et ne modifie pas automatiquement votre annonce.",
    },
    freeAudit: {
      eyebrow: "METHODE DE L’APERÇU",
      title: "Sur quoi repose l’aperçu marché gratuit",
      intro:
        "L’aperçu gratuit est volontairement plus étroit que l’audit complet. Il montre un point de référence agrégé pour un segment de marché avant toute analyse spécifique de votre annonce.",
      pillars: [
        {
          title: "Fourchette observée",
          text:
            "L’aperçu part des données de marché agrégées actuellement disponibles pour le segment sélectionné.",
        },
        {
          title: "Médiane calculée",
          text:
            "Norixo met en avant un niveau de prix central pour rendre la lecture de la fourchette plus claire.",
        },
        {
          title: "Confiance et limites",
          text:
            "Les niveaux de confiance et les limitations indiquent quand l’aperçu reste large, partiel ou fondé sur une couverture plus légère.",
        },
        {
          title: "Frontière avec l’audit complet",
          text:
            "L’aperçu gratuit n’analyse ni votre titre, ni vos photos, ni votre description, ni votre positionnement réel. Cette lecture commence dans l’audit complet.",
        },
      ],
      privacyTitle: "Ce qui reste privé",
      privacyText:
        "L’aperçu utilise des données agrégées au niveau du marché lorsqu’elles existent. Votre stratégie d’annonce et tout contenu d’audit payant restent privés et ne sont pas publiés.",
      limitsTitle: "Ce que l’aperçu ne prétend pas faire",
      limitsText:
        "Cet aperçu n’est pas une recommandation tarifaire garantie. C’est un premier repère marché, et les performances réelles dépendent encore du logement, du positionnement, des photos, du prix et de la concurrence.",
    },
  },
  es: {
    home: {
      eyebrow: "METODOLOGIA",
      title: "Por que Norixo puede explicar un resultado y no solo generarlo",
      intro:
        "Norixo combina señales observables del mercado, cálculos estructurados y contexto del anuncio para que cada recomendación se entienda como ayuda a la decisión, no como una opinión opaca.",
      pillars: [
        {
          title: "Datos públicos de mercado",
          text:
            "Norixo parte de señales observables de anuncios y mercado, en lugar de depender solo de prompts generales sin contexto.",
        },
        {
          title: "Señales calculadas",
          text:
            "Las puntuaciones y recomendaciones se estructuran a partir de señales calculadas de pricing, conversión y posicionamiento.",
        },
        {
          title: "Benchmarks agregados",
          text:
            "La inteligencia pública se construye sobre capas de benchmark agregadas diseñadas para describir un mercado, no para exponer un anuncio concreto.",
        },
        {
          title: "Contexto de auditoría privada",
          text:
            "Una auditoría de pago añade el contexto real de tu anuncio para que el plan de acción siga siendo específico para tu propiedad y tu espacio de trabajo.",
        },
      ],
      privacyTitle: "Privacidad y confidencialidad",
      privacyText:
        "La inteligencia pública de mercado utiliza datos agregados cuando corresponde. El contenido de una auditoría privada permanece en tu espacio de trabajo y no se publica como ejemplo público.",
      limitsTitle: "Lo que este análisis no hace",
      limitsText:
        "Norixo ayuda a tomar decisiones, pero no garantiza ingresos, ranking ni ocupación. El rendimiento real también depende de la propiedad, el precio, las fotos, la demanda y la competencia.",
    },
    pricing: {
      eyebrow: "METODOLOGIA",
      title: "Qué estás pagando realmente en una auditoría Norixo",
      intro:
        "La auditoría de pago aporta valor porque conecta un anuncio real con contexto de mercado estructurado, señales calculadas y acciones priorizadas, en lugar de limitarse a consejos genéricos.",
      pillars: [
        {
          title: "Datos reales del anuncio",
          text:
            "La auditoría revisa el anuncio elegido y evalúa los elementos visibles que influyen en el posicionamiento y la conversión.",
        },
        {
          title: "Análisis estructurado",
          text:
            "Norixo organiza señales de pricing, confianza, contenido y posicionamiento en una auditoría legible, no en una respuesta libre.",
        },
        {
          title: "Contexto benchmark",
          text:
            "Cuando corresponde, los benchmarks de mercado aportan contexto agregado para interpretar precios y posicionamiento.",
        },
        {
          title: "Plan de acción priorizado",
          text:
            "Las recomendaciones se ordenan para que puedas actuar primero sobre los cambios con más impacto.",
        },
      ],
      privacyTitle: "Tu auditoría sigue siendo privada",
      privacyText:
        "Los datos del espacio de trabajo y el contenido de la auditoría de pago siguen siendo privados. Las capas de benchmark público pueden alimentar el contexto de mercado, pero los anuncios de clientes no se publican.",
      limitsTitle: "Lo que el pago no compra",
      limitsText:
        "Una auditoría Norixo es una ayuda a la decisión. No promete ingresos, ocupación ni ranking garantizados, y no edita ni publica tu anuncio automáticamente.",
    },
    freeAudit: {
      eyebrow: "METODO DE LA PREVIA",
      title: "En qué se basa la vista previa gratuita del mercado",
      intro:
        "La vista previa gratuita es intencionadamente más limitada que la auditoría completa. Muestra una referencia agregada de mercado para un segmento antes de cualquier análisis específico de tu anuncio.",
      pillars: [
        {
          title: "Rango observado",
          text:
            "La vista previa parte de los datos agregados de mercado disponibles actualmente para el segmento seleccionado.",
        },
        {
          title: "Mediana calculada",
          text:
            "Norixo muestra un nivel de precio central para facilitar la interpretación del rango.",
        },
        {
          title: "Confianza y límites",
          text:
            "Los niveles de confianza y las limitaciones muestran cuándo la vista previa es amplia, parcial o se basa en una cobertura más ligera.",
        },
        {
          title: "Límite frente a la auditoría completa",
          text:
            "La vista previa gratuita no analiza tu título, fotos, descripción ni posicionamiento real. Esa lectura empieza en la auditoría completa.",
        },
      ],
      privacyTitle: "Qué permanece privado",
      privacyText:
        "La vista previa utiliza datos agregados a nivel de mercado cuando están disponibles. Tu estrategia de anuncio y cualquier contenido de auditoría de pago siguen siendo privados y no se publican.",
      limitsTitle: "Lo que la vista previa no afirma",
      limitsText:
        "Esta vista previa no es una recomendación de precio garantizada. Es una referencia inicial de mercado y el rendimiento real sigue dependiendo de la propiedad, el posicionamiento, las fotos, el precio y la competencia.",
    },
  },
  it: {
    home: {
      eyebrow: "METODOLOGIA",
      title: "Perché Norixo può spiegare un risultato e non solo generarlo",
      intro:
        "Norixo combina segnali di mercato osservabili, calcoli strutturati e contesto dell’annuncio per trasformare ogni raccomandazione in un supporto decisionale, non in un’opinione opaca.",
      pillars: [
        {
          title: "Dati di mercato pubblici",
          text:
            "Norixo parte da segnali osservabili di mercato e di annuncio, invece di basarsi soltanto su prompt generici senza contesto.",
        },
        {
          title: "Segnali calcolati",
          text:
            "Punteggi e raccomandazioni sono organizzati a partire da segnali calcolati di pricing, conversione e posizionamento.",
        },
        {
          title: "Benchmark aggregati",
          text:
            "L’intelligence pubblica si basa su livelli di benchmark aggregati pensati per descrivere un mercato, non per esporre un singolo annuncio.",
        },
        {
          title: "Contesto dell’audit privato",
          text:
            "Un audit a pagamento aggiunge il contesto reale del tuo annuncio, così il piano d’azione resta specifico per la tua proprietà e il tuo workspace.",
        },
      ],
      privacyTitle: "Privacy e riservatezza",
      privacyText:
        "L’intelligence di mercato pubblica usa dati aggregati quando serve. Il contenuto di un audit privato resta nel tuo workspace e non viene pubblicato come esempio pubblico.",
      limitsTitle: "Cosa questa analisi non fa",
      limitsText:
        "Norixo aiuta a decidere, ma non garantisce ricavi, ranking o occupazione. Le performance reali dipendono anche dalla proprietà, dal prezzo, dalle foto, dalla domanda e dalla concorrenza.",
    },
    pricing: {
      eyebrow: "METODOLOGIA",
      title: "Per cosa stai davvero pagando in un audit Norixo",
      intro:
        "L’audit a pagamento crea valore perché collega un annuncio reale a un contesto di mercato strutturato, a segnali calcolati e ad azioni prioritarie, invece di limitarsi a consigli generici.",
      pillars: [
        {
          title: "Input reali dell’annuncio",
          text:
            "L’audit legge l’annuncio scelto e valuta gli elementi visibili che influenzano posizionamento e conversione.",
        },
        {
          title: "Analisi strutturata",
          text:
            "Norixo organizza segnali di pricing, fiducia, contenuto e posizionamento in un audit leggibile, non in una risposta libera.",
        },
        {
          title: "Contesto benchmark",
          text:
            "Quando serve, i benchmark di mercato aggiungono contesto aggregato per interpretare prezzi e posizionamento.",
        },
        {
          title: "Piano d’azione prioritario",
          text:
            "Le raccomandazioni sono ordinate per aiutarti ad agire prima sui cambiamenti con il maggiore effetto.",
        },
      ],
      privacyTitle: "Il tuo audit resta privato",
      privacyText:
        "I dati del workspace e il contenuto dell’audit a pagamento restano privati. I benchmark pubblici possono alimentare il contesto di mercato, ma gli annunci dei clienti non vengono pubblicati.",
      limitsTitle: "Cosa il pagamento non compra",
      limitsText:
        "Un audit Norixo è uno strumento di supporto alle decisioni. Non promette ricavi, occupazione o ranking garantiti e non modifica né pubblica automaticamente il tuo annuncio.",
    },
    freeAudit: {
      eyebrow: "METODO DELL’ANTEPRIMA",
      title: "Su cosa si basa l’anteprima gratuita del mercato",
      intro:
        "L’anteprima gratuita è volutamente più limitata dell’audit completo. Mostra un riferimento di mercato aggregato per un segmento prima di qualsiasi analisi specifica del tuo annuncio.",
      pillars: [
        {
          title: "Fascia osservata",
          text:
            "L’anteprima parte dai dati di mercato aggregati attualmente disponibili per il segmento selezionato.",
        },
        {
          title: "Mediana calcolata",
          text:
            "Norixo evidenzia un livello di prezzo centrale per rendere la fascia più semplice da interpretare.",
        },
        {
          title: "Affidabilità e limiti",
          text:
            "I livelli di affidabilità e le limitazioni mostrano quando l’anteprima è ampia, parziale o basata su una copertura più leggera.",
        },
        {
          title: "Confine con l’audit completo",
          text:
            "L’anteprima gratuita non analizza titolo, foto, descrizione o posizionamento reale. Questa lettura inizia solo con l’audit completo.",
        },
      ],
      privacyTitle: "Cosa resta privato",
      privacyText:
        "L’anteprima usa dati aggregati a livello di mercato quando disponibili. La tua strategia di annuncio e qualsiasi contenuto di audit a pagamento restano privati e non vengono pubblicati.",
      limitsTitle: "Cosa l’anteprima non promette",
      limitsText:
        "Questa anteprima non è una raccomandazione di prezzo garantita. È un primo riferimento di mercato e le performance reali dipendono comunque dalla proprietà, dal posizionamento, dalle foto, dal prezzo e dalla concorrenza.",
    },
  },
  pt: {
    home: {
      eyebrow: "METODOLOGIA",
      title: "Porque a Norixo consegue explicar um resultado, e não apenas gerá-lo",
      intro:
        "A Norixo combina sinais observáveis de mercado, cálculos estruturados e contexto do anúncio para que cada recomendação funcione como apoio à decisão, e não como uma opinião opaca.",
      pillars: [
        {
          title: "Dados públicos de mercado",
          text:
            "A Norixo parte de sinais observáveis de anúncios e mercado, em vez de depender apenas de prompts genéricos sem contexto.",
        },
        {
          title: "Sinais calculados",
          text:
            "Pontuações e recomendações são organizadas a partir de sinais calculados de pricing, conversão e posicionamento.",
        },
        {
          title: "Benchmarks agregados",
          text:
            "A inteligência pública é construída sobre camadas de benchmark agregadas, criadas para descrever um mercado e não para expor um anúncio isolado.",
        },
        {
          title: "Contexto da auditoria privada",
          text:
            "Uma auditoria paga acrescenta o contexto real do seu anúncio para que o plano de ação continue específico para a sua propriedade e para o seu workspace.",
        },
      ],
      privacyTitle: "Privacidade e confidencialidade",
      privacyText:
        "A inteligência pública de mercado utiliza dados agregados quando relevante. O conteúdo de uma auditoria privada permanece no seu workspace e não é publicado como exemplo público.",
      limitsTitle: "O que esta análise não faz",
      limitsText:
        "A Norixo ajuda a decidir, mas não garante receita, ranking nem ocupação. O desempenho real também depende da propriedade, do preço, das fotos, da procura e da concorrência.",
    },
    pricing: {
      eyebrow: "METODOLOGIA",
      title: "O que está realmente a pagar num audit Norixo",
      intro:
        "O audit pago tem valor porque liga um anúncio real a contexto de mercado estruturado, sinais calculados e ações priorizadas, em vez de devolver apenas conselhos genéricos.",
      pillars: [
        {
          title: "Dados reais do anúncio",
          text:
            "O audit lê o anúncio escolhido e avalia os elementos visíveis que influenciam o posicionamento e a conversão.",
        },
        {
          title: "Análise estruturada",
          text:
            "A Norixo organiza sinais de pricing, confiança, conteúdo e posicionamento num audit legível, e não numa resposta livre.",
        },
        {
          title: "Contexto benchmark",
          text:
            "Quando relevante, benchmarks de mercado acrescentam contexto agregado para interpretar preço e posicionamento.",
        },
        {
          title: "Plano de ação priorizado",
          text:
            "As recomendações são ordenadas para que possa agir primeiro sobre as mudanças com maior impacto.",
        },
      ],
      privacyTitle: "O seu audit continua privado",
      privacyText:
        "Os dados do workspace e o conteúdo do audit pago permanecem privados. As camadas de benchmark público podem alimentar o contexto de mercado, mas os anúncios dos clientes não são publicados.",
      limitsTitle: "O que o pagamento não compra",
      limitsText:
        "Um audit Norixo é uma ferramenta de apoio à decisão. Não promete receitas, ocupação ou ranking garantidos e não edita nem publica automaticamente o seu anúncio.",
    },
    freeAudit: {
      eyebrow: "METODO DA PREVISUALIZACAO",
      title: "Em que se baseia a prévia gratuita do mercado",
      intro:
        "A prévia gratuita é intencionalmente mais limitada do que o audit completo. Ela mostra um ponto de referência agregado para um segmento de mercado antes de qualquer análise específica do seu anúncio.",
      pillars: [
        {
          title: "Intervalo observado",
          text:
            "A prévia parte dos dados agregados de mercado atualmente disponíveis para o segmento selecionado.",
        },
        {
          title: "Mediana calculada",
          text:
            "A Norixo destaca um nível central de preço para tornar o intervalo mais fácil de interpretar.",
        },
        {
          title: "Confiança e limites",
          text:
            "Os níveis de confiança e as limitações mostram quando a prévia é ampla, parcial ou baseada numa cobertura mais leve.",
        },
        {
          title: "Limite em relação ao audit completo",
          text:
            "A prévia gratuita não analisa o seu título, fotos, descrição nem posicionamento real. Essa leitura só começa no audit completo.",
        },
      ],
      privacyTitle: "O que permanece privado",
      privacyText:
        "A prévia usa dados agregados ao nível do mercado quando disponíveis. A sua estratégia de anúncio e qualquer conteúdo de audit pago continuam privados e não são publicados.",
      limitsTitle: "O que a prévia não promete",
      limitsText:
        "Esta prévia não é uma recomendação de preço garantida. É apenas uma referência inicial de mercado, e o desempenho real continua a depender da propriedade, do posicionamento, das fotos, do preço e da concorrência.",
    },
  },
  nl: {
    home: {
      eyebrow: "METHODOLOGIE",
      title: "Waarom Norixo een resultaat kan uitleggen en niet alleen genereren",
      intro:
        "Norixo combineert waarneembare marktsignalen, gestructureerde berekeningen en context van de advertentie, zodat elke aanbeveling voelt als beslisondersteuning en niet als een ondoorzichtige mening.",
      pillars: [
        {
          title: "Openbare marktdata",
          text:
            "Norixo vertrekt vanuit waarneembare signalen uit advertenties en de markt, in plaats van alleen generieke prompts zonder context te gebruiken.",
        },
        {
          title: "Berekende signalen",
          text:
            "Scores en aanbevelingen worden opgebouwd uit berekende signalen voor pricing, conversie en positionering.",
        },
        {
          title: "Geaggregeerde benchmarks",
          text:
            "Public intelligence wordt opgebouwd uit geaggregeerde benchmarklagen die bedoeld zijn om een markt te beschrijven, niet om één advertentie bloot te leggen.",
        },
        {
          title: "Context van een private audit",
          text:
            "Een betaalde audit voegt de echte context van je advertentie toe, zodat het actieplan specifiek blijft voor je woning en je workspace.",
        },
      ],
      privacyTitle: "Privacy en vertrouwelijkheid",
      privacyText:
        "Openbare marktintelligentie gebruikt geaggregeerde data waar dat relevant is. De inhoud van een private audit blijft in je workspace en wordt niet als publiek voorbeeld gepubliceerd.",
      limitsTitle: "Wat deze analyse niet doet",
      limitsText:
        "Norixo ondersteunt beslissingen, maar garandeert geen omzet, ranking of bezettingsgraad. De echte prestaties hangen ook af van de woning, de prijs, de foto’s, de vraag en de concurrentie.",
    },
    pricing: {
      eyebrow: "METHODOLOGIE",
      title: "Waar je echt voor betaalt in een Norixo-audit",
      intro:
        "De betaalde audit is waardevol omdat die een echte advertentie koppelt aan gestructureerde marktcontext, berekende signalen en geprioriteerde acties, in plaats van alleen generiek advies te geven.",
      pillars: [
        {
          title: "Echte advertentie-input",
          text:
            "De audit leest de gekozen advertentie en beoordeelt de zichtbare elementen die positionering en conversie beïnvloeden.",
        },
        {
          title: "Gestructureerde analyse",
          text:
            "Norixo ordent pricing-, vertrouwens-, content- en positioneringssignalen in een leesbare audit, niet in een vrije tekstreactie.",
        },
        {
          title: "Benchmarkcontext",
          text:
            "Waar relevant voegen marktbenchmarks geaggregeerde context toe om prijs en positionering beter te begrijpen.",
        },
        {
          title: "Geprioriteerd actieplan",
          text:
            "Aanbevelingen worden gesorteerd zodat je eerst kunt handelen op de wijzigingen met de meeste impact.",
        },
      ],
      privacyTitle: "Je audit blijft privé",
      privacyText:
        "Workspacegegevens en betaalde auditinhoud blijven privé. Openbare benchmarklagen kunnen marktcontext voeden, maar klantadvertenties worden niet gepubliceerd.",
      limitsTitle: "Wat betaling niet koopt",
      limitsText:
        "Een Norixo-audit is een beslissingsondersteunend product. Het belooft geen gegarandeerde omzet, bezetting of ranking en bewerkt of publiceert je advertentie niet automatisch.",
    },
    freeAudit: {
      eyebrow: "METHODE VAN DE PREVIEW",
      title: "Waar de gratis marktpreview op is gebaseerd",
      intro:
        "De gratis preview is bewust beperkter dan de volledige audit. Ze toont een geaggregeerd marktreferentiepunt voor een segment voordat er enige listingspecifieke analyse start.",
      pillars: [
        {
          title: "Waargenomen prijsvork",
          text:
            "De preview vertrekt vanuit de geaggregeerde marktdata die momenteel beschikbaar zijn voor het gekozen segment.",
        },
        {
          title: "Berekende mediaan",
          text:
            "Norixo toont een centraal prijsniveau om de prijsvork sneller leesbaar te maken.",
        },
        {
          title: "Betrouwbaarheid en beperkingen",
          text:
            "Betrouwbaarheidsniveaus en beperkingen tonen wanneer de preview breed, gedeeltelijk of gebaseerd op lichtere dekking is.",
        },
        {
          title: "Grens met de volledige audit",
          text:
            "De gratis preview analyseert je titel, foto’s, beschrijving of echte positionering niet. Die diepere analyse start pas in de volledige audit.",
        },
      ],
      privacyTitle: "Wat privé blijft",
      privacyText:
        "De preview gebruikt geaggregeerde data op marktniveau waar beschikbaar. Je advertentie­strategie en eventuele betaalde auditinhoud blijven privé en worden niet gepubliceerd.",
      limitsTitle: "Wat de preview niet beweert",
      limitsText:
        "Deze preview is geen gegarandeerd prijsadvies. Het is een eerste marktreferentie en de echte prestaties hangen nog steeds af van de woning, positionering, foto’s, prijs en concurrentie.",
    },
  },
  de: {
    home: {
      eyebrow: "METHODIK",
      title: "Warum Norixo ein Ergebnis erklären kann und nicht nur erzeugt",
      intro:
        "Norixo kombiniert beobachtbare Marktsignale, strukturierte Berechnungen und den Kontext des Inserats, damit jede Empfehlung als Entscheidungshilfe verstanden werden kann und nicht als Blackbox-Meinung.",
      pillars: [
        {
          title: "Öffentliche Marktdaten",
          text:
            "Norixo startet mit beobachtbaren Signalen aus Inseraten und dem Markt, statt sich nur auf allgemeine Prompts ohne Kontext zu verlassen.",
        },
        {
          title: "Berechnete Signale",
          text:
            "Scores und Empfehlungen werden aus berechneten Signalen für Pricing, Conversion und Positionierung aufgebaut.",
        },
        {
          title: "Aggregierte Benchmarks",
          text:
            "Die öffentliche Intelligence basiert auf aggregierten Benchmark-Ebenen, die einen Markt beschreiben sollen und nicht ein einzelnes Inserat offenlegen.",
        },
        {
          title: "Kontext des privaten Audits",
          text:
            "Ein bezahltes Audit ergänzt den realen Kontext deines Inserats, damit der Maßnahmenplan spezifisch für deine Unterkunft und deinen Workspace bleibt.",
        },
      ],
      privacyTitle: "Datenschutz und Vertraulichkeit",
      privacyText:
        "Öffentliche Marktintelligenz nutzt dort aggregierte Daten, wo sie sinnvoll sind. Inhalte eines privaten Audits bleiben in deinem Workspace und werden nicht als öffentliches Beispiel veröffentlicht.",
      limitsTitle: "Was diese Analyse nicht tut",
      limitsText:
        "Norixo unterstützt Entscheidungen, garantiert aber weder Umsatz, Ranking noch Auslastung. Die reale Performance hängt weiterhin von Unterkunft, Preis, Fotos, Nachfrage und Wettbewerb ab.",
    },
    pricing: {
      eyebrow: "METHODIK",
      title: "Wofür du bei einem Norixo-Audit tatsächlich zahlst",
      intro:
        "Das bezahlte Audit ist wertvoll, weil es ein reales Inserat mit strukturiertem Marktkontext, berechneten Signalen und priorisierten Maßnahmen verbindet, statt nur allgemeine Tipps zu liefern.",
      pillars: [
        {
          title: "Reale Inseratsdaten",
          text:
            "Das Audit liest das gewählte Inserat und bewertet die sichtbaren Elemente, die Positionierung und Conversion beeinflussen.",
        },
        {
          title: "Strukturierte Analyse",
          text:
            "Norixo ordnet Pricing-, Vertrauens-, Content- und Positionierungssignale in ein lesbares Audit ein, nicht in eine freie Antwort.",
        },
        {
          title: "Benchmark-Kontext",
          text:
            "Wenn sinnvoll, liefern Marktbenchmarks aggregierten Kontext für Preis- und Positionierungsentscheidungen.",
        },
        {
          title: "Priorisierter Maßnahmenplan",
          text:
            "Empfehlungen werden so geordnet, dass du zuerst an den Hebeln mit dem größten Effekt arbeiten kannst.",
        },
      ],
      privacyTitle: "Dein Audit bleibt privat",
      privacyText:
        "Workspace-Daten und Inhalte des bezahlten Audits bleiben privat. Öffentliche Benchmark-Ebenen können Marktkontext liefern, aber Kundeninserate werden nicht veröffentlicht.",
      limitsTitle: "Was der Kauf nicht beinhaltet",
      limitsText:
        "Ein Norixo-Audit ist ein Entscheidungshilfe-Produkt. Es verspricht keine garantierten Umsatz-, Auslastungs- oder Rankingsteigerungen und bearbeitet oder veröffentlicht dein Inserat nicht automatisch.",
    },
    freeAudit: {
      eyebrow: "METHODE DER VORSCHAU",
      title: "Worauf die kostenlose Marktvorschau basiert",
      intro:
        "Die kostenlose Vorschau ist bewusst enger gefasst als das vollständige Audit. Sie zeigt einen aggregierten Marktbezugspunkt für ein Segment, bevor eine listingspezifische Analyse beginnt.",
      pillars: [
        {
          title: "Beobachtete Preisspanne",
          text:
            "Die Vorschau basiert auf den aggregierten Marktdaten, die derzeit für das ausgewählte Segment verfügbar sind.",
        },
        {
          title: "Berechneter Median",
          text:
            "Norixo zeigt ein zentrales Preisniveau, damit sich die Spanne schneller einordnen lässt.",
        },
        {
          title: "Vertrauen und Grenzen",
          text:
            "Vertrauensstufen und Limitierungen zeigen, wann die Vorschau breit, teilweise oder auf dünnerer Abdeckung basiert.",
        },
        {
          title: "Grenze zum vollständigen Audit",
          text:
            "Die kostenlose Vorschau analysiert weder Titel, Fotos, Beschreibung noch die reale Positionierung deines Inserats. Diese tiefere Auswertung beginnt erst im vollständigen Audit.",
        },
      ],
      privacyTitle: "Was privat bleibt",
      privacyText:
        "Die Vorschau nutzt aggregierte Marktdaten, wenn sie verfügbar sind. Deine Inseratsstrategie und Inhalte eines bezahlten Audits bleiben privat und werden nicht veröffentlicht.",
      limitsTitle: "Was die Vorschau nicht verspricht",
      limitsText:
        "Diese Vorschau ist keine garantierte Preisempfehlung. Sie ist ein erster Marktbezugspunkt, und die reale Performance hängt weiterhin von Unterkunft, Positionierung, Fotos, Preis und Wettbewerb ab.",
    },
  },
  ja: {
    home: {
      eyebrow: "分析の考え方",
      title: "Norixo が結果を説明できる理由",
      intro:
        "Norixo は観測可能な市場シグナル、構造化された計算、掲載情報の文脈を組み合わせ、各提案を根拠のある意思決定支援として提示します。",
      pillars: [
        {
          title: "公開市場データ",
          text:
            "Norixo は文脈のない一般的なプロンプトだけに頼らず、公開された市場シグナルと掲載情報の観測値から出発します。",
        },
        {
          title: "計算されたシグナル",
          text:
            "スコアと提案は、価格、転換率、ポジショニングに関する計算シグナルをもとに整理されます。",
        },
        {
          title: "集計ベンチマーク",
          text:
            "公開インテリジェンスは、市場を説明するための集計ベンチマーク層を使い、個別の掲載情報を公開することはありません。",
        },
        {
          title: "非公開監査の文脈",
          text:
            "有料監査では、実際の掲載情報の文脈が加わるため、アクションプランはあなたの物件とワークスペースに即したものになります。",
        },
      ],
      privacyTitle: "プライバシーと機密性",
      privacyText:
        "公開市場インテリジェンスでは、必要に応じて集計データのみを利用します。非公開監査の内容はワークスペース内にとどまり、公開事例として表示されません。",
      limitsTitle: "この分析で保証しないこと",
      limitsText:
        "Norixo は意思決定を支援しますが、収益、順位、稼働率を保証するものではありません。実際の成果は物件、価格、写真、需要、競合状況にも左右されます。",
    },
    pricing: {
      eyebrow: "分析の考え方",
      title: "Norixo 監査で実際に支払う価値",
      intro:
        "有料監査の価値は、実在する掲載情報を構造化された市場文脈、計算シグナル、優先順位付きの行動提案と結びつける点にあります。",
      pillars: [
        {
          title: "実際の掲載情報",
          text:
            "監査では選択した掲載情報を読み取り、ポジショニングと転換率に影響する公開要素を評価します。",
        },
        {
          title: "構造化された分析",
          text:
            "Norixo は価格、信頼、コンテンツ、ポジショニングのシグナルを、自由回答ではなく読みやすい監査形式に整理します。",
        },
        {
          title: "ベンチマーク文脈",
          text:
            "必要に応じて、市場ベンチマークが集計文脈を提供し、価格とポジショニングの判断を補強します。",
        },
        {
          title: "優先順位付きアクション",
          text:
            "提案は、最も効果の大きい変更から着手できるよう優先順位順に整理されます。",
        },
      ],
      privacyTitle: "監査内容は非公開です",
      privacyText:
        "ワークスペースのデータと有料監査の内容は非公開です。公開ベンチマーク層は市場文脈に使われることがありますが、顧客の掲載情報が公開されることはありません。",
      limitsTitle: "購入しても含まれないもの",
      limitsText:
        "Norixo 監査は意思決定支援です。収益、稼働率、順位の改善を保証するものではなく、掲載情報を自動で編集・公開することもありません。",
    },
    freeAudit: {
      eyebrow: "無料プレビューの根拠",
      title: "無料マーケットプレビューが示すもの",
      intro:
        "無料プレビューはフル監査より意図的に範囲を絞っています。掲載情報ごとの分析を始める前に、市場セグメントの集計参照値だけを表示します。",
      pillars: [
        {
          title: "観測された価格帯",
          text:
            "プレビューは、選択した市場セグメントで現在利用可能な集計市場データから始まります。",
        },
        {
          title: "算出された中央値",
          text:
            "Norixo は価格帯を読み取りやすくするため、市場の中心的な価格水準を表示します。",
        },
        {
          title: "信頼度と制約",
          text:
            "信頼度と制約ラベルにより、プレビューが広い範囲なのか、部分的なのか、データが薄いのかが分かります。",
        },
        {
          title: "フル監査との境界",
          text:
            "無料プレビューでは、タイトル、写真、説明文、実際のポジショニングは分析しません。そこから先はフル監査で始まります。",
        },
      ],
      privacyTitle: "非公開のまま残るもの",
      privacyText:
        "プレビューでは、利用可能な範囲で市場レベルの集計データのみを使用します。あなたの掲載戦略や有料監査の内容は非公開で、公開されません。",
      limitsTitle: "プレビューが保証しないこと",
      limitsText:
        "このプレビューは価格の保証付き提案ではありません。あくまで初期の市場参照であり、実際の成果は物件、ポジショニング、写真、価格、競合にも左右されます。",
    },
  },
  zh: {
    home: {
      eyebrow: "方法说明",
      title: "为什么 Norixo 不只是生成结果，而是能够解释结果",
      intro:
        "Norixo 将可观察的市场信号、结构化计算和房源语境结合起来，让每一条建议都更像决策支持，而不是无法解释的结论。",
      pillars: [
        {
          title: "公开市场数据",
          text:
            "Norixo 以可观察的房源与市场信号为起点，而不是只依赖没有上下文的通用提示词。",
        },
        {
          title: "计算型信号",
          text:
            "评分和建议建立在价格、转化和定位等计算型信号之上，并以结构化方式呈现。",
        },
        {
          title: "聚合基准层",
          text:
            "公开市场智能使用聚合后的基准层来描述市场，而不是暴露某一条具体房源。",
        },
        {
          title: "私有审计语境",
          text:
            "付费审计会加入你的真实房源语境，因此行动建议会更贴合你的房源和工作空间。",
        },
      ],
      privacyTitle: "隐私与保密",
      privacyText:
        "公开市场智能在适用时只使用聚合数据。私有审计内容保留在你的工作空间中，不会作为公开示例发布。",
      limitsTitle: "这项分析不保证什么",
      limitsText:
        "Norixo 帮助你做决策，但不保证收入、排名或入住率。实际表现仍然取决于房源本身、定价、照片、需求和竞争。",
    },
    pricing: {
      eyebrow: "方法说明",
      title: "你为 Norixo 审计真正支付的是什么",
      intro:
        "付费审计的价值在于，它把真实房源与结构化市场背景、计算信号和优先级行动连接起来，而不是只输出泛泛建议。",
      pillars: [
        {
          title: "真实房源输入",
          text:
            "审计会读取你选择的房源，并评估影响定位和转化的可见要素。",
        },
        {
          title: "结构化分析",
          text:
            "Norixo 会把定价、信任、内容和定位信号整理成可读的审计结果，而不是自由文本回答。",
        },
        {
          title: "基准背景",
          text:
            "在合适的情况下，市场基准会提供聚合背景，帮助理解价格和定位。",
        },
        {
          title: "优先级行动计划",
          text:
            "建议会按优先顺序排列，帮助你先处理最有杠杆作用的改动。",
        },
      ],
      privacyTitle: "你的审计保持私密",
      privacyText:
        "工作空间数据和付费审计内容保持私密。公开基准层可以为市场背景提供支持，但客户房源不会被公开发布。",
      limitsTitle: "付费并不包含什么",
      limitsText:
        "Norixo 审计是决策支持产品，不承诺收入、入住率或排名的保证提升，也不会自动编辑或发布你的房源。",
    },
    freeAudit: {
      eyebrow: "免费预览方法",
      title: "免费市场预览基于什么",
      intro:
        "免费预览的范围刻意比完整审计更窄。它只展示某个市场细分的聚合参考点，在真正开始房源级分析之前提供初步判断。",
      pillars: [
        {
          title: "观察到的价格区间",
          text:
            "预览基于当前该市场细分可用的聚合市场数据。",
        },
        {
          title: "计算出的中位数",
          text:
            "Norixo 会显示一个居中的市场价格水平，让区间更容易理解。",
        },
        {
          title: "置信度与限制",
          text:
            "置信度与限制标签会说明当前预览是宽范围、部分覆盖，还是基于较轻的数据覆盖。",
        },
        {
          title: "与完整审计的边界",
          text:
            "免费预览不会分析你的标题、照片、描述或真实定位。这部分只会在完整审计中开始。",
        },
      ],
      privacyTitle: "哪些内容仍然私密",
      privacyText:
        "预览在有条件时只使用市场级聚合数据。你的房源策略以及未来付费审计内容都保持私密，不会被公开发布。",
      limitsTitle: "预览并不承诺什么",
      limitsText:
        "这不是一个保证性的定价建议。它只是一个初步市场参考，实际表现仍然取决于房源、定位、照片、价格与竞争。",
    },
  },
  ko: {
    home: {
      eyebrow: "분석 원칙",
      title: "Norixo가 결과를 단순 생성이 아니라 설명할 수 있는 이유",
      intro:
        "Norixo는 관찰 가능한 시장 신호, 구조화된 계산, 숙소 맥락을 함께 사용해 각 추천을 설명 가능한 의사결정 지원으로 제시합니다.",
      pillars: [
        {
          title: "공개 시장 데이터",
          text:
            "Norixo는 맥락 없는 일반 프롬프트에만 의존하지 않고, 공개적으로 관찰 가능한 숙소 및 시장 신호에서 출발합니다.",
        },
        {
          title: "계산된 신호",
          text:
            "점수와 추천은 가격, 전환, 포지셔닝에 관한 계산 신호를 기반으로 구조화됩니다.",
        },
        {
          title: "집계형 벤치마크",
          text:
            "공개 인텔리전스는 개별 숙소를 드러내지 않고 시장을 설명하기 위한 집계형 벤치마크 계층을 사용합니다.",
        },
        {
          title: "비공개 감사 맥락",
          text:
            "유료 감사는 실제 숙소 맥락을 추가하므로 실행 계획이 당신의 숙소와 워크스페이스에 맞게 유지됩니다.",
        },
      ],
      privacyTitle: "개인정보와 기밀성",
      privacyText:
        "공개 시장 인텔리전스는 필요한 경우 집계 데이터만 사용합니다. 비공개 감사 내용은 워크스페이스 안에 머물며 공개 사례로 게시되지 않습니다.",
      limitsTitle: "이 분석이 보장하지 않는 것",
      limitsText:
        "Norixo는 의사결정을 돕지만 수익, 순위, 점유율을 보장하지는 않습니다. 실제 성과는 숙소, 가격, 사진, 수요, 경쟁에도 영향을 받습니다.",
    },
    pricing: {
      eyebrow: "분석 원칙",
      title: "Norixo 감사에 실제로 비용을 지불하는 이유",
      intro:
        "유료 감사의 가치는 실제 숙소를 구조화된 시장 맥락, 계산 신호, 우선순위 행동과 연결한다는 점에 있으며, 단순한 일반 조언에 그치지 않습니다.",
      pillars: [
        {
          title: "실제 숙소 입력",
          text:
            "감사는 선택한 숙소를 읽고 포지셔닝과 전환에 영향을 주는 가시 요소를 평가합니다.",
        },
        {
          title: "구조화된 분석",
          text:
            "Norixo는 가격, 신뢰, 콘텐츠, 포지셔닝 신호를 자유형 답변이 아니라 읽기 쉬운 감사 형식으로 정리합니다.",
        },
        {
          title: "벤치마크 맥락",
          text:
            "필요한 경우 시장 벤치마크가 집계된 맥락을 제공해 가격과 포지셔닝 판단을 돕습니다.",
        },
        {
          title: "우선순위 실행 계획",
          text:
            "추천은 가장 영향이 큰 변경부터 실행할 수 있도록 우선순위 순으로 정렬됩니다.",
        },
      ],
      privacyTitle: "당신의 감사는 비공개로 유지됩니다",
      privacyText:
        "워크스페이스 데이터와 유료 감사 내용은 비공개로 유지됩니다. 공개 벤치마크 계층은 시장 맥락에 사용될 수 있지만 고객 숙소는 공개되지 않습니다.",
      limitsTitle: "결제가 포함하지 않는 것",
      limitsText:
        "Norixo 감사는 의사결정 지원 도구입니다. 수익, 점유율, 순위 향상을 보장하지 않으며 숙소를 자동으로 수정하거나 게시하지도 않습니다.",
    },
    freeAudit: {
      eyebrow: "무료 미리보기 방법",
      title: "무료 시장 미리보기가 기반으로 하는 것",
      intro:
        "무료 미리보기는 전체 감사보다 의도적으로 범위가 좁습니다. 실제 숙소 분석에 들어가기 전에 시장 세그먼트의 집계 기준점만 보여줍니다.",
      pillars: [
        {
          title: "관측된 가격 범위",
          text:
            "미리보기는 선택한 시장 세그먼트에서 현재 이용 가능한 집계 시장 데이터에서 시작합니다.",
        },
        {
          title: "계산된 중앙값",
          text:
            "Norixo는 가격 범위를 더 쉽게 해석할 수 있도록 중심 가격 수준을 보여줍니다.",
        },
        {
          title: "신뢰도와 한계",
          text:
            "신뢰도와 제한 라벨은 미리보기가 넓은 범위인지, 부분적인지, 가벼운 데이터 커버리지인지 알려줍니다.",
        },
        {
          title: "전체 감사와의 경계",
          text:
            "무료 미리보기는 제목, 사진, 설명, 실제 포지셔닝을 분석하지 않습니다. 이런 깊은 분석은 전체 감사에서 시작됩니다.",
        },
      ],
      privacyTitle: "비공개로 남는 것",
      privacyText:
        "미리보기는 가능한 경우 시장 수준의 집계 데이터만 사용합니다. 당신의 숙소 전략과 향후 유료 감사 내용은 비공개이며 공개되지 않습니다.",
      limitsTitle: "미리보기가 보장하지 않는 것",
      limitsText:
        "이 미리보기는 보장형 가격 추천이 아닙니다. 초기 시장 참고점일 뿐이며 실제 성과는 숙소, 포지셔닝, 사진, 가격, 경쟁에 따라 달라집니다.",
    },
  },
  ar: {
    home: {
      eyebrow: "منهجية التحليل",
      title: "لماذا تستطيع Norixo تفسير النتيجة لا مجرد توليدها",
      intro:
        "تجمع Norixo بين إشارات السوق القابلة للملاحظة والحسابات المنظمة وسياق الإعلان، بحيث تبدو كل توصية أداة دعم للقرار وليست رأيًا غامضًا.",
      pillars: [
        {
          title: "بيانات سوق عامة",
          text:
            "تعتمد Norixo أولًا على إشارات قابلة للملاحظة من السوق والإعلانات، بدل الاكتفاء بطلبات عامة بلا سياق.",
        },
        {
          title: "إشارات محسوبة",
          text:
            "يتم تنظيم الدرجات والتوصيات انطلاقًا من إشارات محسوبة تتعلق بالتسعير والتحويل والتموضع.",
        },
        {
          title: "معايير مجمعة",
          text:
            "تعتمد المعلومات العامة على طبقات Benchmark مجمعة هدفها وصف السوق لا كشف إعلان واحد بعينه.",
        },
        {
          title: "سياق التدقيق الخاص",
          text:
            "يضيف التدقيق المدفوع السياق الحقيقي لإعلانك، حتى تبقى خطة العمل مرتبطة بعقارك وبمساحة العمل الخاصة بك.",
        },
      ],
      privacyTitle: "الخصوصية والسرية",
      privacyText:
        "تستخدم معلومات السوق العامة بيانات مجمعة عند الحاجة. ويبقى محتوى التدقيق الخاص داخل مساحة العمل الخاصة بك ولا يُنشر كحالة عامة.",
      limitsTitle: "ما الذي لا يفعله هذا التحليل",
      limitsText:
        "تساعد Norixo في اتخاذ القرار، لكنها لا تضمن الإيرادات أو الترتيب أو معدل الإشغال. فالنتائج الفعلية تعتمد أيضًا على العقار والسعر والصور والطلب والمنافسة.",
    },
    pricing: {
      eyebrow: "منهجية التحليل",
      title: "ما الذي تدفع مقابله فعليًا في تدقيق Norixo",
      intro:
        "تكمن قيمة التدقيق المدفوع في ربط إعلان حقيقي بسياق سوق منظم وإشارات محسوبة وإجراءات مرتبة حسب الأولوية، بدل الاكتفاء بنصائح عامة.",
      pillars: [
        {
          title: "مدخلات حقيقية للإعلان",
          text:
            "يقرأ التدقيق الإعلان الذي تختاره ويقيّم العناصر الظاهرة التي تؤثر في التموضع والتحويل.",
        },
        {
          title: "تحليل منظم",
          text:
            "تنظم Norixo إشارات التسعير والثقة والمحتوى والتموضع في تدقيق واضح، لا في إجابة حرة غير منظمة.",
        },
        {
          title: "سياق Benchmark",
          text:
            "عند الحاجة، تضيف معايير السوق سياقًا مجمعًا يساعد على فهم قرارات السعر والتموضع.",
        },
        {
          title: "خطة عمل مرتبة",
          text:
            "تُرتب التوصيات بحيث يمكنك البدء أولًا بالتغييرات الأكثر تأثيرًا.",
        },
      ],
      privacyTitle: "يبقى تدقيقك خاصًا",
      privacyText:
        "تبقى بيانات مساحة العمل ومحتوى التدقيق المدفوع خاصة. وقد تغذي طبقات Benchmark العامة سياق السوق، لكن إعلانات العملاء لا تُنشر علنًا.",
      limitsTitle: "ما الذي لا يشتريه هذا الدفع",
      limitsText:
        "تدقيق Norixo أداة دعم للقرار. لا يَعِد بزيادة مضمونة في الإيرادات أو الإشغال أو الترتيب، ولا يعدل إعلانك أو ينشره تلقائيًا.",
    },
    freeAudit: {
      eyebrow: "منهجية المعاينة المجانية",
      title: "على ماذا تعتمد المعاينة المجانية للسوق",
      intro:
        "المعاينة المجانية أضيق عمدًا من التدقيق الكامل. فهي تعرض نقطة مرجعية مجمعة لقطاع من السوق قبل بدء أي تحليل خاص بإعلانك.",
      pillars: [
        {
          title: "النطاق السعري المرصود",
          text:
            "تنطلق المعاينة من بيانات السوق المجمعة المتاحة حاليًا للقطاع المحدد.",
        },
        {
          title: "الوسيط المحسوب",
          text:
            "تعرض Norixo مستوى السعر المركزي لتسهيل قراءة النطاق بسرعة.",
        },
        {
          title: "الثقة والقيود",
          text:
            "توضح مستويات الثقة والقيود ما إذا كانت المعاينة واسعة أو جزئية أو مبنية على تغطية أخف.",
        },
        {
          title: "الحد الفاصل مع التدقيق الكامل",
          text:
            "لا تحلل المعاينة المجانية عنوانك أو صورك أو وصفك أو تموضعك الحقيقي. ويبدأ هذا العمق فقط في التدقيق الكامل.",
        },
      ],
      privacyTitle: "ما الذي يبقى خاصًا",
      privacyText:
        "تستخدم المعاينة بيانات مجمعة على مستوى السوق عندما تكون متاحة. وتبقى إستراتيجية إعلانك وأي محتوى تدقيق مدفوع لاحق خاصين ولا يتم نشرهما.",
      limitsTitle: "ما الذي لا تدعيه المعاينة",
      limitsText:
        "هذه المعاينة ليست توصية سعرية مضمونة. إنها مجرد نقطة مرجعية أولية للسوق، بينما تعتمد النتائج الفعلية أيضًا على العقار والتموضع والصور والسعر والمنافسة.",
    },
  },
} as const satisfies Record<Locale, Record<AuthorityTrustVariant, AuthorityTrustCopy>>;
