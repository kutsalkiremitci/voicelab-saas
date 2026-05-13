# Upload Flow

Blob → multipart → backend → storage adapter.

## On stop

```ts
const recorder = useRecorder({
  onStop: async (blob, durationSec) => {
    await uploadRecording(blob, name, durationSec);
  },
});
```

## Upload helper

```ts
// lib/upload.ts
export async function uploadRecording(
  blob: Blob,
  name: string,
  durationSec: number,
  onProgress?: (pct: number) => void,
): Promise<Recording> {
  const form = new FormData();
  form.append("audio", blob, `${name}.webm`);
  form.append("name", name);
  form.append("duration", String(durationSec));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/recordings");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText).recording);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}
```

`fetch` doesn't expose upload progress, so XMLHttpRequest is used here. Everywhere else, use `fetch` via the API client.

## Parallel uploads

Each recording panel runs its own `uploadRecording` call. The UI shows independent progress bars per panel. There is no global queue.

## Failure handling

- 413 (too large) → show inline error, allow retry after the user re-records shorter
- 422 (validation) → show field-level errors from the response
- Network drop → toast with "Retry" action; the blob is still in memory

After upload success:
- The panel switches to "uploaded" state with a checkmark
- TanStack Query invalidates `["recordings"]`
- The table refreshes
