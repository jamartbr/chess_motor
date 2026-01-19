<script setup lang="ts">
import { computed } from 'vue';
import { PIECE_IMAGES } from '../assets/chessPieces';
import { PieceType, Color } from '@chess-motor/engine';

const props = defineProps<{
  type: PieceType;
  color: Color;
  index: number;
}>();

const imageSrc = computed(() => {
  const c = props.color === Color.White ? 'w' : 'b';
  // Mapeamos tu enum PieceType a las letras del objeto (P, N, B, R, Q, K)
  const t = props.type; 
  return PIECE_IMAGES[`${c}${t}`];
});

const onDragStart = (e: DragEvent) => {
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', props.index.toString());
    e.dataTransfer.dropEffect = 'move';
    
    // Crear una imagen de previsualización fantasma opcional
    const img = new Image();
    img.src = imageSrc.value;
    e.dataTransfer.setDragImage(img, 30, 30);
  }
};
</script>

<template>
  <img 
    :src="imageSrc" 
    class="w-full h-full cursor-grab active:cursor-grabbing select-none"
    draggable="true"
    @dragstart="onDragStart"
  />
</template>