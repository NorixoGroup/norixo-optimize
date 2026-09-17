export const BACKLINK_DOMAIN_CACHE_PAGE_SIZE = 100;
export const BACKLINK_DOMAIN_CACHE_MAX_PAGES = 100;

export type BacklinkDomainPage<T extends { id: string }> = {
  items: readonly T[];
  total: number;
  pageSize: number;
  hasNextPage: boolean;
};

export class BacklinkPageAggregationError extends Error {
  constructor() {
    super("Backlink pagination limit reached before the list was complete.");
  }
}

export async function loadAllBacklinkPages<T extends { id: string }>(
  fetchPage: (page: number, pageSize: number) => Promise<BacklinkDomainPage<T>>,
): Promise<{ items: T[]; total: number }> {
  const items: T[] = [];
  const domainIds = new Set<string>();
  let page = 1;
  let total = 0;

  while (page <= BACKLINK_DOMAIN_CACHE_MAX_PAGES) {
    const domainPage = await fetchPage(page, BACKLINK_DOMAIN_CACHE_PAGE_SIZE);
    total = domainPage.total;
    for (const domain of domainPage.items) {
      if (!domainIds.has(domain.id)) {
        domainIds.add(domain.id);
        items.push(domain);
      }
    }

    const expectedPageCount = Math.max(1, Math.ceil(domainPage.total / domainPage.pageSize));
    const hasMorePages = domainPage.hasNextPage && page < expectedPageCount;
    if (page === BACKLINK_DOMAIN_CACHE_MAX_PAGES && domainPage.hasNextPage) {
      throw new BacklinkPageAggregationError();
    }
    if (!hasMorePages) return { items, total };
    page += 1;
  }

  throw new BacklinkPageAggregationError();
}

export const loadAllBacklinkDomainPages = loadAllBacklinkPages;
export const loadAllBacklinkOpportunityPages = loadAllBacklinkPages;
export const BacklinkDomainPageAggregationError = BacklinkPageAggregationError;
