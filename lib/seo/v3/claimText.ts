/**
 * SEO generator V3 — deterministic analysis of claim text (pure; no registry, no clock, no network).
 *
 * WHAT THIS IS: a conservative lexical screen. It finds numbers and a fixed list of risky wordings in
 * English and French, sentence by sentence, so that the validator can refuse text that states a
 * checkable fact, a demonstrated effect or a guarantee without the structure that would justify it.
 *
 * WHAT THIS IS NOT: language understanding. It cannot see paraphrase, irony, implication, a claim spread
 * over two sentences, or a fact stated with none of the listed words. Its failure mode is chosen to be
 * over-refusal on listed wordings, never a promise that unlisted wordings are safe. A text that passes
 * this screen has NOT been shown to be true or safe; it has only avoided the patterns below. See
 * LEXICAL_SCREEN_LIMITS for the documented gaps.
 *
 * The analysis never returns the text itself, only positions, categories and class names.
 */

export const LEXICAL_SCREEN_LIMITS: readonly string[] = Object.freeze([
  "Only English and French wordings from the lists below are recognised. Text in any other language, or whose language cannot be established, is NOT analysed and is refused for automatic validation (see screenLanguage).",
  "Language screening is a heuristic over closed lists of function words, not an identification of the language: it can only fail closed, and a short text may be refused for lack of evidence.",
  "Text with letters outside the basic Latin alphabet (after Unicode normalisation) is refused: homoglyphs and other scripts cannot be analysed.",
  "Deterministic factual sentences are produced by claimRender.ts (English only); a factual claim is accepted only when its text is exactly that rendering.",
  "Paraphrases, implications, irony and claims split across sentences are not detected.",
  "A bare number-less statement of a local fact (for example a place name with a property) is only caught when it uses a listed wording.",
  "Negation is recognised only for the listed disclaimer phrases; any other negated risky wording is refused (over-refusal).",
  "Spelled-out numbers are recognised only next to a unit, a percentage word or a multiplier word.",
  "Comparisons, trends and superlatives cannot be verified (S3 has no calculation engine); factual text using them is refused.",
]);

export type NumberCategory =
  | "percent"
  | "currency"
  | "duration"
  | "distance"
  | "date"
  | "year"
  | "multiplier"
  | "quantity";

export type NumericToken = Readonly<{
  category: NumberCategory;
  /** Numeric values the written form can denote ("1,234" can be 1.234 or 1234: both are listed). */
  candidates: readonly number[];
  /** Number of decimals as written (first candidate). */
  decimals: number;
  /** ISO currency code when a currency marker is attached to the number, else null. */
  currency: string | null;
  /** Folded word or sign written right after the number ("listings", "nights", "%"), "" when none. Never a claim of its own. */
  unit: string;
  /** True for list or step numbering, which is not a quantitative claim. */
  structural: boolean;
  /** ISO date text for category "date". Dates are public periods, not sensitive. */
  isoDate: string | null;
  /** Index of the sentence the token belongs to. */
  sentence: number;
  /** Position in the folded text; tokens are returned in text order. */
  position: number;
}>;

export type RiskClass =
  | "average"
  | "trend_claim"
  | "evolution_word"
  | "comparison"
  | "market_superlative"
  | "superlative_word"
  | "generalization"
  | "regulatory"
  | "preference"
  | "demand"
  | "platform_authority"
  | "vague_attribution"
  | "causal"
  | "guarantee"
  | "certainty"
  | "observation"
  | "implicit_fact"
  | "occupancy"
  | "benchmark"
  | "quantifier"
  | "pricing_advice"
  | "future_effect"
  | "implicit_comparison";

export type SentenceAnalysis = Readonly<{
  index: number;
  hits: ReadonlySet<RiskClass>;
  /** The sentence contains a modal/hedge word (may, can, might, peut, …). */
  hedged: boolean;
  /** The sentence contains a negation marker. */
  negated: boolean;
  /** The sentence is a recognised guarantee disclaimer ("does not guarantee …"). */
  guaranteeDisclaimer: boolean;
}>;

export type TextAnalysis = Readonly<{
  tokens: readonly NumericToken[];
  sentences: readonly SentenceAnalysis[];
  /** Every class hit anywhere in the text. */
  hits: ReadonlySet<RiskClass>;
}>;

