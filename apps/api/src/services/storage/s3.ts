import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter, PutResult } from "./adapter";

export interface S3AdapterOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKey: string;
  secretKey: string;
}

export class S3Adapter implements StorageAdapter {
  private readonly client: S3Client;

  constructor(private readonly opts: S3AdapterOptions) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      forcePathStyle: !!opts.endpoint,
      credentials: {
        accessKeyId: opts.accessKey,
        secretAccessKey: opts.secretKey,
      },
    });
  }

  async put(
    key: string,
    data: ReadableStream | Buffer,
    contentType: string,
  ): Promise<PutResult> {
    const buf = Buffer.isBuffer(data)
      ? data
      : Buffer.from(await new Response(data).arrayBuffer());
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.opts.bucket,
        Key: key,
        Body: buf,
        ContentType: contentType,
      }),
    );
    return { key, size: buf.length };
  }

  async get(key: string): Promise<ReadableStream> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`storage: empty body for ${key}`);
    return res.Body.transformToWebStream();
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.opts.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }),
      { expiresIn },
    );
  }
}
