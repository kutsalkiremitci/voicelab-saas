---
name: storage-adapter
description: Use when reading, writing, deleting, or serving uploaded audio files, or switching between local FS and S3/R2. Use whenever the task mentions file upload, file storage, StorageAdapter, S3, R2, bucket, local FS, signed URL, file proxy, multipart, blob persistence, or storage migration — even if "storage" is not explicitly named.
---

# Storage Adapter

## Symptoms (read this skill if any apply)

- Implementing or modifying any file I/O for audio
- Adding a new storage backend
- Migrating files from local FS to S3 / R2
- Designing or changing the file-serving proxy endpoint
- Handling MIME / size / magic-byte validation on upload

## Red flags (resist these shortcuts)

- "I'll just use `fs.writeFile` directly here, quick fix" → NO, always through `storage`
- "Serve `./storage/` as a static directory, faster" → NO, bypasses auth and ownership
- "Skip the magic-byte check, MIME is enough" → NO, MIME is easily spoofed
- "Store the user's filename as the key" → NO, use UUIDs; user filenames cause collisions and path traversal risk
- "S3 bucket public, easier" → NO, private always; serve via signed URL or backend proxy
- "Compare file extension to validate type" → NO, magic-byte check, extension is cosmetic

## Non-negotiables

- Code never imports `fs/promises` or the S3 SDK directly outside `services/storage/`. Everything goes through the `storage` instance (a `StorageAdapter`).
- Key format is fixed: `audio/{userId}/{kind}/{uuid}.{ext}`. `kind ∈ { recordings, generations }`.
- Adapter selection by env: `STORAGE_DRIVER=local | s3`. Code does not branch elsewhere.
- Upload validation order: content-type → size cap (25 MB) → magic-byte check via `file-type`.
- Files are never served statically. Serving goes through `GET /files/:type/:id` which enforces ownership and supports HTTP Range.
- Local storage path `./storage` is gitignored.
- S3 / R2 buckets are private. No public ACLs.

## Authoritative references

- `references/interface.md` — `StorageAdapter` contract, key naming
- `references/local-adapter.md` — local FS implementation, gotchas
- `references/s3-adapter.md` — S3 / R2 implementation, signed URLs
- `references/migration.md` — local → S3 cutover playbook

## Skill handoffs

- The adapter is invoked from a route? Switch to `backend-development` for where to wire `storage.put()` / `storage.get()`.
- Configuring buckets, volumes, or env in production? Switch to `deployment`.
- Adapter or proxy route done? Hand off to `test-driven-development` before any git action.
