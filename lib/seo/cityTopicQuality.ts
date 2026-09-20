import type { City } from "../../data/cities";
import type { LocalSeoTopic } from "../../data/localSeo";
import { getCityTopicContentOverride } from "../../data/cityTopicContentOverrides";
import { getSearchEligibility } from "./searchEligibility";
import { getTargetedCityTopicRepairContent } from "./targetedCityTopicRepair";

export type CityTopicQualityStatus =
  | "eligible-safe"
  | "qualified-evidence"
  | "review-local-evidence"
  | "fail";

export type CityTopicQuality = Readonly<{
  pathname: string;
  technicalSafe: boolean;
  topicIntentDistinct: boolean;
  cityContextPresent: boolean;
  bespokeOverride: boolean;
  registryWinner: boolean;
  registryLocalEvidence: boolean;
  localEvidenceRequired: boolean;
  status: CityTopicQualityStatus;
}>;

function repairText(
  city: City,
  topic: LocalSeoTopic,
): string {
  const repair = getTargetedCityTopicRepairContent(city, topic);

  if (!repair) {
    return "";
  }

  return [
    repair.heading,
    repair.introduction,
    ...repair.sections.flatMap((section) => [
      section.heading,
      section.body,
    ]),
    repair.actionBridge,
  ].join(" ");
}

export function getCityTopicQuality(
  city: City,
  topic: LocalSeoTopic,
): CityTopicQuality {
  const pathname = `/airbnb-optimizer/${city.slug}/${topic.slug}`;
  const repair = getTargetedCityTopicRepairContent(city, topic);

  const technicalSafe = Boolean(repair);
  const cityContextPresent =
    technicalSafe && repairText(city, topic).includes(city.name);

  const bespokeOverride = Boolean(
    getCityTopicContentOverride(city.slug, topic.slug),
  );

  const eligibility = getSearchEligibility(pathname);
  const registryWinner = eligibility.tier === "winner";
  const registryLocalEvidence = eligibility.localEvidence === true;

  const topicIntentDistinct = technicalSafe;

  // Current repair builders use city/country as location context and
  // explicitly avoid unsupported local averages or market benchmarks.
  const localEvidenceRequired = false;

  const status: CityTopicQualityStatus =
    !technicalSafe || !cityContextPresent
      ? "fail"
      : registryWinner &&
          registryLocalEvidence &&
          bespokeOverride
        ? "qualified-evidence"
        : !localEvidenceRequired
          ? "eligible-safe"
          : "review-local-evidence";

  return Object.freeze({
    pathname,
    technicalSafe,
    topicIntentDistinct,
    cityContextPresent,
    bespokeOverride,
    registryWinner,
    registryLocalEvidence,
    localEvidenceRequired,
    status,
  });
}
