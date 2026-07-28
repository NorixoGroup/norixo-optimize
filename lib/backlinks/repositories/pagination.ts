export const DEFAULT_PAGE_SIZE = 25;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;

export interface RepositoryPageRequest {
  page?: number;
  pageSize?: number;
}

export interface RepositoryPageRange {
  page: number;
  pageSize: number;
  from: number;
  to: number;
}

export interface RepositoryPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && value != null && value > 0 ? value : fallback;
}

export function normalizeRepositoryPage(
  input?: RepositoryPageRequest | null,
): RepositoryPageRange {
  const page = normalizePositiveInteger(input?.page, 1);
  const requestedPageSize = normalizePositiveInteger(input?.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(Math.max(requestedPageSize, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;

  if (!Number.isSafeInteger(from)) {
    return {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      from: 0,
      to: DEFAULT_PAGE_SIZE - 1,
    };
  }

  return {
    page,
    pageSize,
    from,
    to: from + pageSize - 1,
  };
}
