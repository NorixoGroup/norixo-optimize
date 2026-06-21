import { readFile } from "node:fs/promises";
import path from "node:path";

type MarketingAiRegistryScenario = {
  id?: unknown;
  campaign?: unknown;
  status?: unknown;
  readiness?: unknown;
};

type MarketingAiDashboardScenario = {
  id: string;
  campaign: string;
  status: string;
  readiness: string;
};

type MarketingAiRegistryPayload = {
  globalStatus?: unknown;
  summary?: {
    scenarios?: unknown;
    healthy?: unknown;
    warnings?: unknown;
    errors?: unknown;
  };
  scenarios?: MarketingAiRegistryScenario[];
};

export type MarketingAiDashboardData = {
  globalStatus: string;
  scenarios: number;
  healthy: number;
  warnings: number;
  errors: number;
  readyScenario: string;
  readiness: string;
  scenariosList: MarketingAiDashboardScenario[];
  available: boolean;
  message?: string;
};

const DASHBOARD_DATA_PATH = path.join(
  process.cwd(),
  "marketing-agent",
  "dashboard-data",
  "scenario-registry.json"
);

const FALLBACK_DATA: MarketingAiDashboardData = {
  globalStatus: "UNAVAILABLE",
  scenarios: 0,
  healthy: 0,
  warnings: 0,
  errors: 0,
  readyScenario: "UNAVAILABLE",
  readiness: "UNAVAILABLE",
  scenariosList: [],
  available: false,
  message: "Dashboard data unavailable. Run dashboard export.",
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function getMarketingAiDashboard(): Promise<MarketingAiDashboardData> {
  try {
    const raw = await readFile(DASHBOARD_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as MarketingAiRegistryPayload;

    const globalStatus = isString(parsed.globalStatus)
      ? parsed.globalStatus
      : FALLBACK_DATA.globalStatus;

    const scenariosCount = isNumber(parsed.summary?.scenarios)
      ? parsed.summary.scenarios
      : 0;
    const healthyCount = isNumber(parsed.summary?.healthy) ? parsed.summary.healthy : 0;
    const warningsCount = isNumber(parsed.summary?.warnings) ? parsed.summary.warnings : 0;
    const errorsCount = isNumber(parsed.summary?.errors) ? parsed.summary.errors : 0;

    const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
    const scenariosList = scenarios
      .filter(
        (
          scenario
        ): scenario is {
          id: string;
          campaign: string;
          status: string;
          readiness: string;
        } =>
          isString(scenario.id) &&
          isString(scenario.campaign) &&
          isString(scenario.status) &&
          isString(scenario.readiness)
      )
      .map((scenario) => ({
        id: scenario.id,
        campaign: scenario.campaign,
        status: scenario.status,
        readiness: scenario.readiness,
      }));

    const readyScenarioEntry =
      scenariosList.find(
        (scenario) =>
          scenario.readiness === "READY FOR REAL PROVIDERS"
      ) ?? scenariosList[0];

    return {
      globalStatus,
      scenarios: scenariosCount,
      healthy: healthyCount,
      warnings: warningsCount,
      errors: errorsCount,
      readyScenario: readyScenarioEntry ? readyScenarioEntry.id : "NONE",
      readiness: readyScenarioEntry ? readyScenarioEntry.readiness : "BLOCKED",
      scenariosList,
      available: true,
    };
  } catch {
    return FALLBACK_DATA;
  }
}
