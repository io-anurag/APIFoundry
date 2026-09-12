import { createKeyedStore } from "./keyedStore";
import type { FileRecord } from "../models/file";

export const fileStore = createKeyedStore<FileRecord>();

/**
 * Monotonically increasing counter, incremented once per stored file. Used as the sort key for
 * `GET /files`'s newest-first ordering instead of comparing `uploadedAt` strings, since two
 * uploads landing in the same millisecond would otherwise tie non-deterministically
 * (research.md Decision 4).
 */
let nextSequence = 0;

/**
 * Returns the next value in the monotonic upload-sequence counter, incrementing it first.
 * @returns The newly incremented sequence number, unique and increasing for every call.
 */
export function nextFileSequence(): number {
  nextSequence += 1;
  return nextSequence;
}

/**
 * Resets the upload-sequence counter back to its initial state. Called alongside
 * `fileStore.reset([])` so a fresh test run or admin-reset starts numbering from zero again.
 */
export function resetFileSequence(): void {
  nextSequence = 0;
}
