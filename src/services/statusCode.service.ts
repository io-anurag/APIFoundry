import type { StatusCodeDemo } from "../models/statusCodeDemo";
import { STATUS_CODE_DEMOS } from "../data/statusCodeDemos.catalog";

/**
 * Looks up the canned demo response for a documented status code. `code` is guaranteed to already
 * have passed `parseStatusCodeParam` by the time this is called, so the lookup always hits — no
 * not-found handling is needed here.
 *
 * @param code - A status code already validated to be one of the documented demo codes.
 * @returns The matching StatusCodeDemo record describing how to respond.
 */
export function getStatusCodeDemo(code: number): StatusCodeDemo {
  return STATUS_CODE_DEMOS.find((demo) => demo.code === code) as StatusCodeDemo;
}
