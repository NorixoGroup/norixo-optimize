import type {
  KnowledgeEvidence,
  KnowledgeIdentity,
  KnowledgeLifecycle,
  KnowledgeObject,
  KnowledgeRelationships,
  KnowledgeValidationIssue,
  KnowledgeValidationResult,
} from "./types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EVIDENCE_LEVELS = new Set(["E0", "E1", "E2", "E3", "E4"]);

function isNonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: string | undefined): boolean {
  return value !== undefined && ISO_DATE_PATTERN.test(value);
}

function collectReferenceIssues(
  references: { canonicalId: string }[],
  path: string,
  ownCanonicalId: string
): KnowledgeValidationIssue[] {
  const issues: KnowledgeValidationIssue[] = [];
  const seen = new Set<string>();

  references.forEach((reference, index) => {
    const referencePath = `${path}[${index}].canonicalId`;

    if (!isNonEmpty(reference.canonicalId)) {
      issues.push({ path: referencePath, message: "A canonical ID is required." });
      return;
    }

    if (reference.canonicalId === ownCanonicalId) {
      issues.push({ path: referencePath, message: "A concept cannot reference itself." });
    }

    if (seen.has(reference.canonicalId)) {
      issues.push({ path: referencePath, message: "Duplicate concept reference." });
    }

    seen.add(reference.canonicalId);
  });

  return issues;
}

export function validateIdentity(identity: KnowledgeIdentity): KnowledgeValidationIssue[] {
  const issues: KnowledgeValidationIssue[] = [];

  if (!isNonEmpty(identity.canonicalId)) {
    issues.push({ path: "identity.canonicalId", message: "A canonical ID is required." });
  }

  if (!isNonEmpty(identity.canonicalName)) {
    issues.push({ path: "identity.canonicalName", message: "A canonical name is required." });
  }

  if (!isNonEmpty(identity.version)) {
    issues.push({ path: "identity.version", message: "A version is required." });
  }

  if (!isNonEmpty(identity.owner)) {
    issues.push({ path: "identity.owner", message: "An owner is required." });
  }

  if (!EVIDENCE_LEVELS.has(identity.evidenceLevel)) {
    issues.push({
      path: "identity.evidenceLevel",
      message: "Evidence level must be one of E0, E1, E2, E3, or E4.",
    });
  }

  if (identity.status !== "draft" && !isIsoDate(identity.reviewDate)) {
    issues.push({
      path: "identity.reviewDate",
      message: "Validated or published objects require a fixed ISO review date.",
    });
  }

  if (identity.status === "merged" && !isNonEmpty(identity.canonicalId)) {
    issues.push({ path: "identity.canonicalId", message: "Merged objects retain their canonical ID." });
  }

  return issues;
}

export function validateRelationships(
  relationships: KnowledgeRelationships,
  identity: KnowledgeIdentity
): KnowledgeValidationIssue[] {
  const ownCanonicalId = identity.canonicalId;

  return [
    ...collectReferenceIssues(identity.parentConcepts, "identity.parentConcepts", ownCanonicalId),
    ...collectReferenceIssues(identity.childConcepts, "identity.childConcepts", ownCanonicalId),
    ...collectReferenceIssues(identity.relatedConcepts, "identity.relatedConcepts", ownCanonicalId),
    ...collectReferenceIssues(relationships.requires, "relationships.requires", ownCanonicalId),
    ...collectReferenceIssues(relationships.dependsOn, "relationships.dependsOn", ownCanonicalId),
    ...collectReferenceIssues(relationships.relatedTo, "relationships.relatedTo", ownCanonicalId),
    ...collectReferenceIssues(
      relationships.oftenConfusedWith,
      "relationships.oftenConfusedWith",
      ownCanonicalId
    ),
    ...collectReferenceIssues(relationships.opposite, "relationships.opposite", ownCanonicalId),
    ...collectReferenceIssues(relationships.derivedFrom, "relationships.derivedFrom", ownCanonicalId),
    ...collectReferenceIssues(relationships.uses, "relationships.uses", ownCanonicalId),
    ...collectReferenceIssues(relationships.usedBy, "relationships.usedBy", ownCanonicalId),
  ];
}

