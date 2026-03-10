<script setup lang="ts">
import { ref, shallowRef, triggerRef, computed, watch, nextTick, onUnmounted } from 'vue';
import { Engine, Color, PieceType, GameMode } from '@chess-motor/engine';
import type { MoveAnnotation } from '@chess-motor/engine';
import { analyseSquare } from '@chess-motor/engine';
import Square from './Square.vue';
import PromotionSelector from './PromotionSelector.vue';
import { SOUNDS } from '../assets/sounds';
import { Socket } from 'socket.io-client';

const props = defineProps<{
  game:          Engine;
  playerColor:   Color | null;
  isMultiplayer: boolean;
  socket:        Socket;
  roomId:        string;
}>();

const game = computed(() => props.game);

const moveKey          = ref(0);
const selectedSquare   = ref<number | null>(null);
const legalTargets     = ref<number[]>([]);
const analysisMap      = ref<Map<number, MoveAnnotation>>(new Map());

const lastMove         = ref<{ from: number; to: number } | null>(null);
const pendingPromotion = ref<{ from: number; to: number; color: Color } | null>(null);
const isFinished       = ref(false);
const winner           = ref<Color | 'Draw' | null>(null);

// Analysis mode
// true when the current game mode is Analysis
const isAnalysisMode = computed(() => props.game.mode === GameMode.Analysis);

// Board orientation
const boardIndices = computed(() => {
  const indices: number[] = [];
  if (props.playerColor === Color.White) {
    for (let rank = 7; rank >= 0; rank--)
      for (let file = 0; file < 8; file++)
        indices.push((rank << 4) | file);
  } else {
    for (let rank = 0; rank < 8; rank++)
      for (let file = 7; file >= 0; file--)
        indices.push((rank << 4) | file);
  }
  return indices;
});

const scrollBox = ref<HTMLElement | null>(null);

/**
 * props.game.moveHistory is a plain array inside a non-reactive Engine.
 * Vue cannot track mutations to it through shallowRef, so movePairs and
 * downloadPGN always saw a stale (empty) snapshot.
 * We mirror it into a local ref and call syncHistory() after every move,
 * making movePairs reliably reactive.
 */
const moveHistoryMirror = ref<string[]>([]);
const syncHistory = () => {
  moveHistoryMirror.value = [...props.game.moveHistory];
};

const movePairs = computed(() => {
  const history = moveHistoryMirror.value;
  const pairs = [];
  for (let i = 0; i < history.length; i += 2)
    pairs.push({ white: history[i]!, black: history[i + 1] ?? '' });
  return pairs;
});

watch(() => moveHistoryMirror.value.length, async () => {
  await nextTick();
  if (scrollBox.value)
    scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
});

