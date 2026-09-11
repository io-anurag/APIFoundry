import type { StatusCodeDemo } from "../models/statusCodeDemo";
import { STATUS_CODE_DEMOS } from "../data/statusCodeDemos.catalog";

/**
 * `code` is guaranteed to already have passed parseStatusCodeParam by the time this is called, so the
 * lookup always hits — no not-found handling is needed here.
 */
export function getStatusCodeDemo(code: number): StatusCodeDemo {
  return STATUS_CODE_DEMOS.find((demo) => demo.code === code) as StatusCodeDemo;
}
