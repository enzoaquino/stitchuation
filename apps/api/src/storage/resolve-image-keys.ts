import { getStorage } from "./index.js";

export function resolveImageKey(key: string | null): string | null {
  if (!key) return key;
  return getStorage().resolveUrl(key);
}

export function resolvePieceImageKeys<T extends { imageKey: string | null }>(piece: T): T {
  return { ...piece, imageKey: resolveImageKey(piece.imageKey) };
}

export function resolvePieceImageKeysArray<T extends { imageKey: string | null }>(pieces: T[]): T[] {
  return pieces.map(resolvePieceImageKeys);
}