export function validateEvidence(
  evidence: KnowledgeEvidence,
  identity: KnowledgeIdentity
): KnowledgeValidationIssue[] {
  const issues: KnowledgeValidationIssue[] = [];
  const allSources = [
    ...evidence.primarySources,
    ...evidence.secondarySources,
    ...evidence.internalMethodologyReferences,
  ];

  if (identity.evidenceLevel === "E3" && evidence.primarySources.length === 0) {
    issues.push({
      path: "evidence.primarySources",
      message: "Evidence level E3 requires at least one primary source.",
    });
  }

  if (identity.evidenceLevel === "E4" && evidence.internalMethodologyReferences.length === 0) {
    issues.push({
      path: "evidence.internalMethodologyReferences",
      message: "Evidence level E4 requires an internal methodology reference.",
    });
  }

  allSources.forEach((source, index) => {
    if (!isNonEmpty(source.title)) {
      issues.push({ path: `evidence.sources[${index}].title`, message: "Source title is required." });
    }

    if (!isNonEmpty(source.url) && !isNonEmpty(source.identifier)) {
      issues.push({
        path: `evidence.sources[${index}]`,
        message: "A source URL or stable identifier is required.",
      });
    }
  });

  if (identity.status !== "draft" && !isIsoDate(evidence.lastValidation)) {
    issues.push({
      path: "evidence.lastValidation",
      message: "Validated or published objects require a fixed ISO validation date.",
    });
  }

  return issues;
}

export function validateLifecycle(lifecycle: KnowledgeLifecycle): KnowledgeValidationIssue[] {
  const issues: KnowledgeValidationIssue[] = [];

  if (lifecycle.stateHistory.length === 0) {
    issues.push({ path: "lifecycle.stateHistory", message: "Lifecycle history is required." });
  }

  lifecycle.stateHistory.forEach((event, index) => {
    if (!isIsoDate(event.date)) {
      issues.push({
        path: `lifecycle.stateHistory[${index}].date`,
        message: "Lifecycle events require a fixed ISO date.",
      });
    }

    if (!isNonEmpty(event.reason)) {
      issues.push({
        path: `lifecycle.stateHistory[${index}].reason`,
        message: "Lifecycle events require a reason.",
      });
    }
  });

  if (!isNonEmpty(lifecycle.reviewFrequency)) {
    issues.push({ path: "lifecycle.reviewFrequency", message: "A review frequency is required." });
  }

  if (!isNonEmpty(lifecycle.breakingChangePolicy)) {
    issues.push({
      path: "lifecycle.breakingChangePolicy",
      message: "A breaking-change policy is required.",
    });
  }

  return issues;
}

export function validateKnowledgeObject(object: KnowledgeObject): KnowledgeValidationResult {
  const issues = [
    ...validateIdentity(object.identity),
    ...validateRelationships(object.relationships, object.identity),
    ...validateEvidence(object.evidence, object.identity),
    ...validateLifecycle(object.lifecycle),
  ];

  if (!isNonEmpty(object.definition.shortDefinition)) {
    issues.push({
      path: "definition.shortDefinition",
      message: "A short definition is required.",
    });
  }

  if (!isNonEmpty(object.definition.purpose)) {
    issues.push({ path: "definition.purpose", message: "A purpose is required." });
  }

  if (!isNonEmpty(object.structuredKnowledge.entity)) {
    issues.push({
      path: "structuredKnowledge.entity",
      message: "A structured entity is required.",
    });
  }

  return { valid: issues.length === 0, issues };
}

function references(object: KnowledgeObject): { canonicalId: string; path: string }[] {
  const from = (items: { canonicalId: string }[], path: string) =>
    items.map((item, index) => ({ canonicalId: item.canonicalId, path: `${path}[${index}]` }));

  return [
    ...from(object.identity.parentConcepts, "identity.parentConcepts"),
    ...from(object.identity.childConcepts, "identity.childConcepts"),
    ...from(object.identity.siblingConcepts, "identity.siblingConcepts"),
    ...from(object.identity.relatedConcepts, "identity.relatedConcepts"),
    ...from(object.relationships.requires, "relationships.requires"),
    ...from(object.relationships.dependsOn, "relationships.dependsOn"),
    ...from(object.relationships.relatedTo, "relationships.relatedTo"),
    ...from(object.relationships.oftenConfusedWith, "relationships.oftenConfusedWith"),
    ...from(object.relationships.opposite, "relationships.opposite"),
    ...from(object.relationships.derivedFrom, "relationships.derivedFrom"),
    ...from(object.relationships.uses, "relationships.uses"),
    ...from(object.relationships.usedBy, "relationships.usedBy"),
  ];
}

