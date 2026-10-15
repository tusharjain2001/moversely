"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJob, uploadVideo } from "./api";
import type { ApiResult, CatalogItem, Item, Room, Units } from "./types";

const STORAGE_KEY = "ai-room-survey:v1";
const POLL_MS = 2000;

const DEFAULT_ROOMS = ["Living room", "Bedroom", "Kitchen", "Dining room", "Office", "Garage"];

const uid = () => Math.random().toString(36).slice(2, 10);

const emptyRoom = (name: string): Room => ({ id: uid(), name, status: "empty", progress: 0, items: [] });

function fromResult(result: ApiResult): Partial<Room> {
  return {
    status: "done",
    progress: 1,
    stage: undefined,
    error: undefined,
    calibration: result.calibration,
    stats: result.stats,
    items: result.items.map(
      (it): Item => ({
        id: it.id || uid(),
        key: it.key,
        label: it.label,
        dims: it.dims_m,
        qty: 1,
        confidence: it.confidence,
        notes: it.notes,
        thumbnail: it.thumbnail,
        views: it.views,
      }),
    ),
  };
}

type Saved = { rooms: Room[]; units: Units };

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(data: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private mode): the survey still works, it just
    // won't survive a reload. Thumbnails are the bulk, so retry without them.
    try {
      const slim = data.rooms.map((r) => ({ ...r, items: r.items.map((it) => ({ ...it, thumbnail: undefined })) }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, rooms: slim }));
    } catch {}
  }
}

function initialRooms(): Room[] {
  const saved = load();
  if (!saved) return DEFAULT_ROOMS.map(emptyRoom);
  // An upload can't resume after a reload; a server-side job can.
  return saved.rooms.map((r) =>
    r.status === "uploading" ? { ...r, status: "error", error: "Upload was interrupted. Please try again." } : r,
  );
}

/** Client-only: reads the saved survey on first render (see SurveyApp). */
export function useSurvey() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [units, setUnits] = useState<Units>(() => load()?.units ?? "imperial");
  const roomsRef = useRef(rooms);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    save({ rooms, units });
  }, [rooms, units]);

  const patch = useCallback((id: string, fields: Partial<Room>) => {
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  }, []);

  // Poll every room whose video is being analysed.
  useEffect(() => {
    const timer = setInterval(async () => {
      for (const room of roomsRef.current) {
        if (room.status !== "processing" || !room.jobId) continue;
        try {
          const job = await getJob(room.jobId);
          if (!job) {
            patch(room.id, { status: "error", error: "The AI server lost this job. Please scan the room again." });
          } else if (job.status === "done" && job.result) {
            patch(room.id, fromResult(job.result));
          } else if (job.status === "error") {
            patch(room.id, { status: "error", error: job.error || "Analysis failed." });
          } else {
            patch(room.id, { stage: job.stage, progress: job.progress ?? 0 });
          }
        } catch {
          // Network blip: keep polling.
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [patch]);

  const scanRoom = useCallback(
    async (id: string, video: Blob, filename: string) => {
      const room = roomsRef.current.find((r) => r.id === id);
      if (!room) return;
      patch(id, { status: "uploading", progress: 0, stage: "Uploading video", error: undefined });
      try {
        const jobId = await uploadVideo(video, filename, room.name, (p) => patch(id, { progress: p }));
        patch(id, { status: "processing", jobId, progress: 0, stage: "Starting analysis" });
      } catch (e) {
        patch(id, { status: "error", error: e instanceof Error ? e.message : "Upload failed." });
      }
    },
    [patch],
  );

  const updateItem = useCallback((roomId: string, itemId: string, fields: Partial<Item>) => {
    setRooms((rs) =>
      rs.map((r) =>
        r.id === roomId ? { ...r, items: r.items.map((it) => (it.id === itemId ? { ...it, ...fields } : it)) } : r,
      ),
    );
  }, []);

  const removeItem = useCallback((roomId: string, itemId: string) => {
    setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, items: r.items.filter((it) => it.id !== itemId) } : r)));
  }, []);

  const addItem = useCallback((roomId: string, c: CatalogItem) => {
    const item: Item = { id: uid(), key: c.key, label: c.label, dims: c.typical, qty: 1, confidence: "manual", notes: [] };
    setRooms((rs) =>
      rs.map((r) =>
        r.id === roomId
          ? { ...r, status: r.status === "empty" ? "done" : r.status, items: [...r.items, item] }
          : r,
      ),
    );
  }, []);

  const addRoom = useCallback((name: string) => {
    const room = emptyRoom(name.trim() || "Room");
    setRooms((rs) => [...rs, room]);
    return room.id;
  }, []);

  const removeRoom = useCallback((id: string) => setRooms((rs) => rs.filter((r) => r.id !== id)), []);

  const resetRoom = useCallback(
    (id: string) =>
      patch(id, {
        status: "empty",
        progress: 0,
        items: [],
        stage: undefined,
        error: undefined,
        jobId: undefined,
        calibration: undefined,
        stats: undefined,
      }),
    [patch],
  );

  const resetAll = useCallback(() => setRooms(DEFAULT_ROOMS.map(emptyRoom)), []);

  return {
    rooms,
    units,
    setUnits,
    scanRoom,
    updateItem,
    removeItem,
    addItem,
    addRoom,
    removeRoom,
    resetRoom,
    resetAll,
  };
}

export type Survey = ReturnType<typeof useSurvey>;
