export interface UploadOptions {
  onProgress?: (pct: number) => void;
}

export function uploadRecording<T>(
  url: string,
  form: FormData,
  opts: UploadOptions = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

function extForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export function buildRecordingForm(
  blob: Blob,
  name: string,
  durationSec: number,
  mime: string,
): FormData {
  const fd = new FormData();
  const ext = extForMime(mime);
  const file = new File([blob], `${name.replace(/[^\w.-]/g, "_")}.${ext}`, { type: mime });
  fd.append("audio", file);
  fd.append("name", name);
  fd.append("duration", String(durationSec));
  return fd;
}
