export type BacklinkRepositoryErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "VALIDATION"
  | "DATABASE"
  | "UNKNOWN";

export type BacklinkRepositoryErrorDetails = Readonly<
  Record<string, string | number | boolean | null>
>;

export class BacklinkRepositoryError extends Error {
  readonly code: BacklinkRepositoryErrorCode;
  readonly operation: string;
  readonly cause?: unknown;
  readonly details?: BacklinkRepositoryErrorDetails;

  constructor(options: {
    code: BacklinkRepositoryErrorCode;
    operation: string;
    message: string;
    cause?: unknown;
    details?: BacklinkRepositoryErrorDetails;
  }) {
    super(options.message);
    this.name = "BacklinkRepositoryError";
    this.code = options.code;
    this.operation = options.operation;
    this.cause = options.cause;
    this.details = options.details;
  }
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error == null || !("code" in error)) {
    return null;
  }

  const { code } = error;
  return typeof code === "string" ? code : null;
}

function getSafeMessage(code: BacklinkRepositoryErrorCode): string {
  switch (code) {
    case "NOT_FOUND":
      return "The requested record was not found.";
    case "CONFLICT":
      return "The operation conflicts with existing data.";
    case "FORBIDDEN":
      return "The operation is not permitted.";
    case "VALIDATION":
      return "The provided data is invalid.";
    case "DATABASE":
      return "The database operation could not be completed.";
    case "UNKNOWN":
      return "An unexpected repository error occurred.";
  }
}

export function normalizeBacklinkRepositoryError(
  operation: string,
  error: unknown,
): BacklinkRepositoryError {
  if (error instanceof BacklinkRepositoryError) {
    return error;
  }

  const databaseCode = readErrorCode(error);
  const code: BacklinkRepositoryErrorCode =
    databaseCode === "23505"
      ? "CONFLICT"
      : databaseCode === "23503" || databaseCode === "23514"
        ? "VALIDATION"
        : databaseCode === "PGRST116"
          ? "NOT_FOUND"
          : databaseCode == null
            ? "UNKNOWN"
            : "DATABASE";

  return new BacklinkRepositoryError({
    code,
    operation,
    message: getSafeMessage(code),
    cause: error,
  });
}
