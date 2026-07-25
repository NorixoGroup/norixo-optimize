import { getKnowledgeObject } from "./registry";
import type { CanonicalFormula } from "./types";

export type ProjectionFormulaResolutionErrorCode =
  | "KNOWLEDGE_OBJECT_NOT_FOUND"
  | "FORMULA_CONTRACT_MISSING"
  | "PRIMARY_FORMULA_MISSING"
  | "FORMULA_NOT_FOUND"
  | "FORMULA_RESOLUTION_AMBIGUOUS"
  | "FORMULA_NOT_REFERENCE_ONLY";

export class ProjectionFormulaResolutionError extends Error {
  constructor(
    public readonly code: ProjectionFormulaResolutionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ProjectionFormulaResolutionError";
  }
}

function getFormulaContract(canonicalId: string): CanonicalFormula[] {
  const object = getKnowledgeObject(canonicalId);

  if (!object) {
    throw new ProjectionFormulaResolutionError(
      "KNOWLEDGE_OBJECT_NOT_FOUND",
      `Knowledge object not found: ${canonicalId}`
    );
  }

  if (!object.definition.formulas) {
    throw new ProjectionFormulaResolutionError(
      "FORMULA_CONTRACT_MISSING",
      `Knowledge object has no formula contract: ${canonicalId}`
    );
  }

  return object.definition.formulas;
}

function assertReferenceOnly(formula: CanonicalFormula, canonicalId: string): CanonicalFormula {
  if (formula.executionStatus !== "reference_only") {
    throw new ProjectionFormulaResolutionError(
      "FORMULA_NOT_REFERENCE_ONLY",
      `Formula ${formula.id} for ${canonicalId} is not reference-only.`
    );
  }

  return formula;
}

function resolveUniqueFormula(
  canonicalId: string,
  formulas: CanonicalFormula[],
  errorCode: "PRIMARY_FORMULA_MISSING" | "FORMULA_NOT_FOUND",
  errorMessage: string
): CanonicalFormula {
  if (formulas.length === 0) {
    throw new ProjectionFormulaResolutionError(errorCode, errorMessage);
  }

  if (formulas.length > 1) {
    throw new ProjectionFormulaResolutionError(
      "FORMULA_RESOLUTION_AMBIGUOUS",
      `Formula resolution is ambiguous for ${canonicalId}.`
    );
  }

  return assertReferenceOnly(formulas[0], canonicalId);
}

export function resolvePrimaryFormulaForProjection(canonicalId: string): CanonicalFormula {
  const formulas = getFormulaContract(canonicalId).filter(
    (formula) => formula.role === "primary_definition"
  );

  return resolveUniqueFormula(
    canonicalId,
    formulas,
    "PRIMARY_FORMULA_MISSING",
    `Knowledge object has no primary formula: ${canonicalId}`
  );
}

export function resolveFormulaForProjection(
  canonicalId: string,
  formulaId: string
): CanonicalFormula {
  const formulas = getFormulaContract(canonicalId).filter((formula) => formula.id === formulaId);

  return resolveUniqueFormula(
    canonicalId,
    formulas,
    "FORMULA_NOT_FOUND",
    `Formula ${formulaId} was not found for ${canonicalId}`
  );
}
