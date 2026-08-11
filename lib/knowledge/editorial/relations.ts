import type {
  ContentNode,
  ContentNodeId,
  EditorialGraphNode,
  EditorialGraphNodeId,
  EditorialNode,
  EditorialNodeId,
  EditorialNodeKind,
  EditorialRelation,
  EditorialRelationType,
  EditorialValidationIssue,
  EditorialValidationResult,
} from "./types";

type GraphNodeKind = "content" | EditorialNodeKind;

const contentTypes = new Set([
  "article",
  "guide",
  "tool",
  "solution",
  "ranking",
  "report",
  "local",
  "landing",
]);

export interface EditorialRelationDefinition {
  description: string;
  sourceKinds: readonly GraphNodeKind[];
  targetKinds: readonly GraphNodeKind[];
}

/**
 * The relation set is deliberately small. Each relation is directional:
 * sourceId describes, contains, supports, or points to targetId.
 */
export const editorialRelationDefinitions: Readonly<
  Record<EditorialRelationType, EditorialRelationDefinition>
> = {
  is_about: {
    description: "A content node explains or focuses on a canonical topic or entity.",
    sourceKinds: ["content"],
    targetKinds: ["topic", "entity"],
  },
  part_of_cluster: {
    description: "A content node belongs to a topical cluster represented by a topic node.",
    sourceKinds: ["content"],
    targetKinds: ["topic"],
  },
  pillar_for: {
    description: "A pillar content node is the canonical hub for a topic node.",
    sourceKinds: ["content"],
    targetKinds: ["topic"],
  },
  supports: {
    description: "A supporting content node contributes depth to a pillar content node.",
    sourceKinds: ["content"],
    targetKinds: ["content"],
  },
  applies_to: {
    description: "A content node applies to a platform, audience, or geography node.",
    sourceKinds: ["content"],
    targetKinds: ["platform", "audience", "geo"],
  },
  uses_metric: {
    description: "A content node uses a canonical metric topic such as ADR, occupancy, or RevPAR.",
    sourceKinds: ["content"],
    targetKinds: ["topic"],
  },
  commercial_path_to: {
    description: "A content node offers a relevant next step to another content node, typically a tool or solution.",
    sourceKinds: ["content"],
    targetKinds: ["content"],
  },
  related_to: {
    description: "Two nodes are semantically related without a hierarchy or commercial implication.",
    sourceKinds: ["content", "topic", "entity", "platform", "audience", "geo"],
    targetKinds: ["content", "topic", "entity", "platform", "audience", "geo"],
  },
};

function issue(path: string, message: string): EditorialValidationIssue {
  return { path, message };
}

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function getGraphNodeKind(id: string): GraphNodeKind | undefined {
  const parts = id.split(":");

  if (
    parts[0] === "content" &&
    parts.length === 3 &&
    contentTypes.has(parts[1]) &&
    parts[2]
  ) {
    return "content";
  }

  if (
    (parts[0] === "topic" ||
      parts[0] === "entity" ||
      parts[0] === "platform" ||
      parts[0] === "audience" ||
      parts[0] === "geo") &&
    parts.length === 2 &&
    parts[1]
  ) {
    return parts[0];
  }

  return undefined;
}

export function validateGraphNodeId(id: string): EditorialValidationResult {
  const issues: EditorialValidationIssue[] = [];
  const kind = getGraphNodeKind(id);

  if (!isNonEmpty(id)) {
    issues.push(issue("id", "An ID is required."));
  } else if (!kind) {
    issues.push(issue("id", "ID must use a supported, non-empty canonical namespace."));
  }

  return { valid: issues.length === 0, issues };
}

export function validateContentNode(node: ContentNode): EditorialValidationResult {
  const issues = [...validateGraphNodeId(node.id).issues];
  const expectedPrefix = `content:${node.contentType}:`;

  if (!node.id.startsWith(expectedPrefix)) {
    issues.push(issue("id", "Content ID namespace must match contentType."));
  }

  (["slug", "path", "title", "source", "locale"] as const).forEach((field) => {
    if (!isNonEmpty(node[field])) {
      issues.push(issue(field, `${field} is required.`));
    }
  });

  return { valid: issues.length === 0, issues };
}

