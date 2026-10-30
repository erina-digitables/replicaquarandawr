import data from "@/data/quarters.json";

/** One rub' al-hizb. 240 of them, 8 per juz. Start points from quran-meta (Hafs), MIT. */
export type Quarter = {
  rub: number;
  juz: number;
  hizb: number;
  rubInJuz: number;
  code: string;
  juzName: string;
  surah: number;
  ayah: number;
  surahName: string;
};

export const QUARTERS_PER_JUZ = 8;
export const TOTAL_QUARTERS = 240;
export const quarters = data as Quarter[];

export function quarter(rub: number): Quarter {
  const q = quarters[rub - 1];
  if (!q) throw new Error(`No quarter ${rub}`);
  return q;
}

export function quarterTitle(rub: number) {
  const q = quarter(rub);
  return `Juz ${q.juz} · quarter ${q.rubInJuz}`;
}

export function quarterStart(rub: number) {
  const q = quarter(rub);
  return `Starts ${q.surahName} ${q.surah}:${q.ayah}`;
}

export function juzQuarters(juz: number) {
  return quarters.filter((q) => q.juz === juz);
}

export function juzLabel(count: number) {
  const juz = count / QUARTERS_PER_JUZ;
  if (juz === 0.125) return "an eighth of a juz";
  if (juz === 0.25) return "a quarter of a juz";
  if (juz === 0.5) return "half a juz";
  if (juz === 1) return "1 juz";
  return `${+juz.toFixed(2)} juz`;
}

/** "Juz 2 · quarters 1-4", "Juz 1-2", or a short list. */
export function portionTitle(rubs: number[]) {
  if (rubs.length === 0) return "Nothing planned yet";
  const sorted = [...rubs].sort((a, b) => a - b);
  const juzes = [...new Set(sorted.map((r) => quarter(r).juz))];
  const contiguous = sorted.every((r, i) => i === 0 || r === sorted[i - 1] + 1);
  if (juzes.length === 1) {
    const first = quarter(sorted[0]).rubInJuz;
    const last = quarter(sorted.at(-1)!).rubInJuz;
    if (sorted.length === 1) return `Juz ${juzes[0]} · quarter ${first}`;
    return contiguous ? `Juz ${juzes[0]} · quarters ${first}-${last}` : `Juz ${juzes[0]} · ${sorted.length} quarters`;
  }
  return contiguous ? `Juz ${juzes[0]}-${juzes.at(-1)}` : `${sorted.length} quarters across ${juzes.length} juz`;
}
