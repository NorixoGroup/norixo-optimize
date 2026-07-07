import { buildPrompt } from "../lib/marketing-ai/prompts/social.prompt";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function buildSocialPrompt(
  channel: "facebook" | "instagram" | "linkedin" | "tiktok",
) {
  return buildPrompt({
    channel,
    format: channel === "instagram" || channel === "tiktok" ? "reel" : "post",
    topic: "Identifier les points de friction d'une annonce",
    goal: "education",
    angle:
      channel === "facebook"
        ? "situation concrete d'hote et friction visible"
        : channel === "instagram"
          ? "benefice immediat et lecture mobile"
          : channel === "tiktok"
            ? "hook ultra court, une friction principale, narration prononcable en 10 secondes"
          : "observation metier et logique cause impact action",
    audience: "Conciergeries et hotes professionnels",
    cta: "Decouvrir Norixo.io",
    language: "fr",
    context:
      "Campaign objective (source of truth): aider les hotes a identifier les points de friction, clarifier les priorites et preparer des actions d'amelioration.",
  });
}

async function main() {
  const facebookPrompt = buildSocialPrompt("facebook");
  const instagramPrompt = buildSocialPrompt("instagram");
  const linkedInPrompt = buildSocialPrompt("linkedin");
  const tikTokPrompt = buildSocialPrompt("tiktok");

  for (const prompt of [facebookPrompt, instagramPrompt, linkedInPrompt, tikTokPrompt]) {
    assert(
      prompt.includes(
        "The campaign idea is shared across channels, but the editorial treatment must be native to the requested platform.",
      ),
      "Expected shared campaign / native platform differentiation rule.",
    );
    assert(
      prompt.includes(
        "Do not paraphrase the same caption across Facebook, Instagram, LinkedIn and TikTok.",
      ),
      "Expected prompt to forbid paraphrasing the same caption across channels.",
    );
    assert(
      prompt.includes(
        "Do not preserve the same sentence order across channels.",
      ),
      "Expected prompt to forbid preserving the same sentence order across channels.",
    );
    assert(
      prompt.includes("Do not reuse the same hook across channels."),
      "Expected prompt to forbid reusing the same hook across channels.",
    );
  }

  assert(
    facebookPrompt.includes(
      "Start the very first sentence with one concrete host situation, listing example or visible listing problem.",
    ),
    "Expected Facebook contract to require a concrete example in the first sentence.",
  );
  assert(
    facebookPrompt.includes(
      'The first sentence must mention a concrete example, not only an abstract phrase like "points de friction".',
    ),
    "Expected Facebook contract to reject vague abstract openings.",
  );
  assert(
    facebookPrompt.includes("Explain the problem in accessible language."),
    "Expected Facebook contract to require explanation.",
  );
  assert(
    facebookPrompt.includes("Connect the problem to a concrete consequence on the listing."),
    "Expected Facebook contract to require consequence.",
  );
  assert(
    facebookPrompt.includes("End with one real short question."),
    "Expected Facebook contract to require a short final question.",
  );
  assert(
    facebookPrompt.includes("Use a conversational, pedagogical tone and a conversational or educational CTA."),
    "Expected Facebook contract to require a conversational CTA.",
  );

  assert(
    instagramPrompt.includes("The first line must contain 6 words maximum."),
    "Expected Instagram contract to cap the first line at 6 words.",
  );
  assert(
    instagramPrompt.includes("Use a very short, direct hook with no long opening sentence."),
    "Expected Instagram contract to require a direct short hook.",
  );
  assert(
    instagramPrompt.includes("Keep the caption compact and avoid long paragraphs."),
    "Expected Instagram contract to require a compact caption.",
  );
  assert(
    instagramPrompt.includes("Keep sentences short and pacing fast."),
    "Expected Instagram contract to require short sentences and fast pacing.",
  );
  assert(
    instagramPrompt.includes("Deliver an immediate benefit in the opening lines."),
    "Expected Instagram contract to require immediate benefit.",
  );
  assert(
    instagramPrompt.includes("Use a maximum of 3 short bullets when helpful."),
    "Expected Instagram contract to cap bullet count at 3.",
  );
  assert(
    instagramPrompt.includes("Keep the CTA very short."),
    "Expected Instagram contract to require a very short CTA.",
  );
  assert(
    instagramPrompt.includes(
      "Use native, targeted Instagram hashtags and allow more of them than Facebook or LinkedIn when relevant, without spam.",
    ),
    "Expected Instagram contract to require a native hashtag strategy.",
  );

  assert(
    tikTokPrompt.includes("HOOK") &&
      tikTokPrompt.includes("PROBLEME") &&
      tikTokPrompt.includes("INSIGHT") &&
      tikTokPrompt.includes("ACTION") &&
      tikTokPrompt.includes("CTA COURT"),
    "Expected TikTok contract to require the native hook/problem/insight/action/CTA flow.",
  );
  assert(
    tikTokPrompt.includes(
      "The opening phrase must feel understandable in the first 1 to 2 seconds.",
    ),
    "Expected TikTok contract to require a first 1 to 2 second hook.",
  );
  assert(
    tikTokPrompt.includes("Make the first phrase extremely short."),
    "Expected TikTok contract to require an extremely short first phrase.",
  );
  assert(
    tikTokPrompt.includes("Focus on one single friction point only."),
    "Expected TikTok contract to focus on a single friction point.",
  );
  assert(
    tikTokPrompt.includes("Keep phrases very short and naturally speakable out loud."),
    "Expected TikTok contract to require spoken-language friendly phrasing.",
  );
  assert(
    tikTokPrompt.includes("Use 3 to 5 hashtags maximum."),
    "Expected TikTok contract to cap hashtags at 3 to 5.",
  );
  assert(
    tikTokPrompt.includes(
      "Make the script compatible with a 10-second narrated vertical video.",
    ),
    "Expected TikTok contract to stay compatible with the 10-second narration pipeline.",
  );
  assert(
    tikTokPrompt.includes('Avoid starting with "Avec Norixo..." or equivalent generic introductions.'),
    "Expected TikTok contract to reject generic Norixo openings.",
  );

  assert(
    linkedInPrompt.includes("Start from a professional observation, operational pattern or business reality."),
    "Expected LinkedIn contract to require a professional observation.",
  );
  assert(
    linkedInPrompt.includes("Constat:"),
    "Expected LinkedIn contract to require an explicit Constat section.",
  );
  assert(
    linkedInPrompt.includes("Cause:"),
    "Expected LinkedIn contract to require an explicit Cause section.",
  );
  assert(
    linkedInPrompt.includes("Impact:"),
    "Expected LinkedIn contract to require an explicit Impact section.",
  );
  assert(
    linkedInPrompt.includes("Action:"),
    "Expected LinkedIn contract to require an explicit Action section.",
  );
  assert(
    linkedInPrompt.includes("Structure the reasoning clearly as cause, impact, action."),
    "Expected LinkedIn contract to require cause/impact/action.",
  );
  assert(
    linkedInPrompt.includes("Use a professional CTA and limited professional hashtags."),
    "Expected LinkedIn contract to require a professional CTA.",
  );
  assert(
    linkedInPrompt.includes(
      "Use a professional B2B tone with a hospitality, short-term rental, operator, property management or conversion optimization angle when relevant.",
    ),
    "Expected LinkedIn contract to require a business/operator/hospitality angle.",
  );
  assert(
    linkedInPrompt.includes("Avoid long dense paragraphs. Prefer short blocks or line breaks."),
    "Expected LinkedIn contract to forbid long dense paragraphs.",
  );
  assert(
    facebookPrompt.includes(
      'Avoid vague repetition such as "mieux comprendre votre annonce" or generic phrases that do not add a concrete insight.',
    ) &&
      instagramPrompt.includes(
        'Avoid vague repetition such as "mieux comprendre votre annonce" or generic phrases that do not add a concrete insight.',
      ) &&
      tikTokPrompt.includes(
        'Avoid vague repetition such as "mieux comprendre votre annonce" or generic phrases that do not add a concrete insight.',
      ) &&
      linkedInPrompt.includes(
        'Avoid vague repetition such as "mieux comprendre votre annonce" or generic phrases that do not add a concrete insight.',
      ),
    "Expected the anti-vague rule to be present for all channels.",
  );

  console.log(
    JSON.stringify(
      {
        checkedChannels: ["facebook", "instagram", "linkedin", "tiktok"],
        facebookRulesVerified: true,
        instagramRulesVerified: true,
        tikTokRulesVerified: true,
        linkedInRulesVerified: true,
        globalDivergenceRulesVerified: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
