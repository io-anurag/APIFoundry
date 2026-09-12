import bytes from "bytes";
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

describe("Files API (User Story 1 - Upload)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("stores a well-formed upload and returns its metadata", async () => {
    const res = await request(app).post("/files").attach("upload", Buffer.from("hello files api"), "hello.txt");

    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe("string");
    expect(res.body.filename).toBe("hello.txt");
    expect(typeof res.body.contentType).toBe("string");
    expect(res.body.size).toBe(Buffer.byteLength("hello files api"));
    expect(typeof res.body.uploadedAt).toBe("string");
    expect(res.body.content).toBeUndefined();
  });

  it("accepts a zero-byte file", async () => {
    const res = await request(app).post("/files").attach("upload", Buffer.alloc(0), "empty.bin");

    expect(res.status).toBe(201);
    expect(res.body.size).toBe(0);
  });

  it("rejects a well-formed multipart request with no attached file", async () => {
    const res = await request(app).post("/files").field("note", "no file attached");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-multipart request body", async () => {
    const res = await request(app).post("/files").send({ not: "multipart" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an upload under the wrong field name", async () => {
    const res = await request(app).post("/files").attach("wrongField", Buffer.from("x"), "x.txt");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a file larger than the configured maximum size", async () => {
    const maxBytes = bytes.parse(config.maxFileSize) as number;
    const oversized = Buffer.alloc(maxBytes + 1);

    const res = await request(app).post("/files").attach("upload", oversized, "toobig.bin");

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects a new upload once the store is at its configured maximum, without evicting existing files", async () => {
    for (let i = 0; i < config.maxStoredFiles; i += 1) {
      const res = await request(app).post("/files").attach("upload", Buffer.from(`file-${i}`), `file-${i}.txt`);
      expect(res.status).toBe(201);
    }

    const overflow = await request(app).post("/files").attach("upload", Buffer.from("one-too-many"), "overflow.txt");
    expect(overflow.status).toBe(409);
    expect(overflow.body.error.code).toBe("STORAGE_LIMIT_EXCEEDED");

    const list = await request(app).get("/files?limit=1");
    expect(list.body.pagination.total).toBe(config.maxStoredFiles);
  });
});

describe("Files API (User Story 2 - Download)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("downloads a previously uploaded file byte-for-byte, with its original content type and filename", async () => {
    const content = Buffer.from("hello files api");
    const upload = await request(app)
      .post("/files")
      .attach("upload", content, { filename: "hello.txt", contentType: "text/plain" });

    const download = await request(app).get(`/files/${upload.body.id}`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });

    expect(download.status).toBe(200);
    expect(Buffer.compare(download.body as Buffer, content)).toBe(0);
    expect(download.headers["content-type"]).toContain("text/plain");
    expect(download.headers["content-disposition"]).toContain("hello.txt");
  });

  it("returns 404 for a well-formed but unused file id", async () => {
    const res = await request(app).get("/files/00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns 400 for a malformed file id", async () => {
    const res = await request(app).get("/files/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("safely encodes a filename containing a space and a non-ASCII character, without crashing", async () => {
    const upload = await request(app)
      .post("/files")
      .attach("upload", Buffer.from("x"), "my café.txt");

    const download = await request(app).get(`/files/${upload.body.id}`);

    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toBeDefined();
  });
});

describe("Files API (User Story 3 - List)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("returns an empty paginated list when no files are stored", async () => {
    const res = await request(app).get("/files");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it("lists every stored file's metadata, newest first, never raw content", async () => {
    const first = await request(app).post("/files").attach("upload", Buffer.from("a"), "a.txt");
    const second = await request(app).post("/files").attach("upload", Buffer.from("b"), "b.txt");
    const third = await request(app).post("/files").attach("upload", Buffer.from("c"), "c.txt");

    const res = await request(app).get("/files");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].id).toBe(third.body.id);
    expect(res.body.data[1].id).toBe(second.body.id);
    expect(res.body.data[2].id).toBe(first.body.id);
    for (const item of res.body.data) {
      expect(item.content).toBeUndefined();
    }
  });

  it("paginates via page/limit", async () => {
    for (let i = 0; i < 3; i += 1) {
      await request(app).post("/files").attach("upload", Buffer.from(`f${i}`), `f${i}.txt`);
    }

    const res = await request(app).get("/files?page=1&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.hasNext).toBe(true);
  });

  it("rejects an invalid page value", async () => {
    const res = await request(app).get("/files?page=0");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Files API (User Story 4 - Delete)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("deletes a stored file and makes it immediately unreachable", async () => {
    const upload = await request(app).post("/files").attach("upload", Buffer.from("x"), "x.txt");

    const del = await request(app).delete(`/files/${upload.body.id}`);
    expect(del.status).toBe(204);
    expect(del.body).toEqual({});

    const afterDelete = await request(app).get(`/files/${upload.body.id}`);
    expect(afterDelete.status).toBe(404);

    const list = await request(app).get("/files");
    expect(list.body.data.find((item: { id: string }) => item.id === upload.body.id)).toBeUndefined();
  });

  it("returns 404 on a repeated delete of an already-deleted id", async () => {
    const upload = await request(app).post("/files").attach("upload", Buffer.from("x"), "x.txt");
    await request(app).delete(`/files/${upload.body.id}`);

    const second = await request(app).delete(`/files/${upload.body.id}`);
    expect(second.status).toBe(404);
    expect(second.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns 400 for a malformed id and 404 for a well-formed but unused id", async () => {
    const malformed = await request(app).delete("/files/not-a-uuid");
    expect(malformed.status).toBe(400);

    const notFound = await request(app).delete("/files/00000000-0000-0000-0000-000000000000");
    expect(notFound.status).toBe(404);
  });
});
