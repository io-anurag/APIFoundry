import { createKeyedStore } from "./keyedStore";
import type { RateLimitCounter } from "../models/rateLimitCounter";

export const rateLimitStore = createKeyedStore<RateLimitCounter>();
