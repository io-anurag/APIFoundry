export const SEARCH_RESOURCE_TYPES = [
  "user",
  "customer",
  "product",
  "category",
  "post",
  "comment",
  "review",
] as const;
export type SearchResourceType = (typeof SEARCH_RESOURCE_TYPES)[number];

export interface SearchResult {
  resourceType: SearchResourceType;
  id: string;
  label: string;
  snippet?: string;
}
