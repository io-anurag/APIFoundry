export interface RateLimitCounter {
  id: string;
  count: number;
  windowStart: number;
}
