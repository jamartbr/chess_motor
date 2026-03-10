<script setup lang="ts">
import { computed } from 'vue';
import Piece from './Piece.vue';
import { Color, GameMode } from '@chess-motor/engine';
import type { MoveAnnotation } from '@chess-motor/engine';

const props = defineProps<{
  index:          number;
  piece:          any;
  isSelected:     boolean;
  isLastMove:     boolean;
  control:        Color | null;
  currentTurn:    Color;
  playerColor:    Color | null;
  mode:           GameMode;
  isMultiplayer:  boolean;
  isLegalTarget:  boolean;
  annotation:     MoveAnnotation | null;
}>();

const emit = defineEmits(['click', 'move']);

const isLight = computed(() => {
  const rank = props.index >> 4;
  const file = props.index & 7;
  return (rank + file) % 2 !== 0;
});

const coordinateName = computed<{ file: string; rank: number }>(() => {
  const fileIdx  = props.index & 7;
  const rankIdx  = props.index >> 4;
  const isWhiteView = props.playerColor === Color.White;
  const file = String.fromCharCode(97 + (isWhiteView ? fileIdx : 7 - fileIdx));
  const rank = isWhiteView ? rankIdx + 1 : 8 - rankIdx;
  return { file, rank };
});

// Compute background class as a single resolved value so selected
// always beats last-move, and analysis highlights are independent
const squareBg = computed(() => {
  if (props.isSelected)   return 'bg-yellow-400/80';
  if (props.isLegalTarget) return 'bg-emerald-400/30';
  if (props.isLastMove)    return 'bg-yellow-200/40';
  return '';
});

// Label shown on legal-target squares in Analysis mode
const annotationLabel = computed<string | null>(() => {
  if (!props.annotation) return null;
  if (props.annotation.mateIn !== null) return `M${props.annotation.mateIn}`;
  const d = props.annotation.scoreDelta;
  if (d === 0) return '=';
  return d > 0 ? `+${(d / 100).toFixed(1)}` : `${(d / 100).toFixed(1)}`;
});

// Color the label: green for gain, red for loss, white for neutral/mate
const labelColor = computed(() => {
  if (!props.annotation) return '';
  if (props.annotation.mateIn !== null) return 'text-yellow-300';
  return props.annotation.scoreDelta > 0
    ? 'text-emerald-300'
    : props.annotation.scoreDelta < 0
      ? 'text-red-400'
      : 'text-white';
});

const onDragOver = (e: DragEvent) => e.preventDefault();

const onDrop = (e: DragEvent) => {
  const fromIndexRaw = e.dataTransfer?.getData('text/plain');
  if (fromIndexRaw) emit('move', parseInt(fromIndexRaw), props.index);
};
</script>

<template>
  <div
    class="relative w-[65px] h-[65px] flex items-center justify-center transition-all duration-300"
    :class="[
      isLight ? 'bg-[#ebecd0]' : 'bg-[#779556]',
      squareBg,
      (control !== null && mode === GameMode.Dominion)
        ? (control === Color.White
            ? 'shadow-[inset_0_0_20px_rgba(59,130,246,0.6)]'
            : 'shadow-[inset_0_0_20px_rgba(239,68,68,0.6)]')
        : ''
    ]"
    @dragover="onDragOver"
    @drop="onDrop"
    @click.stop="emit('click')"
  >
    <!-- Rank coordinate (left edge) -->
    <span
      v-if="playerColor === Color.White ? (index & 7) === 0 : (index & 7) === 7"
      class="absolute left-0.5 top-0.5 text-[10px] font-bold select-none z-10"
      :class="isLight ? 'text-[#779556]' : 'text-[#ebecd0]'"
    >
      {{ coordinateName.rank }}
    </span>

    <!-- File coordinate (bottom edge) -->
    <span
      v-if="playerColor === Color.White ? (index >> 4) === 0 : (index >> 4) === 7"
      class="absolute right-0.5 bottom-0.5 text-[10px] font-bold select-none z-10"
      :class="isLight ? 'text-[#779556]' : 'text-[#ebecd0]'"
    >
      {{ coordinateName.file }}
    </span>

    <!-- Legal-move dot (empty target square) -->
    <div
      v-if="isLegalTarget && !piece"
      class="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
    >
      <div class="w-[28%] h-[28%] rounded-full bg-slate-900/30"></div>
    </div>

    <!-- Analysis annotation label -->
    <div
      v-if="annotationLabel"
      class="absolute bottom-0.5 left-1/2 -translate-x-1/2 z-40 pointer-events-none
             text-[9px] font-black leading-none px-1 py-0.5 rounded
             bg-slate-900/70 backdrop-blur-sm"
      :class="labelColor"
    >
      {{ annotationLabel }}
    </div>

    <!-- Piece -->
    <div class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <Piece
        v-if="piece"
        :type="piece.type"
        :color="piece.color"
        :index="index"
        :current-turn="currentTurn"
        :player-color="playerColor"
        :is-multiplayer="isMultiplayer"
        @click="$emit('click')"
        class="pointer-events-auto"
      />
    </div>
  </div>
</template>