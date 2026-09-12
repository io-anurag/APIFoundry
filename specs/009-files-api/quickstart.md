# Quickstart: Files API

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server
is running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env`
values (`MAX_FILE_SIZE=2mb`, `MAX_STORED_FILES=50`). Every response also carries `X-Request-ID`
(omitted below for brevity).

## Prerequisites

- Server running: `npm run dev`
- `curl` available
- A small local file to upload, e.g. `echo "hello files api" > /tmp/sample.txt`

## Scenario 1 — Upload a file (User Story 1, P1)

```bash
curl -s -i -X POST http://localhost:3000/files -F "upload=@/tmp/sample.txt" | tee /tmp/upload.txt \
  | grep -i "^HTTP"
# Expect: 201

ID=$(grep -o '"id":"[^"]*"' /tmp/upload.txt | head -1 | cut -d'"' -f4)
echo "uploaded id: $ID"
# Expect: a UUID; response body also reports filename "sample.txt", contentType, size, uploadedAt

# Zero-byte file is valid
touch /tmp/empty.txt
curl -s -o /dev/null -w "empty -> %{http_code}\n" -X POST http://localhost:3000/files -F "upload=@/tmp/empty.txt"
# Expect: 201

# Wrong field name -> rejected
curl -s -o /dev/null -w "wrong-field -> %{http_code}\n" -X POST http://localhost:3000/files -F "wrongField=@/tmp/sample.txt"
# Expect: 400

# Oversized file (larger than MAX_FILE_SIZE) -> rejected
head -c 3000000 /dev/urandom > /tmp/toobig.bin  # 3MB > default 2MB MAX_FILE_SIZE
curl -s -o /dev/null -w "too-large -> %{http_code}\n" -X POST http://localhost:3000/files -F "upload=@/tmp/toobig.bin"
# Expect: 413
```

**Expected outcome (SC-002 partial)**: A well-formed upload returns `201` with an identifier and
accurate metadata; a missing/misnamed file field and an oversized file are both rejected before
being stored.

## Scenario 2 — Download a file (User Story 2, P2)

```bash
curl -s -o /tmp/downloaded.txt -D - http://localhost:3000/files/$ID | grep -iE "^(HTTP|Content-Type|Content-Disposition)"
diff /tmp/sample.txt /tmp/downloaded.txt && echo "content matches byte-for-byte"
# Expect: HTTP/1.1 200, matching Content-Type, a Content-Disposition naming sample.txt, and identical content

curl -s -o /dev/null -w "not-found -> %{http_code}\n" http://localhost:3000/files/00000000-0000-0000-0000-000000000000
# Expect: 404

curl -s -o /dev/null -w "malformed -> %{http_code}\n" http://localhost:3000/files/not-a-uuid
# Expect: 400
```

**Expected outcome (SC-001)**: Downloaded content is byte-for-byte identical to what was
uploaded, with the original content type and filename.

## Scenario 3 — List uploaded files (User Story 3, P3)

```bash
curl -s http://localhost:3000/files | head -c 300; echo
# Expect: 200 with { "data": [...], "pagination": {...} }, newest upload first

curl -s -o /dev/null -w "bad-page -> %{http_code}\n" "http://localhost:3000/files?page=0"
# Expect: 400
```

**Expected outcome**: Every previously uploaded file's metadata (never raw content) appears,
ordered newest-first, inside the standard pagination envelope.

## Scenario 4 — Delete a file (User Story 4, P4)

```bash
curl -s -o /dev/null -w "delete -> %{http_code}\n" -X DELETE http://localhost:3000/files/$ID
# Expect: 204

curl -s -o /dev/null -w "after-delete -> %{http_code}\n" http://localhost:3000/files/$ID
# Expect: 404

curl -s -o /dev/null -w "double-delete -> %{http_code}\n" -X DELETE http://localhost:3000/files/$ID
# Expect: 404
```

**Expected outcome (SC-003)**: The deleted file is immediately unreachable via both `GET` and a
repeated `DELETE`, with no crash.

## Scenario 5 — Storage cap (SC-002, bounded resource)

```bash
# With default MAX_STORED_FILES=50, upload 50 tiny files, then confirm the 51st is rejected.
for i in $(seq 1 50); do
  curl -s -o /dev/null -X POST http://localhost:3000/files -F "upload=@/tmp/empty.txt"
done
curl -s -o /dev/null -w "51st -> %{http_code}\n" -X POST http://localhost:3000/files -F "upload=@/tmp/empty.txt"
# Expect: 409, and none of the first 50 files were evicted (confirm via GET /files pagination.total)
```

**Expected outcome (SC-002)**: Once at the configured maximum stored-file count, further uploads
are rejected with `409` rather than evicting an existing file.

## Docs-surface check (Quality Gates & Spec Parity)

After implementation:

```bash
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | map(select(test("^/files")))'
```

Confirm both `/files` and `/files/{id}` (with `get`/`post` and `get`/`delete` respectively) appear
exactly as documented in `specs/009-files-api/contracts/files-api.openapi.yaml`, with nothing
related to this feature missing or extra — an empty diff between documented and implemented
surface, per the constitution's spec-parity gate.
