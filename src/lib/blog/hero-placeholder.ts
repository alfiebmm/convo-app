export type HeroPlaceholderColour = "orange" | "blue" | "green" | "neutral";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

const BRAND_HUES: Record<Exclude<HeroPlaceholderColour, "neutral">, number> = {
  orange: 18,
  blue: 222,
  green: 122,
};

function parseHexColour(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, "");
  const normalised =
    value.length === 3
      ? value
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : value;

  if (!/^[0-9a-f]{6}$/i.test(normalised)) return null;

  return {
    r: Number.parseInt(normalised.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalised.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalised.slice(4, 6), 16) / 255,
  };
}

function rgbToHsl({ r, g, b }: Rgb): { hue: number; saturation: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return { hue: 0, saturation: 0 };

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue: number;
  if (max === r) {
    hue = (g - b) / delta + (g < b ? 6 : 0);
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  return { hue: hue * 60, saturation };
}

function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360;
  return Math.min(distance, 360 - distance);
}

export function pickHeroPlaceholderColour(hex: string): HeroPlaceholderColour {
  const rgb = parseHexColour(hex);
  if (!rgb) return "neutral";

  const { hue, saturation } = rgbToHsl(rgb);
  if (saturation < 0.12) return "neutral";

  return Object.entries(BRAND_HUES).reduce<{
    colour: Exclude<HeroPlaceholderColour, "neutral">;
    distance: number;
  }>(
    (best, [colour, targetHue]) => {
      const distance = hueDistance(hue, targetHue);
      return distance < best.distance
        ? { colour: colour as Exclude<HeroPlaceholderColour, "neutral">, distance }
        : best;
    },
    { colour: "orange", distance: Number.POSITIVE_INFINITY }
  ).colour;
}

export function isHttpsUrl(value: string | null): value is string {
  if (!value) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
