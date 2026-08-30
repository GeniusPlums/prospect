import { hashString } from "@/lib/utils";

const DIM = 64;

export function embedText(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+/# ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  for (const token of tokens) {
    const i = hashString(token) % DIM;
    vec[i] += 1;
    const j = hashString(`${token}:2`) % DIM;
    vec[j] += 0.5;
  }
  let norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  if (norm === 0) norm = 1;
  return vec.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i += 1) s += a[i] * b[i];
  return s;
}
