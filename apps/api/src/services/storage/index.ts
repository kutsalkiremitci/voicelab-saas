import { env } from "../../env";
import type { StorageAdapter } from "./adapter";
import { LocalAdapter } from "./local";
import { S3Adapter } from "./s3";

function buildAdapter(): StorageAdapter {
  if (env.STORAGE_DRIVER === "s3") {
    if (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
      throw new Error("storage: STORAGE_DRIVER=s3 requires S3_BUCKET/REGION/ACCESS_KEY/SECRET_KEY");
    }
    return new S3Adapter({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
    });
  }
  return new LocalAdapter(env.STORAGE_LOCAL_PATH);
}

export const storage: StorageAdapter = buildAdapter();
export type { StorageAdapter, PutResult } from "./adapter";
export { LocalAdapter } from "./local";
export { S3Adapter } from "./s3";
