/**
 * Small pill component shared across the read-only Follow-up tab.
 *
 * Tone-based variants only (no accent tone — that's reserved for the brand
 * primary color, applied directly inline on section accents).
 *
 * CON-158.
 */
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
};

export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
        TONE_CLASSES[tone]
      }
    >
      {children}
    </span>
  );
}
