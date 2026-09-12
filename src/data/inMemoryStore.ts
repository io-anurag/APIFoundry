export interface InMemoryStore<T extends { id: number }> {
  list(): T[];
  get(id: number): T | undefined;
  create(build: (id: number) => T): T;
  replace(id: number, build: (existing: T) => T): T | undefined;
  patch(id: number, patch: Partial<Omit<T, "id">>): T | undefined;
  remove(id: number): boolean;
  reset(records: T[]): void;
}

/**
 * A generic keyed in-memory store, one instance per resource. `reset()` is used by seed modules
 * (initial population) and by tests (restoring the seeded snapshot between test cases) rather than
 * exposing the internal Map directly.
 */
export function createInMemoryStore<T extends { id: number }>(): InMemoryStore<T> {
  let records = new Map<number, T>();
  let nextId = 1;

  return {
    /**
     * Lists every record currently in the store.
     * @returns All stored records, in insertion order.
     */
    list(): T[] {
      return Array.from(records.values());
    },

    /**
     * Looks up a single record by its numeric id.
     * @param id - The record's id.
     * @returns The matching record, or `undefined` if no record has that id.
     */
    get(id: number): T | undefined {
      return records.get(id);
    },

    /**
     * Creates a new record with an auto-generated, monotonically increasing id.
     * @param build - Builder invoked with the freshly allocated id to produce the new record.
     * @returns The created record.
     */
    create(build: (id: number) => T): T {
      const id = nextId++;
      const record = build(id);
      records.set(id, record);
      return record;
    },

    /**
     * Replaces an existing record by deriving a new value from it.
     * @param id - The id of the record to replace.
     * @param build - Builder invoked with the existing record to produce its replacement.
     * @returns The updated record, or `undefined` if no record has that id.
     */
    replace(id: number, build: (existing: T) => T): T | undefined {
      const existing = records.get(id);
      if (!existing) return undefined;
      const updated = build(existing);
      records.set(id, updated);
      return updated;
    },

    /**
     * Merges a partial update into an existing record, preserving its id.
     * @param id - The id of the record to patch.
     * @param patch - Fields to merge into the existing record.
     * @returns The updated record, or `undefined` if no record has that id.
     */
    patch(id: number, patch: Partial<Omit<T, "id">>): T | undefined {
      const existing = records.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...patch, id: existing.id };
      records.set(id, updated);
      return updated;
    },

    /**
     * Deletes a record by id.
     * @param id - The id of the record to remove.
     * @returns `true` if a record was removed, `false` if no record had that id.
     */
    remove(id: number): boolean {
      return records.delete(id);
    },

    /**
     * Replaces the entire contents of the store with the given records and resets the auto-increment
     * id counter above the highest id in the new set.
     * @param seedRecords - The full set of records to repopulate the store with.
     */
    reset(seedRecords: T[]): void {
      records = new Map(seedRecords.map((record) => [record.id, record]));
      nextId = seedRecords.reduce((max, record) => Math.max(max, record.id), 0) + 1;
    },
  };
}
