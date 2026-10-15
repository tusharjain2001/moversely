export type Confidence = "high" | "medium" | "low";

export type Dims = [number, number, number]; // metres: length, depth, height

export type Item = {
  id: string;
  key: string;
  label: string;
  dims: Dims;
  qty: number;
  confidence: Confidence | "manual";
  notes: string[];
  thumbnail?: string;
  views?: number;
};

export type RoomStatus = "empty" | "uploading" | "processing" | "done" | "error";

export type Room = {
  id: string;
  name: string;
  status: RoomStatus;
  progress: number; // 0..1 for the current status
  stage?: string;
  jobId?: string;
  error?: string;
  items: Item[];
  calibration?: { method: string; factor: number };
  stats?: { video_seconds: number; processing_seconds: number; frames_measured_3d: number };
};

export type Units = "imperial" | "metric";

export type CatalogItem = {
  key: string;
  label: string;
  typical: Dims;
  inventory?: boolean;
};

export type ApiItem = {
  id: string;
  key: string;
  label: string;
  dims_m: Dims;
  volume_m3: number;
  volume_ft3: number;
  confidence: Confidence;
  notes: string[];
  views: number;
  thumbnail: string;
};

export type ApiResult = {
  room: string;
  items: ApiItem[];
  summary: { item_count: number; total_volume_m3: number; total_volume_ft3: number };
  calibration: { method: string; factor: number };
  stats: { video_seconds: number; processing_seconds: number; frames_measured_3d: number };
};

export type ApiJob = {
  status: "queued" | "running" | "done" | "error";
  stage?: string;
  progress?: number;
  result?: ApiResult;
  error?: string;
};