const LATIN_SPECIALS: Readonly<Record<string, string>> = {
  "œ": "oe", "æ": "ae", "ß": "ss", "ø": "o", "ł": "l", "đ": "d", "ı": "i", "þ": "th", "ð": "d", "ħ": "h", "ŧ": "t",
};
const ARABIC_PUNCTUATION: Readonly<Record<string, string>> = { "٪": "%", "٫": ".", "٬": "," };
const DECIMAL_DIGIT = /^\p{Nd}$/u;

/** ASCII value of a decimal digit of any script (digit blocks are aligned runs of ten starting at zero). */
function asciiDigit(char: string): string {
  let codePoint = char.codePointAt(0)!;
  let offset = 0;
  while (codePoint - 1 > 0 && DECIMAL_DIGIT.test(String.fromCodePoint(codePoint - 1))) {
    codePoint -= 1;
    offset += 1;
  }
  return String(offset % 10);
}

/**
 * Lower-case, accent-free text used for matching (never returned). Normalisation is part of the
 * security of the screen: compatibility forms (full-width, ligatures) are unified, invisible
 * formatting characters (zero-width, soft hyphen, bidi marks) are removed, decimal digits of every
 * script become ASCII digits, and a few Latin look-alikes are mapped. Whatever still is not a
 * basic Latin letter afterwards is reported by `hasUnsupportedScript`.
 */
export function fold(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\p{Cf}\u00AD]/gu, "")
    .replace(/[٪٫٬]/g, (char) => ARABIC_PUNCTUATION[char]!)
    .replace(/\p{Nd}/gu, (char) => (/[0-9]/.test(char) ? char : asciiDigit(char)))
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[\s\p{Z}]/gu, (char) => (char === "\n" ? "\n" : " "))
    .toLowerCase()
    .replace(/[œæßøłđıþðħŧ]/g, (char) => LATIN_SPECIALS[char]!);
}

/** True when, after normalisation, a letter other than a-z remains (other scripts, homoglyphs, exotic letters). */
export function hasUnsupportedScript(text: string): boolean {
  return /[^\P{L}a-z]/u.test(fold(text));
}

// --- Language screen (heuristic, fails closed) ----------------------------------------------------

export type ScreenedLanguage = "en" | "fr" | "undetermined";

const FUNCTION_WORDS: Readonly<Record<"en" | "fr" | "es" | "de" | "it" | "pt" | "nl", string>> = {
  en: "the and of to is are was were be been with for that this these those your you our we they their there which what when where will would should can could have has had from by at not but if it its more most all into than then also about over only each every any some such other own same just very well how why who while before after during between under again here both",
  fr: "le la les des du de un une est sont pour avec dans vous nous et qui que sur cette ces au aux pas votre vos ou mais comme sans plus tres aussi il elle ils elles leur leurs par ne se ce son sa ses mon ma mes ton ta tes notre nos en y ete etre avoir fait peut peuvent doit dois faut chaque tout toute tous toutes cela ceci celui entre vers chez donc car ni si quand dont lorsque ainsi alors apres avant pendant depuis contre sous encore deja jamais toujours souvent parfois bien",
  es: "el la los las un una unos unas de del y o que en con para por es son esta este estos estas su sus muy como pero mas se lo al ya hay ser sin sobre entre cuando donde tambien todo todos cada",
  de: "der die das den dem des und oder ist sind nicht mit fur ein eine einer eines einem einen auf zu von im aus bei nach wie auch sich als wird werden noch nur dass aber wenn sehr uber hat haben kann konnen",
  it: "il lo la gli le un uno una di del della dei delle che per con su sono non piu come anche molto questo questa questi queste nel nella ha hanno puo essere",
  pt: "o os as um uma de do da dos das que em para com nao sao mais muito como mas ou se ao aos na no nas nos isto isso esta este",
  nl: "de het een en van niet voor met zijn dat dit op te er ook maar bij wordt worden naar nog kan heeft hebben deze die zeer",
};
type LanguageCode = keyof typeof FUNCTION_WORDS;
const LANGUAGES = Object.keys(FUNCTION_WORDS) as LanguageCode[];
const WORD_SETS: Readonly<Record<LanguageCode, ReadonlySet<string>>> = (() => {
  const english = new Set(FUNCTION_WORDS.en.split(" "));
  const sets = {} as Record<LanguageCode, ReadonlySet<string>>;
  for (const language of LANGUAGES) {
    const words = FUNCTION_WORDS[language].split(" ");
    // a word that is also an English function word is evidence for English only
    sets[language] = new Set(language === "en" ? words : words.filter((word) => !english.has(word)));
  }
  return sets;
})();

