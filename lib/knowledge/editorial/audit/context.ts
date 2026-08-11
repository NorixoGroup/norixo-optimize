import { getEditorialClusters } from "../cluster-governance";
import type { EditorialClusterDefinition } from "../cluster-governance-types";
import { buildEditorialContentNodes } from "../content-adapter";
import { getEditorialMappings } from "../mapping-registry";
import { canonicalEditorialNodes } from "../taxonomy";
import type { EditorialMapping } from "../mapping-registry";
import type { ContentNode, EditorialNode } from "../types";

export interface EditorialAuditContext {
  contentNodes: readonly ContentNode[];
  editorialNodes: readonly EditorialNode[];
  mappings: readonly EditorialMapping[];
  clusterDefinitions: readonly EditorialClusterDefinition[];
}

export function buildEditorialAuditContext(): EditorialAuditContext {
  return {
    contentNodes: buildEditorialContentNodes(),
    editorialNodes: canonicalEditorialNodes,
    mappings: getEditorialMappings(),
    clusterDefinitions: getEditorialClusters(),
  };
}
