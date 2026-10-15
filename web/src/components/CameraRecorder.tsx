"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 90;
const MIN_SECONDS = 5;

const TIPS = [
  "Walk slowly around the room",
  "Keep each item fully in view for a moment",
  "Include a door — it calibrates the size",
  "Point slightly down so the floor is visible",
];

function pickMimeType(): string | undefined {
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

type Props = {
  roomName: string;
  onDone: (video: Blob, filename: string) => void;
  onCancel: () => void;
  onUnsupported: () => void;
};

/**
 * Full-screen in-browser recorder. Records at 720p with a capped bitrate, so a
 * one-minute room is ~20 MB instead of the ~150 MB a phone camera app makes.
 */
export default function CameraRecorder({ roomName, onDone, onCancel, onUnsupported }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [tip, setTip] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia || !pickMimeType()) {
      onUnsupported();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Camera access was blocked. Allow camera access, or upload a video instead."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onUnsupported]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    const tips = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 4000);
    return () => {
      clearInterval(timer);
      clearInterval(tips);
    };
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) recorderRef.current?.stop();
  }, [recording, seconds]);

  const start = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    // 1.5 Mbps is plenty: the AI scales frames down to 960 px anyway, and a
    // smaller file uploads faster on mobile data.
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      setRecording(false);
      const type = rec.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onDone(blob, `${roomName.toLowerCase().replace(/\s+/g, "-")}.${type.includes("mp4") ? "mp4" : "webm"}`);
    };
    rec.start(1000);
    recorderRef.current = rec;
    setSeconds(0);
    setRecording(true);
  };

  const stop = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      <div className="relative flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={() => {
            if (recording) {
              recorderRef.current!.onstop = null;
              recorderRef.current!.stop();
            }
            onCancel();
          }}
          className="rounded-full bg-black/50 px-4 py-2 text-sm backdrop-blur"
        >
          Cancel
        </button>
        <div className="rounded-full bg-black/50 px-4 py-2 text-sm font-medium backdrop-blur">{roomName}</div>
        <div
          className={`rounded-full px-3 py-2 font-mono text-sm tabular-nums backdrop-blur ${recording ? "bg-red-600" : "bg-black/50"}`}
        >
          {mm}:{ss}
        </div>
      </div>

      {/* Corner guides */}
      <div className="pointer-events-none relative mx-6 mt-6 flex-1">
        {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c) => (
          <span key={c} className={`absolute h-8 w-8 border-[var(--tape)] ${c}`} />
        ))}
      </div>

      <div className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center">
        {error ? (
          <p className="mx-auto mb-6 max-w-xs rounded-xl bg-black/70 p-3 text-sm">{error}</p>
        ) : (
          <p className="mx-auto mb-6 max-w-xs rounded-xl bg-black/50 px-3 py-2 text-sm backdrop-blur">
            {recording
              ? seconds < MIN_SECONDS
                ? "Keep going…"
                : TIPS[tip]
              : "Start in a corner. Pan slowly across the whole room."}
          </p>
        )}
        <button
          aria-label={recording ? "Stop recording" : "Start recording"}
          disabled={!!error || (recording && seconds < MIN_SECONDS)}
          onClick={recording ? stop : start}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span
            className={`block bg-red-600 transition-all ${recording ? "h-8 w-8 rounded-md" : "h-16 w-16 rounded-full"}`}
          />
        </button>
        <p className="mt-3 text-xs text-white/70">
          {recording ? "Tap to finish · stops automatically at 1:30" : "20–60 seconds is ideal"}
        </p>
      </div>
    </div>
  );
}
