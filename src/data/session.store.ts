import { createKeyedStore } from "./keyedStore";
import type { Session } from "../models/session";

/** Reuses the existing generic keyed store — no new store type needed (research.md Decision 3). */
export const sessionStore = createKeyedStore<Session>();
