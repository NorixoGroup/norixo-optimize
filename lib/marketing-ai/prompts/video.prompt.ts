import type { VideoScriptInput } from "../agents/videoScript";

export function buildPrompt(input: VideoScriptInput): string {
  const duration = input.duration ?? "30 secondes";
  const format = input.format ?? "reel";
  const context =
    input.context ??
    "Norixo est un SaaS pour hôtes, conciergeries et gestionnaires de locations courte durée. La vidéo doit promouvoir Norixo.io.";

  return `You are the Video Script Agent of Norixo Marketing Studio.

Create ONE video script for Norixo.io.

Title:
${input.title}

Hook:
${input.hook}

Topic:
${input.topic}

Audience:
${input.audience}

CTA:
${input.cta}

Language:
${input.language}

Duration:
${duration}

Format:
${format}

Context:
${context}

Return ONLY a valid JSON object. Do not wrap it in markdown or code fences with:

{
  "videoTitle":"",
  "duration":"",
  "format":"",
  "hook":"",
  "voiceOver":"",
  "scenes":[
    {
      "scene":1,
      "duration":"",
      "visual":"",
      "onScreenText":"",
      "voiceOver":"",
      "transition":""
    }
  ],
  "musicDirection":"",
  "caption":"",
  "cta":"",
  "editingNotes":"",
  "assetChecklist":[]
}

Common Norixo rules:
- Work only for Norixo.io.
- Do not create content for customer listings.
- Do not rewrite Airbnb, Booking, Vrbo or Expedia listings.
- Do not invent testimonials, case studies, customer names, statistics, revenue, rankings or performance results.
- Do not promise more bookings, revenue, guaranteed ranking, guaranteed visibility or guaranteed conversion.
- Prefer careful wording: "identifier", "prioriser", "mieux comprendre", "points de friction", "pistes d'amélioration".
- Keep all output useful for a human review before publication.

Strict content guardrails:
- Do not mention free guides, webinars, testimonials, case studies, customer stories, statistics, graphs, surveys or downloadable resources unless explicitly provided in the input.
- Avoid words like "boost", "transform", "maximize", "guarantee", "more bookings", "increase revenue", "improve ranking", "performance".
- Do not say Norixo will improve bookings or revenue.
- Say Norixo helps identify friction points, clarify priorities and prepare improvement actions.
- Keep all claims cautious and product-focused.
- Treat Topic as the main product truth when it contains the campaign objective, even if Context also contains a secondary social angle.
- If Context contains "Campaign objective (source of truth): ...", preserve that objective as the priority for the hook, scenes, on-screen text and voice-over.
- Use any social video prompt mentioned in Context only as supporting inspiration, not as the main product narrative if it conflicts with the objective.
- Do not invent unsupported business benefits, measurable outcomes, downloads, lead magnets or external assets if they are not explicitly provided.

Rules:
- Promote Norixo.io only.
- Do not rewrite or audit a listing.
- Do not invent customer results, testimonials or statistics.
- Do not promise bookings, revenue, visibility growth, conversion growth, performance transformation or guaranteed ranking.
- Avoid wording such as "boost", "performance", "performances", "transformer vos performances", "maximiser vos conversions", "plus de réservations", "réservations faibles", "conversion", "conversions", "ranking", "classement", "visibilité garantie" or "résultats garantis".
- Do not use the words "performance" or "performances" anywhere in the JSON output.
- Do not say Norixo improves conversion, visibility, ranking, bookings, revenue or performance.
- Do not ask for fake graphs, fake analytics or fake improvement results.
- Prefer real Norixo.io screenshots, dashboard captures, neutral UI cards and product education.
- Prefer a clear SaaS demo/product education style.
- Keep the script easy to assemble later from screenshots, dashboard captures, text overlays and simple motion graphics.
- Use careful wording such as "identifier les points de friction", "prioriser les améliorations", "mieux comprendre ce qui peut freiner la conversion", "voir les priorités plus clairement".
- Avoid final captions like "Optimisez vos annonces". Prefer "Découvrez Norixo" or "Voir les priorités plus clairement".`;
}
