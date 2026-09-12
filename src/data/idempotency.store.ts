import { createKeyedStore } from "./keyedStore";
import type { IdempotencyRecord } from "../models/idempotencyRecord";

export const idempotencyStore = createKeyedStore<IdempotencyRecord>();
