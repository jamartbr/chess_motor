<script setup lang="ts">
import { computed } from 'vue';
import Piece from './Piece.vue';
import { Color, GameMode } from '@chess-motor/engine';

const props = defineProps<{
    index: number;
    piece: any;
    isSelected: boolean;
    isLastMove: boolean;
    control: Color | null;
    currentTurn: Color;
    playerColor: Color | null;
    mode: GameMode;
    isMultiplayer: boolean;
}>();

const emit = defineEmits(['click', 'move']);

const isLight = computed(() => {
    const rank = props.index >> 4;
    const file = props.index & 7;
    return (rank + file) % 2 !== 0;
});

const coordinateName = computed<{ file: string; rank: number }>(() => {
    const fileIdx = props.index & 7;
    const rankIdx = props.index >> 4;
    const isWhiteView = props.playerColor === Color.White;

    const file = String.fromCharCode(97 + (isWhiteView ? fileIdx : 7 - fileIdx));
    const rank = isWhiteView ? rankIdx + 1 : 8 - rankIdx;

    return { file, rank };
});

const onDragOver = (e: DragEvent) => e.preventDefault();

const onDrop = (e: DragEvent) => {
    const fromIndexRaw = e.dataTransfer?.getData('text/plain');
    if (fromIndexRaw) {
        const fromIndex = parseInt(fromIndexRaw);
        emit('move', fromIndex, props.index);
    }
};
</script>

<template>
    <div 
        class="relative w-[65px] h-[65px] flex items-center justify-center transition-all duration-300"
        :class="[
            isLight ? 'bg-[#ebecd0]' : 'bg-[#779556]',
            isSelected ? 'bg-yellow-400/80' : '',
            isLastMove ? 'bg-yellow-200/40' : '',
            
            /* Logic for the Square Background Glow */
            (control !== null && mode === GameMode.Dominion)
                ? (control === Color.White ? 'shadow-[inset_0_0_20px_rgba(59,130,246,0.6)]' : 'shadow-[inset_0_0_20px_rgba(239,68,68,0.6)]') 
                : ''
        ]"
        @dragover="onDragOver"
        @drop="onDrop"
        @click.stop="emit('click')"
    >
        <!-- <div 
            v-if="control !== null"
            class="absolute inset-0 pointer-events-none transition-opacity duration-500"
            :class="[
                control === Color.White ? 'bg-blue-500/[0.08]' : 'bg-red-500/[0.08]'
            ]"
        ></div> -->

        <span v-if="(playerColor === Color.White ? (index & 7) === 0 : (index & 7) === 7)" 
            class="absolute left-0.5 top-0.5 text-[10px] font-bold select-none z-10"
            :class="isLight ? 'text-[#779556]' : 'text-[#ebecd0]'">
            {{ coordinateName.rank }}
        </span>

        <span v-if="(playerColor === Color.White ? (index >> 4) === 0 : (index >> 4) === 7)" 
            class="absolute right-0.5 bottom-0.5 text-[10px] font-bold select-none z-10"
            :class="isLight ? 'text-[#779556]' : 'text-[#ebecd0]'">
            {{ coordinateName.file }}
        </span>
        
        <div 
            class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        >
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