// Generate valid PGN with mandatory headers and result token
const downloadPGN = () => {
  const date    = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const result  = isFinished.value
    ? (winner.value === 'Draw' ? '1/2-1/2' : winner.value === Color.White ? '1-0' : '0-1')
    : '*';
  const headers = [
    `[Event "Chess Engine Game"]`,
    `[Date "${date}"]`,
    `[White "?"]`,
    `[Black "?"]`,
    `[Result "${result}"]`,
  ].join('\n');
  const moves = movePairs.value
    .map((p, i) => `${i + 1}. ${p.white}${p.black ? ' ' + p.black : ''}`)
    .join(' ');
  const blob = new Blob([`${headers}\n\n${moves} ${result}`], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'game.pgn';
  a.click();
  URL.revokeObjectURL(url);
};

// Move handling
const handleMove = (from: number, to: number) => {
  const piece = game.value.getPiece(from);
  if (!piece) return;
  const isPawn = piece.type === PieceType.Pawn;
  const isPromotionRank = (to >> 4) === 0 || (to >> 4) === 7;
  if (isPawn && isPromotionRank && game.value.getLegalMoves(from).includes(to)) {
    pendingPromotion.value = { from, to, color: piece.color };
    return;
  }
  executeMove(from, to);
};

const executeMove = (from: number, to: number, promotion: PieceType = PieceType.Queen) => {
  if (!game.value.getLegalMoves(from).includes(to)) return;

  const move = game.value.move(from, to, promotion);
  const isCapture = !!move.captured;

  if (game.value.isGameOver()) {
    isFinished.value = true;
    winner.value = game.value.getWinner();
    // TODO: playSound(SOUNDS.GAME_END);
  }

  const isCheck = game.value.isCheck();

  // Play appropriate sound
  if (isCheck)         playSound(SOUNDS.CHECK);
  else if (isCapture)  playSound(SOUNDS.CAPTURE);
  else                 playSound(SOUNDS.MOVE);

  // Update UI state
  moveKey.value++;
  triggerRef(game);
  syncHistory();
  lastMove.value = { from, to };
  pendingPromotion.value = null;
  // Clear selection & analysis highlights after executing
  clearSelection();

  // Notify move
  if (props.isMultiplayer && props.socket) {
    props.socket.emit('make_move', { roomId: props.roomId, from, to, promotion });
  }
};

// Selection & Analysis
/** Clear selection state and analysis overlays */
const clearSelection = () => {
  selectedSquare.value = null;
  legalTargets.value   = [];
  analysisMap.value    = new Map();
};

/**
 * Select a piece: computes legal moves and, in Analysis mode, runs the
 * Analyzer to build the annotation map for every target square.
 */
const selectPiece = (index: number) => {
  selectedSquare.value = index;
  const targets = game.value.getLegalMoves(index);
  legalTargets.value   = targets;

  if (isAnalysisMode.value) {
    const annotations  = analyseSquare(game.value.board, index);
    const map          = new Map<number, MoveAnnotation>();
    for (const ann of annotations) map.set(ann.to, ann);
    analysisMap.value  = map;
  } else {
    analysisMap.value  = new Map();
  }
};

const onSquareClick = (index: number) => {
  const piece = game.value.getPiece(index);

  if (selectedSquare.value === null) {
    // Nothing selected yet — try to select this piece
    if (
      piece &&
      piece.color === game.value.turn &&
      (piece.color === props.playerColor || !props.isMultiplayer)
    ) {
      selectPiece(index);
    }
  } else {
    // Something already selected
    if (piece && piece.color === game.value.turn) {
      // Clicking another friendly piece: re-select it
      selectPiece(index);
    } else if (isAnalysisMode.value) {
      // In Analysis mode: only move if the target is a legal square;
      // clicking an illegal square just deselects.
      if (legalTargets.value.includes(index)) {
        handleMove(selectedSquare.value, index);
      } else {
        clearSelection();
      }
    } else {
      handleMove(selectedSquare.value, index);
    }
  }
};

const SQUARE_SIZE = 70;

const getPromotionStyle = (index: number) => {
  const file = index & 7;
  const rank = index >> 4;

  const xPos = props.playerColor === Color.White
    ? file * SQUARE_SIZE
    : (7 - file) * SQUARE_SIZE;

  const isWhiteCrowning = rank === 7;

  if (props.playerColor === Color.White) {
    return isWhiteCrowning
      ? { left: `${xPos}px`, top: '0px' }
      : { left: `${xPos}px`, bottom: '0px', flexDirection: 'column-reverse' };
  } else {
    return isWhiteCrowning
      ? { left: `${xPos}px`, bottom: '0px', flexDirection: 'column-reverse' }
      : { left: `${xPos}px`, top: '0px' };
  }
};

const playSound = (url: string) => {
  const audio = new Audio(url);
  audio.play().catch(err => console.warn('Audio playback blocked:', err));
};

const resetGame = () => {
  game.value.reset();
  clearSelection();
  lastMove.value         = null;
  pendingPromotion.value = null;
  isFinished.value       = false;
  winner.value           = null;
  moveKey.value++;
  triggerRef(game);
  syncHistory();
};

// Register socket listener with cleanup to prevent leaks
if (props.socket) {
  const onOpponentMove = (move: { from: number; to: number }) => {
    lastMove.value = { from: move.from, to: move.to };
    syncHistory();
  };
  props.socket.on('opponent_move', onOpponentMove);
  onUnmounted(() => {
    props.socket.off('opponent_move', onOpponentMove);
  });
}
</script>

<template>
  <div class="flex flex-col md:flex-row gap-8 items-start justify-center p-4 w-full h-full max-h-full">

    <!-- Board column -->
    <div class="flex flex-col gap-3 items-center">

      <!-- Analysis mode label -->
      <div
        v-if="isAnalysisMode"
        class="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full"
      >
        <div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
        <span class="text-amber-300 text-xs font-bold uppercase tracking-widest">Analysis Mode — click a piece</span>
      </div>

      <div class="relative">
        <div
          :key="moveKey"
          class="grid grid-cols-8 aspect-square border-[12px] border-slate-700 bg-slate-800 shadow-2xl"
          :style="{ width: `${8 * 70}px` }"
        >
          <Square
            v-for="index in boardIndices"
            :key="index"
            :index="index"
            :piece="game.getPiece(index)"
            :is-selected="selectedSquare === index"
            :is-last-move="lastMove?.from === index || lastMove?.to === index"
            :is-legal-target="legalTargets.includes(index)"
            :annotation="analysisMap.get(index) ?? null"
            :control="game.getSquareControl(index)"
            :current-turn="game.turn"
            :player-color="playerColor"
            :is-multiplayer="isMultiplayer"
            :mode="game.mode"
            @click="onSquareClick(index)"
            @move="handleMove"
          />

          <!-- Promotion overlay -->
          <div v-if="pendingPromotion" class="absolute inset-0 z-[100] bg-black/10">
            <PromotionSelector
              :color="pendingPromotion.color"
              :style="getPromotionStyle(pendingPromotion.to)"
              @select="(type) => executeMove(pendingPromotion!.from, pendingPromotion!.to, type)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel: notation + controls -->
    <div class="flex flex-col gap-4 w-64 shrink-0">

      <!-- Turn indicator -->
      <div class="bg-slate-800 px-4 py-3 rounded-xl border border-slate-700 text-center">
        <span class="text-slate-400 text-sm italic">
          {{ game.turn === Color.White ? "White's turn" : "Black's turn" }}
        </span>
      </div>

      <!-- Move history -->
      <div class="bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden" style="height: 300px;">
        <div class="px-3 py-2 border-b border-slate-700">
          <span class="text-slate-400 text-xs font-bold uppercase tracking-widest">Moves</span>
        </div>
        <div class="moves-scroll flex-grow overflow-y-auto font-mono text-sm px-2 py-1" ref="scrollBox">
          <div v-for="(pair, i) in movePairs" :key="i" class="move-row">
            <span class="num text-slate-500">{{ i + 1 }}.</span>
            <span class="text-white">{{ pair.white }}</span>
            <span class="text-slate-300">{{ pair.black }}</span>
          </div>
        </div>
        <div class="p-2 border-t border-slate-700">
          <button
            @click="downloadPGN"
            class="w-full px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all uppercase tracking-widest"
          >
            Download PGN
          </button>
        </div>
      </div>

      <!-- Dominion score panel -->
      <div
        v-if="game.mode === GameMode.Dominion"
        class="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl"
      >
        <h2 class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Dominion Points</h2>
        <div class="flex flex-col gap-4">
          <div class="flex justify-between items-end">
            <span class="text-white font-medium">White</span>
            <span class="text-3xl font-mono font-bold text-white">{{ game.whitePoints }}</span>
          </div>
          <div class="h-2 w-full bg-slate-700 rounded-full overflow-hidden flex">
            <div
              class="h-full bg-blue-500 transition-all duration-500"
              :style="{ width: `${(game.whitePoints / (game.whitePoints + game.blackPoints || 1)) * 100}%` }"
            ></div>
            <div class="h-full bg-red-500 flex-grow"></div>
          </div>
          <div class="flex justify-between items-end">
            <span class="text-slate-400 font-medium">Black</span>
            <span class="text-3xl font-mono font-bold text-slate-300">{{ game.blackPoints }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Game-over overlay -->
  <div
    v-if="isFinished"
    class="absolute inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-500"
  >
    <div class="relative bg-slate-800 p-12 min-w-[400px] rounded-2xl border-2 border-slate-600 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center flex flex-col items-center gap-8">

      <button
        @click="isFinished = false"
        class="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors"
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="space-y-3 pt-2">
        <h2 class="text-5xl font-black text-white uppercase tracking-tighter leading-none">
          {{ winner === 'Draw' ? "It's a Draw!" : (winner === Color.White ? 'White Victory' : 'Black Victory') }}
        </h2>
        <p v-if="game.mode === GameMode.Classical" class="text-slate-400 uppercase text-xs tracking-[0.2em] font-bold">
          By Checkmate
        </p>
      </div>

      <div
        v-if="game.mode === GameMode.Dominion"
        class="flex gap-10 items-center bg-slate-900/50 px-8 py-6 rounded-xl border border-slate-700 w-full justify-center"
      >
        <div class="text-center">
          <p class="text-[10px] text-slate-500 uppercase font-bold mb-1">Final White</p>
          <p class="text-4xl font-mono font-bold text-blue-400">{{ game.whitePoints }}</p>
        </div>
        <div class="text-xl text-slate-600 italic font-serif">vs</div>
        <div class="text-center">
          <p class="text-[10px] text-slate-500 uppercase font-bold mb-1">Final Black</p>
          <p class="text-4xl font-mono font-bold text-red-400">{{ game.blackPoints }}</p>
        </div>
      </div>

      <button
        @click="resetGame"
        class="w-full sm:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/40 uppercase tracking-widest"
      >
        Play Again
      </button>
    </div>
  </div>
</template>

<style scoped>
.move-row {
  display: grid;
  grid-template-columns: 28px 1fr 1fr;
  padding: 3px 4px;
  border-bottom: 1px solid #2d3a47;
  font-size: 0.8rem;
}
</style>