export function validateEditorialNode(node: EditorialNode): EditorialValidationResult {
  const issues = [...validateGraphNodeId(node.id).issues];

  if (!node.id.startsWith(`${node.kind}:`)) {
    issues.push(issue("id", "Editorial ID namespace must match kind."));
  }

  if (!isNonEmpty(node.label)) {
    issues.push(issue("label", "A label is required."));
  }

  return { valid: issues.length === 0, issues };
}

export function validateEditorialNodes(
  nodes: readonly EditorialGraphNode[]
): EditorialValidationResult {
  const issues: EditorialValidationIssue[] = [];
  const ids = new Set<string>();

  nodes.forEach((node, index) => {
    const validation = "contentType" in node ? validateContentNode(node) : validateEditorialNode(node);
    validation.issues.forEach((validationIssue) => {
      issues.push(issue(`nodes[${index}].${validationIssue.path}`, validationIssue.message));
    });

    if (ids.has(node.id)) {
      issues.push(issue(`nodes[${index}].id`, `Duplicate ID: ${node.id}.`));
    }

    ids.add(node.id);
  });

  return { valid: issues.length === 0, issues };
}

export function validateEditorialRelation(
  relation: EditorialRelation,
  nodes: readonly EditorialGraphNode[]
): EditorialValidationResult {
  const issues: EditorialValidationIssue[] = [];
  const definition = editorialRelationDefinitions[relation.type];
  const sourceKind = getGraphNodeKind(relation.sourceId);
  const targetKind = getGraphNodeKind(relation.targetId);
  const knownIds = new Set(nodes.map((node) => node.id));

  if (!definition) {
    issues.push(issue("type", "Unknown editorial relation type."));
  }

  if (!sourceKind) {
    issues.push(issue("sourceId", "Source ID must use a supported, non-empty canonical namespace."));
  }

  if (!targetKind) {
    issues.push(issue("targetId", "Target ID must use a supported, non-empty canonical namespace."));
  }

  if (relation.sourceId === relation.targetId) {
    issues.push(issue("targetId", "An editorial relation cannot target its source node."));
  }

  if (!knownIds.has(relation.sourceId)) {
    issues.push(issue("sourceId", "Source ID is not present in the supplied registry."));
  }

  if (!knownIds.has(relation.targetId)) {
    issues.push(issue("targetId", "Target ID is not present in the supplied registry."));
  }

  if (definition && sourceKind && !definition.sourceKinds.includes(sourceKind)) {
    issues.push(issue("sourceId", `Relation ${relation.type} does not accept ${sourceKind} sources.`));
  }

  if (definition && targetKind && !definition.targetKinds.includes(targetKind)) {
    issues.push(issue("targetId", `Relation ${relation.type} does not accept ${targetKind} targets.`));
  }

  return { valid: issues.length === 0, issues };
}

export function validateEditorialRelations(
  relations: readonly EditorialRelation[],
  nodes: readonly EditorialGraphNode[]
): EditorialValidationResult {
  const issues: EditorialValidationIssue[] = [];

  relations.forEach((relation, index) => {
    validateEditorialRelation(relation, nodes).issues.forEach((validationIssue) => {
      issues.push(issue(`relations[${index}].${validationIssue.path}`, validationIssue.message));
    });
  });

  return { valid: issues.length === 0, issues };
}

export function asContentNodeId(id: string): ContentNodeId | undefined {
  return getGraphNodeKind(id) === "content" ? (id as ContentNodeId) : undefined;
}

export function asEditorialNodeId(id: string): EditorialNodeId | undefined {
  const kind = getGraphNodeKind(id);
  return kind && kind !== "content" ? (id as EditorialNodeId) : undefined;
}

export function asEditorialGraphNodeId(id: string): EditorialGraphNodeId | undefined {
  return getGraphNodeKind(id) ? (id as EditorialGraphNodeId) : undefined;
}
