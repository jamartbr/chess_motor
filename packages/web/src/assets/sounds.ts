// import moveSound from './sounds/move.mp3';
// import captureSound from './sounds/capture.mp3';
// import checkSound from './sounds/check.mp3';
// import promoteSound from './sounds/promote.mp3';

// export const SOUNDS = {
//   MOVE: moveSound,
//   CAPTURE: captureSound,
//   CHECK: checkSound,
//   PROMOTION: promoteSound,
// };

/**
 * We use new URL(path, import.meta.url) to ensure Vite 
 * resolves the asset path correctly regardless of the environment.
 */
export const SOUNDS = {
  MOVE: new URL('./move.mp3', import.meta.url).href,
  CAPTURE: new URL('./capture.mp3', import.meta.url).href,
  CHECK: new URL('./check.mp3', import.meta.url).href
};