import { createKeyedStore } from "./keyedStore";
import type { ApiKey } from "../models/apiKey";

/** Reuses the existing generic keyed store, keyed by the raw key value (research.md Decision 1). */
export const apiKeyStore = createKeyedStore<ApiKey>();
