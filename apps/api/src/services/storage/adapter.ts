export interface PutResult {
  key: string;
  size: number;
}

export interface StorageAdapter {
  put(
    key: string,
    data: ReadableStream | Buffer,
    contentType: string,
  ): Promise<PutResult>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  totalSize?(prefix?: string): Promise<number>;
  getSignedUrl?(key: string, expiresIn: number): Promise<string>;
}
