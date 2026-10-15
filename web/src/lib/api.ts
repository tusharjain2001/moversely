import type { ApiJob } from "./types";

// On Vercel, set NEXT_PUBLIC_AI_API_URL to the AI server's URL so videos upload
// straight to it (Vercel functions only accept ~4.5 MB request bodies). Unset,
// the site calls /ai/*, which next.config.ts forwards to the AI on this machine.
export const API_URL = (process.env.NEXT_PUBLIC_AI_API_URL || "/ai").replace(/\/$/, "");

/** Upload with progress events (fetch can't report upload progress). */
export function uploadVideo(
  video: Blob,
  filename: string,
  room: string,
  onProgress: (fraction: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("video", video, filename);
    form.append("room", room);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/jobs`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body.job_id);
        else reject(new Error(body.detail || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Couldn't reach the AI server. Check your connection and try again."));
    xhr.send(form);
  });
}

export async function getJob(jobId: string): Promise<ApiJob | null> {
  const res = await fetch(`${API_URL}/jobs/${jobId}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json();
}