function languageHits(words: readonly string[]): Record<LanguageCode, number> {
  const hits = {} as Record<LanguageCode, number>;
  for (const language of LANGUAGES) hits[language] = words.filter((word) => WORD_SETS[language].has(word)).length;
  return hits;
}

function dominant(hits: Record<LanguageCode, number>): { language: LanguageCode; best: number; other: number } {
  const ranked = [...LANGUAGES].sort((a, b) => hits[b] - hits[a] || (a < b ? -1 : 1));
  return { language: ranked[0]!, best: hits[ranked[0]!], other: hits[ranked[1]!] };
}

/**
 * Heuristic screen, NOT an identification of the language. It answers "is there enough evidence that this
 * is English or French, and nothing else?" from closed lists of function words, for the whole text and
 * for every sentence of five words or more. When the evidence is thin, mixed or points elsewhere the
 * answer is "undetermined": the caller must then refuse automatic validation. A text is never taken for
 * English or French because it contains a few words of those languages.
 */
export function screenLanguage(text: string): ScreenedLanguage {
  const folded = fold(text);
  const sentences = splitSentences(folded).map((sentence) => sentence.text.match(/[a-z]+/g) ?? []);
  const words = sentences.flat();
  if (words.length < 3) return "undetermined";
  const whole = dominant(languageHits(words));
  if (whole.language !== "en" && whole.language !== "fr") return "undetermined";
  if (whole.best < (words.length < 8 ? 1 : 2) || whole.best <= 2 * whole.other) return "undetermined";
  for (const sentenceWords of sentences) {
    if (sentenceWords.length < 5) continue;
    const hits = languageHits(sentenceWords);
    const own = hits[whole.language];
    const others = Math.max(...LANGUAGES.filter((language) => language !== whole.language).map((language) => hits[language]));
    if (own < 1 || own <= 2 * others) return "undetermined";
  }
  return whole.language;
}

/** Sentences of the text in the form used by the analysis (folded; for internal comparison only, never returned to callers of the validator). */
export function foldedSentences(text: string): readonly string[] {
  return splitSentences(fold(text)).map((sentence) => sentence.text);
}

// --- Numbers ----------------------------------------------------------------------------------

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const NUMBER =
  /(?<![A-Za-z0-9_])([€$£]\s?)?(\d{1,3}(?:[ ,.]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(\s?(?:per cent|pour cent|%|[a-z€$£]+))?/g;

const CURRENCY_WORDS: Readonly<Record<string, string>> = {
  "€": "EUR", eur: "EUR", euro: "EUR", euros: "EUR",
  $: "USD", usd: "USD", dollar: "USD", dollars: "USD",
  "£": "GBP", gbp: "GBP", pound: "GBP", pounds: "GBP", livre: "GBP", livres: "GBP",
};
const PERCENT_WORDS = new Set(["%", "percent", "per cent", "pour cent"]);
const DURATION_WORDS = new Set([
  "night", "nights", "nuit", "nuits", "day", "days", "jour", "jours", "week", "weeks", "semaine", "semaines",
  "month", "months", "mois", "year", "years", "an", "ans", "annee", "annees", "hour", "hours", "heure", "heures",
  "h", "min", "mins", "minute", "minutes",
]);
const DISTANCE_WORDS = new Set([
  "km", "m", "mi", "mile", "miles", "meter", "meters", "metre", "metres", "kilometer", "kilometers", "kilometre", "kilometres",
]);
/** Only these words, alone at the start of a sentence, make a small integer a step number. "point", "no.", "number", "rule" do not. */
const STRUCTURAL_WORD = /^(?:step|etape|tip|astuce|section|chapter|chapitre|part|partie)$/;
const MAX_STRUCTURAL_NUMBER = 12;

/** Candidate numeric values of a written number ("1,234" -> [1.234, 1234]). */
export function numericCandidates(written: string): number[] {
  const text = written.replace(/[\s  ]/g, "");
  const found = new Set<number>();
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    found.add(Number(text.split(thousands).join("").replace(decimal, ".")));
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? "," : ".";
    const parts = text.split(separator);
    const asDecimal = Number(parts.length === 2 ? `${parts[0]}.${parts[1]}` : NaN);
    const asThousands = Number(parts.join(""));
    const groupedLikeThousands = parts.slice(1).every((part) => part.length === 3) && parts[0]!.length <= 3 && parts[0]!.length > 0;
    if (parts.length === 2 && !Number.isNaN(asDecimal)) found.add(asDecimal);
    if (groupedLikeThousands && !Number.isNaN(asThousands)) found.add(asThousands);
  } else {
    found.add(Number(text));
  }
  return [...found].filter((value) => Number.isFinite(value));
}

function decimalsOf(written: string): number {
  const text = written.replace(/[\s  ]/g, "");
  const match = /[.,](\d+)$/.exec(text);
  if (match === null) return 0;
  // "1,234" is ambiguous; the decimal reading has 3 decimals, the thousands reading 0: report the smaller.
  return match[1]!.length === 3 && /^\d{1,3}[.,]\d{3}$/.test(text) ? 0 : match[1]!.length;
}

function splitSentences(folded: string): { text: string; start: number }[] {
  const sentences: { text: string; start: number }[] = [];
  const boundary = /[.!?;\n]+(?=\s|$)|\n+/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(folded)) !== null) {
    sentences.push({ text: folded.slice(last, match.index), start: last });
    last = match.index + match[0].length;
  }
  sentences.push({ text: folded.slice(last), start: last });
  return sentences.filter((sentence) => sentence.text.trim().length > 0);
}

