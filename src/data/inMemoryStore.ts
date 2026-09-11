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
    list(): T[] {
      return Array.from(records.values());
    },

    get(id: number): T | undefined {
      return records.get(id);
    },

    create(build: (id: number) => T): T {
      const id = nextId++;
      const record = build(id);
      records.set(id, record);
      return record;
    },

    replace(id: number, build: (existing: T) => T): T | undefined {
      const existing = records.get(id);
      if (!existing) return undefined;
      const updated = build(existing);
      records.set(id, updated);
      return updated;
    },

    patch(id: number, patch: Partial<Omit<T, "id">>): T | undefined {
      const existing = records.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...patch, id: existing.id };
      records.set(id, updated);
      return updated;
    },

    remove(id: number): boolean {
      return records.delete(id);
    },

    reset(seedRecords: T[]): void {
      records = new Map(seedRecords.map((record) => [record.id, record]));
      nextId = seedRecords.reduce((max, record) => Math.max(max, record.id), 0) + 1;
    },
  };
}
