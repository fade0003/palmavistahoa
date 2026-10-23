export type FieldKind = "disposition" | "note" | "issue";
export type FieldDisposition = "resolved" | "still_open";

export interface FieldPhoto {
  id: string;
  url: string;
}

export interface FieldEntry {
  id: string;
  homeId: string;
  address: string;
  kind: FieldKind;
  violationKey: string | null;
  disposition: FieldDisposition | null;
  category: string | null;
  note: string;
  lat: number | null;
  lon: number | null;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  sentryDate: string | null;
  sentryCode: string | null;
  sentryDescription: string | null;
  sentryStatus: string | null;
  photos: FieldPhoto[];
  pending?: boolean;
}

export interface SentrySnapshot {
  date: string;
  code: string;
  description: string;
  status: string;
}
