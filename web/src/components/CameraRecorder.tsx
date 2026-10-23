"use client";

import { CameraSlash, Lightbulb } from "@phosphor-icons/react";
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
  const elapsed = Math.min(1, seconds / MAX_SECONDS);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0f17] text-white">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      <div className="relative flex items-center justify-between gap-2 px-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={() => {
            if (recording) {
              recorderRef.current!.onstop = null;
              recorderRef.current!.stop();
            }
            onCancel();
          }}
          className="h-11 rounded-full bg-black/50 px-4 text-sm font-bold backdrop-blur transition hover:bg-black/65"
        >
          Cancel
        </button>
        <div className="flex h-9 min-w-0 items-center truncate rounded-full bg-black/50 px-3.5 text-sm font-bold backdrop-blur">
          {roomName}
        </div>
        <div
          className={`flex h-11 items-center gap-2 rounded-full px-3.5 text-[15px] font-extrabold backdrop-blur ${
            recording ? "bg-[#e5484d]" : "bg-black/50"
          }`}
        >
          {recording && <span className="h-2 w-2 rounded-full bg-white" aria-hidden />}
          {mm}:{ss}
        </div>
      </div>

      {recording && (
        <div className="relative mx-4 mt-3" aria-hidden>
          <div className="h-1 overflow-hidden rounded-sm bg-white/20">
            <span className="block h-full bg-white transition-[width] duration-1000 ease-linear" style={{ width: `${elapsed * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-bold text-white/70">
            <span>20–60 s ideal</span>
            <span>1:30 max</span>
          </div>
        </div>
      )}

      {/* Corner guides */}
      <div className="pointer-events-none relative mx-7 my-5 flex-1">
        {[
          "left-0 top-0 rounded-tl-[10px] border-l-[3px] border-t-[3px]",
          "right-0 top-0 rounded-tr-[10px] border-r-[3px] border-t-[3px]",
          "bottom-0 left-0 rounded-bl-[10px] border-b-[3px] border-l-[3px]",
          "bottom-0 right-0 rounded-br-[10px] border-b-[3px] border-r-[3px]",
        ].map((c) => (
          <span key={c} className={`absolute h-9 w-9 border-[#5eead4] ${c}`} />
        ))}
      </div>

      <div className="relative flex flex-col items-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
        {error ? (
          <div className="mb-5 max-w-[300px] rounded-[18px] bg-[#0b0f17]/85 p-5">
            <CameraSlash size={30} weight="duotone" className="mx-auto text-[#ffb4ae]" aria-hidden />
            <p className="mt-2.5 text-sm leading-normal">{error}</p>
          </div>
        ) : (
          <p className="mb-5 flex max-w-[300px] items-center gap-2 rounded-[14px] bg-black/55 px-4 py-2.5 text-sm font-bold backdrop-blur">
            <Lightbulb size={16} weight="fill" className="flex-none text-[#5eead4]" aria-hidden />
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
          className="relative grid h-[84px] w-[84px] place-items-center rounded-full disabled:opacity-40"
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: recording
                ? `conic-gradient(#ffffff 0 ${elapsed * 360}deg, rgb(255 255 255 / 0.3) ${elapsed * 360}deg 360deg)`
                : "#ffffff",
            }}
          />
          <span aria-hidden className="absolute inset-[5px] rounded-full bg-[#1a2230]" />
          <span
            aria-hidden
            className={`relative block bg-[#e5484d] transition-all ${recording ? "h-8 w-8 rounded-lg" : "h-[62px] w-[62px] rounded-full"}`}
          />
        </button>
        <p className="mt-3 text-xs font-semibold text-white/75">
          {recording ? "Tap to finish · stops automatically at 1:30" : "20–60 seconds is ideal"}
        </p>
      </div>
    </div>
  );
}
