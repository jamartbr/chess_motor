/**
 * Uses new URL(path, import.meta.url) to ensure Vite 
 * resolves the asset path correctly regardless of the environment
 */
export const SOUNDS = {
  MOVE: new URL('./move.mp3', import.meta.url).href,
  CAPTURE: new URL('./capture.mp3', import.meta.url).href,
  CHECK: new URL('./check.mp3', import.meta.url).href
};