import { describe, expect, test, beforeEach, mock, spyOn } from "bun:test";
import { S3Client } from "@aws-sdk/client-s3";
import { S3Adapter } from "../../src/services/storage/s3";

const opts = {
  bucket: "vlb-test",
  region: "us-east-1",
  accessKey: "AKIA-test",
  secretKey: "secret-test",
};

describe("S3Adapter (mocked client)", () => {
  let sendSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    sendSpy = spyOn(S3Client.prototype, "send").mockImplementation(
      mock(async (cmd: { constructor: { name: string } }) => {
        switch (cmd.constructor.name) {
          case "PutObjectCommand":
          case "DeleteObjectCommand":
            return {};
          case "HeadObjectCommand":
            return { ContentLength: 10 };
          case "GetObjectCommand":
            return {
              Body: {
                transformToWebStream: () =>
                  new Response(Buffer.from("hello-from-s3")).body,
              },
            };
          default:
            throw new Error(`unexpected command: ${cmd.constructor.name}`);
        }
      }) as unknown as Parameters<typeof spyOn>[1],
    ) as ReturnType<typeof spyOn>;
  });

  test("put returns key + size", async () => {
    const adapter = new S3Adapter(opts);
    const r = await adapter.put("k", Buffer.from("hi"), "audio/mpeg");
    expect(r).toEqual({ key: "k", size: 2 });
    expect(sendSpy).toHaveBeenCalled();
  });

  test("get returns a readable stream of the body", async () => {
    const adapter = new S3Adapter(opts);
    const stream = await adapter.get("k");
    const buf = Buffer.from(await new Response(stream).arrayBuffer());
    expect(buf.toString()).toBe("hello-from-s3");
  });

  test("exists returns true on success", async () => {
    const adapter = new S3Adapter(opts);
    expect(await adapter.exists("k")).toBe(true);
  });

  test("exists returns false when HeadObject throws", async () => {
    sendSpy.mockImplementationOnce((async () => {
      throw new Error("404");
    }) as unknown as Parameters<typeof spyOn>[1]);
    const adapter = new S3Adapter(opts);
    expect(await adapter.exists("missing")).toBe(false);
  });

  test("delete sends DeleteObjectCommand", async () => {
    const adapter = new S3Adapter(opts);
    await adapter.delete("k");
    expect(sendSpy).toHaveBeenCalled();
  });
});
