export { FIELD_META, type CaptureFieldMeta } from "./capture-field-meta";
import { FIELD_META } from "./capture-field-meta";

export const CAPTURE_FIELD_KEYS = Object.keys(FIELD_META);

export function humaniseCaptureField(field: string): string {
  return field
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
