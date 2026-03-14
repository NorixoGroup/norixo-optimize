import { openai } from "@/lib/openai";
import type { ExtractedListing } from "@/lib/extractors/types";

export type AuditImprovement = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
};

export type AuditResult = {
  overallScore: number;
  photoQuality: number;
  photoOrder: number;
  descriptionQuality: number;
  amenitiesCompleteness: number;
  seoStrength: number;
  conversionStrength: number;

  strengths: string[];
  weaknesses: string[];
  improvements: AuditImprovement[];

  suggestedOpening: string;
  photoOrderSuggestions: string[];
  missingAmenities: string[];

  competitorSummary: {
    competitorCount: number;
    averageOverallScore: number;
    targetVsMarketPosition: string;
    keyGaps: string[];
    keyAdvantages: string[];
  };
};

export type RunAuditInput = {
  target: ExtractedListing;
  competitors?: ExtractedListing[];
};

export async function runAudit(input: RunAuditInput): Promise<AuditResult> {
  const competitors = (input.competitors ?? []).slice(0, 15);

  const prompt = `
You are an expert in short-term rental listing optimization.

Analyze the target listing against up to 15 nearby competitor listings.

Return ONLY strict JSON.

TARGET LISTING:
${JSON.stringify(input.target, null, 2)}

COMPETITORS:
${JSON.stringify(competitors, null, 2)}

Return ONLY JSON with this exact structure:

{
  "overallScore": number,
  "photoQuality": number,
  "photoOrder": number,
  "descriptionQuality": number,
  "amenitiesCompleteness": number,
  "seoStrength": number,
  "conversionStrength": number,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "improvements": [
    {
      "title": "string",
      "description": "string",
      "impact": "high" | "medium" | "low"
    }
  ],
  "suggestedOpening": "string",
  "photoOrderSuggestions": ["string"],
  "missingAmenities": ["string"],
  "competitorSummary": {
    "competitorCount": number,
    "averageOverallScore": number,
    "targetVsMarketPosition": "string",
    "keyGaps": ["string"],
    "keyAdvantages": ["string"]
  }
}

Rules:
- all scores must be between 0 and 10
- be realistic and critical
- focus on conversion, trust, clarity, and booking performance
- compare target listing against the competitors when competitors are available
- if competitors are weak or missing, still produce a useful audit
- do not invent amenities unless clearly inferable
- improvements must be practical and prioritized
- competitorCount must equal the number of competitors received
- averageOverallScore must be between 0 and 10
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "You are a short-term rental optimization expert. Always return strict JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  try {
    return JSON.parse(content) as AuditResult;
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error("Invalid JSON returned by OpenAI:", content);
      throw new Error("OpenAI returned invalid JSON");
    }

    return JSON.parse(jsonMatch[0]) as AuditResult;
  }
}