// --- Wordings (matched on folded text) ---------------------------------------------------------

const MARKET_SUBJECT = "(?:prices?|rates?|revenues?|income|earnings?|occupancy|demand|bookings?|reservations?|tarifs?|prix|revenus?|demande|reservations?|taux)";
const GROWTH_VERB =
  "(?:increas\\w*|decreas\\w*|ris(?:e|es|ing)|rose|risen|grow\\w*|grew|drop\\w*|fell|fall\\w*|declin\\w*|surg\\w*|jump\\w*|climb\\w*|soar\\w*|augment\\w*|baiss\\w*|diminu\\w*|croiss\\w*|flamb\\w*|progress\\w*|chut\\w*|sky-?rocket\\w*|spik\\w*|plung\\w*|plummet\\w*|tumbl\\w*|shot up|went up|goes up|go up|going up|picked up|grimp\\w*|mont(?:e|es|ent|ait|aient|era|eront)|bond\\w*|explos\\w*|envol\\w*|degringol\\w*)";

const PATTERNS: Readonly<Record<RiskClass, readonly RegExp[]>> = {
  average: [
    /\b(?:average|mean)\s+(?:\w+\s+){0,2}(?:price|rate|revenue|income|occupancy|stay|rating|score|booking|nightly|night|earning|cost)/,
    /\b(?:price|rate|revenue|income|occupancy|rating|score|tarif|prix|revenu|taux|note)s?\s+(?:\w+\s+){0,2}(?:moyen|moyenne|moyens|moyennes|average)\b/,
    /\bon average\b|\ben moyenne\b|\btypical(?:ly)?\b|\btypique(?:ment)?\b|\bhabituellement\b/,
  ],
  trend_claim: [
    new RegExp(`\\b${MARKET_SUBJECT}\\s+(?:\\w+\\s+){0,2}${GROWTH_VERB}\\b`),
    /\b(?:an?\s+)?(?:increase|decrease|rise|drop|growth|decline|surge|augmentation|hausse|baisse|diminution|croissance|progression)\s+(?:in|of|de|du|des)\b/,
  ],
  evolution_word: [new RegExp(`\\b${GROWTH_VERB}\\b|\\btrend\\w*|\\btendance\\w*|\\bevolu\\w*|\\bhausse\\b|\\bbaisse\\b|\\bgrowth\\b`)],
  comparison: [
    /\b(?:more|less|fewer|higher|lower|cheaper|pricier|bigger|smaller|better|worse)\b[^.!?;]*\bthan\b/,
    /\bcompared (?:to|with)\b|\bversus\b|\bvs\.?(?=\s)|\brelative to\b|\bpar rapport a\b/,
    /\bplus (?:cher|chere|chers|cheres|elev\w+|haut\w*|bas\w*|grand\w*|petit\w*)\b|\bmoins (?:cher|chere|chers|cheres|elev\w+)\b|\bsuperieur\w*|\binferieur\w*/,
    /\b(?:double|doubl\w*|triple|tripl\w*|twice|thrice|half|halve\w*|moitie)\b/,
  ],
  market_superlative: [
    /\b(?:most|least|best|highest|lowest|cheapest|biggest|largest|leading)\s+(?:\w+\s+){0,2}(?:profitable|popular|expensive|lucrative|booked|visited|demanded|competitive|rentable|performing|in demand|neighbou?rhood|district|area|city|market|destination|season)/,
    /\b(?:le|la|les) plus (?:\w+\s+){0,1}(?:rentables?|populaires?|chers?|cheres?|demandes?|visites?|reserves?)\b|\bmeilleur\w*\s+(?:quartier|marche|moment|periode|saison|ville|endroit|zone|destination)|\bquartier le plus\b/,
  ],
  superlative_word: [
    /\b(?:most|least|best|worst|top|highest|lowest|cheapest|leading|biggest|largest|smallest|number one)\b|#1|\ble plus\b|\bla plus\b|\bles plus\b|\bmeilleur\w*|\bpire\w*|\bplus grand\w*|\bnumero un\b/,
  ],
  generalization: [
    /\b(?:all|every|everyone|everybody|nobody|always|never|tous les|toutes les|toujours|jamais|chaque|tout le monde|personne ne)\b/,
  ],
  regulatory: [
    /\b(?:regulat\w*|law|laws|legal\w*|illegal|statute|ordinance|decree|by-?law|licen[cs]\w*|permit\w*|registration|registered|tax\w*|compliance|compliant|required by|mandatory|prohibit\w*|banned|forbidden|night cap|reglementation\w*|loi|lois|legalement|obligatoire\w*|interdit\w*|autorisation\w*|permis|taxe\w*|declaration|enregistrement|plafond de nuits|conforme|conformite|impose\w*|exige\w*)\b/,
  ],
  preference: [
    /\b(?:travell?ers?|guests?|visitors?|tourists?|hosts?|voyageurs?|visiteurs?|touristes?|hotes?|clients?)\s+(?:\w+\s+){0,2}(?:prefer\w*|want\w*|expect\w*|love\w*|like\w*|choose\w*|look(?:s)? for|seek\w*|value\w*|search\w*|souhait\w*|attendent|recherch\w*|choisissent|privilegi\w*|aiment|veulent)\b/,
  ],
  demand: [
    /\b(?:high demand|strong demand|low demand|demand is|peak (?:season|period)|high season|low season|off-?season|busy season|forte demande|demande (?:forte|elevee|faible)|haute saison|basse saison|periode de pointe|saison creuse|affluence)\b/,
  ],
  platform_authority: [
    /\b(?:airbnb|booking(?:\.com)?|vrbo|expedia|agoda|the platform|la plateforme)\s+(?:\w+\s+){0,3}(?:recommend\w*|requir\w*|says?|said|state[sd]?|prioriti[sz]\w*|rank\w*|favou?r\w*|reward\w*|penali[sz]\w*|prefer\w*|promot\w*|boost\w*|suggest\w*|advise\w*|policy|recommande\w*|exige\w*|indique\w*|privilegie\w*|favorise\w*|classe\w*|penalise\w*|valorise\w*|met en avant|conseille\w*)\b|\balgorithm\w*|\balgorithme\w*/,
  ],
  vague_attribution: [
    /\b(?:according to (?:the |our |recent |latest )?(?:data|studies|study|research|statistics|analysis|reports?|experts?|surveys?)|data (?:shows?|indicates?|suggests?|reveals?)|studies (?:show|suggest|indicate|prove)|research (?:shows?|suggests?|indicates?|proves?)|statistics (?:show|indicate)|surveys? (?:show|indicate)|experts? (?:say|agree|recommend)|it is (?:well )?known|selon (?:les|nos|des|une|la) (?:donnees|etudes?|recherches?|statistiques|analyses?|experts?|sondages?)|les (?:donnees|etudes|statistiques) (?:montrent|indiquent|prouvent|revelent)|il est (?:prouve|demontre|connu)|etudes? montrent?)\b/,
  ],
  causal: [
    /\b(?:because|therefore|thus|hence|leads? to|led to|results? in|resulted in|cause[sd]?|causing|due to|thanks to|as a result|drives?|driving|entraine\w*|provoque\w*|grace a|donc|par consequent|en raison de|conduit a|car|since|explains?|parce que|puisque)\b|\bso (?:that )?(?:guests?|hosts?|travell?ers?|you|they|bookings?)\b|\bwhich (?:means|shows|proves)\b|\b(?:fills?|boosts?|improves?|increases?|raises?|lifts?|brings?|attracts?|wins?|generates?|maximi[sz]es?|doubles?|triples?|multipl\w+)\s+(?:the |your |more |bookings?|calendar|occupancy|revenue|conversion|visibility)/,
  ],
  guarantee: [
    /\b(?:guarantee\w*|ensures|ensuring|ensured|never fail\w*|garanti\w*|assure\w*|a coup sur|vous obtiendrez|vous obtenez|doublera|triplera|sans risque|risk-?free|no risk|promis\w*|promises?|promised|pledge\w*|promet\w*|promettons|count on|counting on|sure to|certain to|bound to|sur d'avoir|surement)\b/,
    /\bwill (?:definitely|certainly|surely) \w+/,
  ],
  certainty: [
    /\b(?:obviously|undoubtedly|definitely|certainly|surely|for sure|without a doubt|no doubt|it is certain|proves?|proven|prove that|incontestably|evidently|beyond doubt|evidemment|sans aucun doute|certainement|incontestablement|il est certain|prouve|sans doute|de toute evidence)\b|\bclearly (?:prove|show|demonstrat|indicat|mean|is|are|better|best|the)|\bclairement (?:prouve|montre|demontre|indique|signifie|est|sont|mieux|meilleur)/,
  ],
  observation: [
    /\b(?:observed|we observed|shows? that|showed that|found that|data (?:shows?|confirms?)|confirmed|results show|measured|demonstrated|demonstrates|a observe|montre que|montrent que|a montre|confirme|constate|mesure|demontre)\b/,
  ],
  implicit_fact: [
    /\b(?:is|are|was|were)\s+(?:also\s+|often\s+|widely\s+)?(?:known|famous|home|located|situated|the (?:capital|largest|oldest|biggest)|popular|renowned|rated)\b|\b(?:famous|renowned|known) for\b|\b(?:a|an|the)\s+(?:\w+\s+)?(?:famous|renowned|well-known|celebrated|legendary|iconic)\b|\bhome to\b|\blocated (?:in|on|near)\b|\bsituated\b|\binhabitants?\b|\bpopulation\b|\b(?:est|sont|etait) (?:connu|connue|connus|connues|celebre|celebres|situe|situee|la capitale|le plus|la plus)\b|\bcelebre\b|\breputee?s?\b|\bhabitants?\b|\bofficiellement\b|\bofficial(?:ly)?\b|\bthe law\b/,
  ],
  occupancy: [/\b(?:occupanc\w*|occupation|(?:un)?occupied|occupe\w*|vacan\w*|booked|reserve\w*|fully booked|taux d'occupation)\b/],
  quantifier: [
    /\b(?:a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:half|halves|third|thirds|quarter|quarters|fifth|fifths|tenth|tenths)\b|\b(?:half|quarter|third|fifth|tenth) of\b/,
    /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:in|out of)\s+(?:every\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|hundred)\b/,
    /\b(?:majority|minority|plurality|many|several|numerous|a lot of|lots of|a number of|the bulk of|most of|plenty of|countless|dozens?|hundreds?|thousands?|millions?)\b/,
    /\b(?:un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:\w+\s+){0,2}sur\s+(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|cent|\d+)\b|\b(?:un|une) (?:tiers|quart|demi|moitie)\b|\b(?:majorite|minorite|moitie|plupart|totalite|plusieurs|nombreux|nombreuses|beaucoup|des dizaines|des centaines|des milliers)\b/,
  ],
  pricing_advice: [
    /\b(?:should|must|ought to|need to|needs to|have to|had better|better)\s+(?:\w+\s+){0,3}?(?:charge|price|pricing|raise|lower|cut|reduce|increase|decrease|set (?:a |the |your )?(?:nightly |daily )?(?:price|rate))\b/,
    /\b(?:raise|lower|cut|reduce|increase|decrease|adjust|undercut|match|beat)\s+(?:\w+\s+){0,2}(?:prices?|rates?|pricing|tarifs?)\b|\b(?:charge|price)\s+(?:your|the|it|them|less|more|higher|lower|below|above|at)\b/,
    /\b(?:fair|competitive|reasonable|right|ideal|optimal|good|cheap|expensive|overpriced|underpriced|affordable)\s+(?:nightly\s+)?(?:price|rate|pricing|tarif|prix)\b|\b(?:keeps?|keep|stay|stays|remain|remains)\s+(?:you\s+)?competitive\b|\bcompetitive (?:edge|advantage)\b/,
    /\b(?:devriez|devez|devrait|il faut|il vaut mieux|fixez|facturez|baissez|augmentez|reduisez|ajustez|alignez)\b[^.!?;]*\b(?:prix|tarifs?|nuitee)\b/,
  ],
  future_effect: [
    /\bwill (?:increase|boost|improve|raise|double|triple|get|bring|help|make|ensure|lead|result|fill|attract|win|generate)\b|\b(?:augmentera|ameliorera|attirera|remplira|fera)\b/,
  ],
  implicit_comparison: [
    /\b(?:outperform\w*|exceed\w*|surpass\w*|outrank\w*|(?:more|less) (?:expensive|popular|profitable|competitive|attractive|affordable|likely)|(?:better|worse|higher|lower|cheaper|pricier) (?:reviews?|ratings?|scores?|prices?|rates?|occupancy|revenue|conversion\w*|results?|returns?))\b|\bplus (?:populaire|rentable|attractif|attractive)s?\b/,
  ],
  benchmark: [
    /\b(?:benchmark\w*|norms?|normal|standard|baseline|market rate|going rate|par for the course|reference price|prix de reference|tarif du marche|moyenne du marche|reference|average|mean|moyenn\w*|typical\w*|typique\w*|habituel\w*)\b/,
  ],
};

const HEDGE = /\b(?:may|might|can|could|often|sometimes|tend(?:s)? to|peut|peuvent|pourrait|pourraient|souvent|parfois|tend a|tendent a)\b/;
const NEGATION = /\b(?:not|no|n't|non|pas|ne|neither|rather than|plutot que|instead of|au lieu de)\b/;
const GUARANTEE_DISCLAIMER =
  /\b(?:no guarantee|not guarantee|does not guarantee|do not guarantee|doesn't guarantee|cannot guarantee|can't guarantee|without guarantee|aucune garantie|ne garantit pas|ne garantissent pas|sans garantie|pas de garantie)\b/;

const GUARANTEE_DISCLAIMER_GLOBAL = new RegExp(GUARANTEE_DISCLAIMER.source, "g");

// --- Analysis -----------------------------------------------------------------------------------

function classify(unit: string, hasCurrencyPrefix: boolean): { category: NumberCategory; currency: string | null; recognized: boolean } {
  const word = unit.trim();
  if (hasCurrencyPrefix) return { category: "currency", currency: null, recognized: true };
  if (PERCENT_WORDS.has(word)) return { category: "percent", currency: null, recognized: true };
  if (Object.hasOwn(CURRENCY_WORDS, word)) return { category: "currency", currency: CURRENCY_WORDS[word]!, recognized: true };
  if (DURATION_WORDS.has(word)) return { category: "duration", currency: null, recognized: true };
  if (DISTANCE_WORDS.has(word)) return { category: "distance", currency: null, recognized: true };
  if (word === "x") return { category: "multiplier", currency: null, recognized: true };
  // an unrelated following word ("in 2026 and …") is not a unit
  return { category: "quantity", currency: null, recognized: false };
}

export function analyzeClaimText(text: string): TextAnalysis {
  const folded = fold(text);
  const sentences = splitSentences(folded);
  const indexOfPosition = (position: number): number => {
    let found = 0;
    sentences.forEach((sentence, index) => {
      if (position >= sentence.start) found = index;
    });
    return found;
  };

  const tokens: NumericToken[] = [];

  // ISO dates first; they are blanked out so that their parts are not read as separate numbers.
  const withoutDates = folded.replace(ISO_DATE, (whole, year: string, month: string, day: string, offset: number) => {
    const valid = Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31;
    tokens.push({
      category: "date",
      candidates: [Number(year)],
      decimals: 0,
      currency: null,
      unit: "",
      structural: false,
      isoDate: valid ? whole : null,
      sentence: indexOfPosition(offset),
      position: offset,
    });
    return " ".repeat(whole.length);
  });

  let blanked = withoutDates;
  for (const match of withoutDates.matchAll(NUMBER)) {
    const prefix = match[1];
    const written = match[2]!;
    const unit = match[3] ?? "";
    const { category: baseCategory, currency: unitCurrency, recognized } = classify(unit, prefix !== undefined);
    const prefixCurrency = prefix === undefined ? null : CURRENCY_WORDS[prefix.trim()] ?? null;
    const candidates = numericCandidates(written);
    const integer = candidates.length === 1 && Number.isInteger(candidates[0]) && candidates[0]! >= 1 && candidates[0]! <= MAX_STRUCTURAL_NUMBER;
    const lineStart = withoutDates.lastIndexOf("\n", match.index! - 1) + 1;
    const afterMarker = withoutDates.slice(match.index! + written.length, match.index! + written.length + 2);
    const isListMarker = integer && !recognized && prefix === undefined && withoutDates.slice(lineStart, match.index!).trim() === "" && /^[.)]\s/.test(afterMarker);
    let sentenceStart = lineStart;
    for (const mark of [".", "!", "?", ";"]) sentenceStart = Math.max(sentenceStart, withoutDates.lastIndexOf(mark, match.index! - 1) + 1);
    const leading = withoutDates.slice(sentenceStart, match.index!).trim();
    const isStepNumber = integer && !recognized && prefix === undefined && STRUCTURAL_WORD.test(leading);
    let category: NumberCategory = baseCategory;
    if (category === "quantity" && candidates.length > 0 && Number.isInteger(candidates[0]) && candidates[0]! >= 1900 && candidates[0]! <= 2100 && !recognized) {
      category = "year";
    }
    tokens.push({
      category,
      candidates,
      decimals: decimalsOf(written),
      currency: prefixCurrency ?? unitCurrency,
      unit: unit.trim(),
      structural: isListMarker || isStepNumber,
      isoDate: null,
      sentence: indexOfPosition(match.index!),
      position: match.index!,
    });
    blanked = blanked.slice(0, match.index!) + " ".repeat(match[0].length) + blanked.slice(match.index! + match[0].length);
  }

  // Number words are quantities whatever follows them; they can never be backed by a figure. "one", "un" and
  // "une" are not counted on their own (pronoun, article): they only matter inside the fractions of `quantifier`.
  const spelled =
    /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|billions?|dozens?|deux|trois|quatre|cinq|sept|huit|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent|cents|mille|milliers?|douzaines?|centaines?|dizaines?)\b/g;
  for (const match of blanked.matchAll(spelled)) {
    tokens.push({
      category: "quantity",
      candidates: [],
      decimals: 0,
      currency: null,
      unit: "",
      structural: false,
      isoDate: null,
      sentence: indexOfPosition(match.index!),
      position: match.index!,
    });
  }
  tokens.sort((a, b) => a.position - b.position);

  const sentenceAnalyses: SentenceAnalysis[] = sentences.map((sentence, index) => {
    const hits = new Set<RiskClass>();
    // A disclaimer is removed before matching, so it can never shield a positive guarantee elsewhere in the sentence.
    const withoutDisclaimer = sentence.text.replace(GUARANTEE_DISCLAIMER_GLOBAL, " ");
    for (const [name, patterns] of Object.entries(PATTERNS) as [RiskClass, readonly RegExp[]][]) {
      const subject = name === "guarantee" ? withoutDisclaimer : sentence.text;
      if (patterns.some((pattern) => pattern.test(subject))) hits.add(name);
    }
    return Object.freeze({
      index,
      hits,
      hedged: HEDGE.test(sentence.text),
      negated: NEGATION.test(sentence.text),
      guaranteeDisclaimer: GUARANTEE_DISCLAIMER.test(sentence.text),
    });
  });

  const allHits = new Set<RiskClass>();
  for (const sentence of sentenceAnalyses) sentence.hits.forEach((name) => allHits.add(name));

  return Object.freeze({
    tokens: Object.freeze(tokens),
    sentences: Object.freeze(sentenceAnalyses),
    hits: allHits,
  });
}

/** True when `needle` (folded comparison) occurs in `text`. */
export function foldedIncludes(text: string, needle: string): boolean {
  const target = fold(needle).trim();
  return target.length > 0 && fold(text).includes(target);
}
