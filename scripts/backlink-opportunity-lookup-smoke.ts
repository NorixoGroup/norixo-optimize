import { getBacklinkOpportunityByIdentity } from "../lib/backlinks/repositories/opportunitiesRepository";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const otherWorkspaceId = "00000000-0000-4000-8000-000000000002";
const identity = {
  workspaceId,
  domainId: "00000000-0000-4000-8000-000000000003",
  targetPageUrl: "https://example.com/resources",
  opportunityType: "Resource Page",
  assetId: "00000000-0000-4000-8000-000000000004",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function repositoryClient(data: object | null) {
  const calls: { tables: string[]; filters: Array<{ column: string; value: string }> } = {
    tables: [],
    filters: [],
  };
  const query = {
    select() {
      return query;
    },
    eq(column: string, value: string) {
      calls.filters.push({ column, value });
      return query;
    },
    async maybeSingle() {
      return { data, error: null };
    },
  };
  return {
    client: {
      from(table: string) {
        calls.tables.push(table);
        return query;
      },
    },
    calls,
  };
}

async function lookup(client: object, lookupIdentity: typeof identity): Promise<unknown> {
  return Reflect.apply(getBacklinkOpportunityByIdentity, undefined, [client, lookupIdentity]);
}

async function main(): Promise<void> {
  const opportunity = { id: "opportunity-id", workspace_id: workspaceId };
  const foundRepository = repositoryClient(opportunity);
  const found = await lookup(foundRepository.client, identity);
  assert(found === opportunity, "Expected the matching opportunity.");
  assert(
    JSON.stringify(foundRepository.calls) ===
      JSON.stringify({
        tables: ["backlink_opportunities"],
        filters: [
          { column: "workspace_id", value: workspaceId },
          { column: "domain_id", value: identity.domainId },
          { column: "target_page_url", value: identity.targetPageUrl },
          { column: "opportunity_type", value: identity.opportunityType },
          { column: "asset_id", value: identity.assetId },
        ],
      }),
    "Expected complete opportunity identity and workspace filters.",
  );

  for (const differentIdentity of [
    { ...identity, targetPageUrl: "https://example.com/other" },
    { ...identity, assetId: "00000000-0000-4000-8000-000000000005" },
    { ...identity, workspaceId: otherWorkspaceId },
  ]) {
    const absentRepository = repositoryClient(null);
    const result = await lookup(absentRepository.client, differentIdentity);
    assert(result === null, "Expected null when any identity part differs.");
  }

  console.log("backlink opportunity lookup smoke: PASS");
}

void main();
