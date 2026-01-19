<script setup lang="ts">
import { computed } from 'vue';
import Piece from './Piece.vue';

const props = defineProps<{
    index: number;
    piece: any;
    isSelected: boolean;
    isLastMove: boolean;
}>();

const emit = defineEmits(['click', 'move']);

const isLight = computed(() => {
    const rank = props.index >> 4;
    const file = props.index & 7;
    return (rank + file) % 2 !== 0;
});

// Calcular nombre de la coordenada (solo para mostrar en los bordes)
const coordinateName = computed(() => {
    const file = String.fromCharCode(97 + (props.index & 7)); // a-h
    const rank = (props.index >> 4) + 1; // 1-8
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
        class="relative w-[65px] h-[65px] flex items-center justify-center transition-colors duration-200"
        :class="[
            isLight ? 'bg-[#ebecd0]' : 'bg-[#779556]',
            isSelected ? 'bg-yellow-400/80' : '',
            isLastMove ? 'bg-yellow-200/40' : ''
        ]"
        @dragover="onDragOver"
        @drop="onDrop"
        @click.stop="emit('click')"
    >

        <span v-if="(index & 7) === 0" 
            class="absolute left-0.5 top-0.5 text-[10px] font-bold select-none"
            :class="isLight ? 'text-[#779556]' : 'text-[#ebecd0]'">
            {{ coordinateName.rank }}
        </span>

        <span v-if="(index >> 4) === 0" 
            class="absolute right-0.5 bottom-0.5 text-[10px] font-bold select-none"
            :class="isLight ? 'text-[#779556]' : 'text-[#ebecd0]'">
            {{ coordinateName.file }}
        </span>
        
        <Piece 
            v-if="piece" 
            :type="piece.type" 
            :color="piece.color" 
            :index="index" 
        />
    </div>
</template>