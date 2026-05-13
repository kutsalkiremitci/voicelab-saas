# S3 / R2 Adapter

Same `StorageAdapter` interface, AWS SDK v3 implementation.

## Implementation

```ts
// services/storage/s3.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class S3Adapter implements StorageAdapter {
  private client: S3Client;

  constructor(private opts: {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKey: string;
    secretKey: string;
  }) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,             // set for Cloudflare R2
      forcePathStyle: !!opts.endpoint,
      credentials: {
        accessKeyId: opts.accessKey,
        secretAccessKey: opts.secretKey,
      },
    });
  }

  async put(key: string, data: ReadableStream | Buffer, contentType: string) {
    const buf = Buffer.isBuffer(data)
      ? data
      : Buffer.from(await new Response(data).arrayBuffer());
    await this.client.send(new PutObjectCommand({
      Bucket: this.opts.bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }));
    return { key, size: buf.length };
  }

  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({
      Bucket: this.opts.bucket,
      Key: key,
    }));
    return res.Body!.transformToWebStream();
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.opts.bucket,
      Key: key,
    }));
  }

  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.opts.bucket,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresIn: number) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }),
      { expiresIn },
    );
  }
}
```

## Cloudflare R2 specifics

- Pass `endpoint: "https://<account>.r2.cloudflarestorage.com"`
- Set `forcePathStyle: true`
- Region typically `"auto"`

## AWS S3 specifics

- Leave `endpoint` undefined
- Region is the bucket's region
- Bucket policy: deny public access; use signed URLs

## Security

- Bucket is private (no public ACL, no `acl: public-read`)
- Direct external access only via `getSignedUrl()` with short TTL (e.g. 300s)
- Server-side proxy via `GET /files/:type/:id` is preferred for short audio; signed URLs for very large objects