function hasReference(
  referencesToCheck: { canonicalId: string }[],
  canonicalId: string
): boolean {
  return referencesToCheck.some((reference) => reference.canonicalId === canonicalId);
}

export function validateKnowledgeObjects(objects: KnowledgeObject[]): KnowledgeValidationResult {
  const issues: KnowledgeValidationIssue[] = [];
  const byCanonicalId = new Map<string, KnowledgeObject>();

  objects.forEach((object, index) => {
    const canonicalId = object.identity.canonicalId;

    if (byCanonicalId.has(canonicalId)) {
      issues.push({
        path: `objects[${index}].identity.canonicalId`,
        message: `Duplicate canonical ID: ${canonicalId}.`,
      });
      return;
    }

    byCanonicalId.set(canonicalId, object);
  });

  objects.forEach((object, index) => {
    const ownCanonicalId = object.identity.canonicalId;

    references(object).forEach((reference) => {
      if (!byCanonicalId.has(reference.canonicalId)) {
        issues.push({
          path: `objects[${index}].${reference.path}`,
          message: `Unknown knowledge object: ${reference.canonicalId}.`,
        });
      }
    });

    object.identity.parentConcepts.forEach((reference) => {
      const parent = byCanonicalId.get(reference.canonicalId);
      if (parent && !hasReference(parent.identity.childConcepts, ownCanonicalId)) {
        issues.push({
          path: `objects[${index}].identity.parentConcepts`,
          message: `Parent ${reference.canonicalId} must reference ${ownCanonicalId} as a child.`,
        });
      }
    });

    object.identity.childConcepts.forEach((reference) => {
      const child = byCanonicalId.get(reference.canonicalId);
      if (child && !hasReference(child.identity.parentConcepts, ownCanonicalId)) {
        issues.push({
          path: `objects[${index}].identity.childConcepts`,
          message: `Child ${reference.canonicalId} must reference ${ownCanonicalId} as a parent.`,
        });
      }
    });

    [...object.identity.relatedConcepts, ...object.relationships.relatedTo].forEach((reference) => {
      const related = byCanonicalId.get(reference.canonicalId);
      if (
        related &&
        !hasReference(related.identity.relatedConcepts, ownCanonicalId) &&
        !hasReference(related.relationships.relatedTo, ownCanonicalId)
      ) {
        issues.push({
          path: `objects[${index}].relationships.related`,
          message: `Related concept ${reference.canonicalId} must reciprocate the relationship.`,
        });
      }
    });

    [...object.relationships.derivedFrom, ...object.relationships.dependsOn].forEach(
      (reference) => {
        const dependency = byCanonicalId.get(reference.canonicalId);
        if (dependency && !hasReference(dependency.relationships.usedBy, ownCanonicalId)) {
          issues.push({
            path: `objects[${index}].relationships`,
            message: `Dependency ${reference.canonicalId} must reference ${ownCanonicalId} as used by.`,
          });
        }
      }
    );

    object.editorialProjections.forEach((projection, projectionIndex) => {
      if (projection.status === "published" && !isNonEmpty(projection.canonicalUrl)) {
        issues.push({
          path: `objects[${index}].editorialProjections[${projectionIndex}].canonicalUrl`,
          message: "Published projections require a non-empty canonical URL.",
        });
      }

      if (projection.canonicalUrl !== undefined && !isNonEmpty(projection.canonicalUrl)) {
        issues.push({
          path: `objects[${index}].editorialProjections[${projectionIndex}].canonicalUrl`,
          message: "Projection URLs cannot be empty.",
        });
      }
    });
  });

  return { valid: issues.length === 0, issues };
}
