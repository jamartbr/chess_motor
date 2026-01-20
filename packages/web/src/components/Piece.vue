<script setup lang="ts">
  import { computed } from 'vue';
  import { PIECE_IMAGES } from '../assets/chessPieces';
  import { PieceType, Color } from '@chess-motor/engine';

  const props = defineProps<{
    type: PieceType;
    color: Color;
    index: number;
    currentTurn: Color;
  }>();

  const imageSrc = computed(() => {
    const c = props.color === Color.White ? 'w' : 'b';
    // Mapeamos tu enum PieceType a las letras del objeto (P, N, B, R, Q, K)
    const t = props.type; 
    return PIECE_IMAGES[`${c}${t}`];
  });

  const onDragStart = (e: DragEvent) => {
    // Check if it's this piece's turn
    if (props.color !== props.currentTurn) {
      e.preventDefault(); // Stop the drag before it starts
      return;
    }
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', props.index.toString());
      e.dataTransfer.dropEffect = 'move';
      
      // Use the div itself as the drag image
      if (e.currentTarget instanceof HTMLElement) {
        e.dataTransfer.setDragImage(e.currentTarget, 32, 32);
      }
    }
  };

  defineEmits(['click']);

</script>

<template>
  <div
    class="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
    draggable="true"
    @dragstart="onDragStart"
    @click="$emit('click')"
  >
    <img 
      :src="imageSrc" 
      class="w-[85%] h-[85%] select-none pointer-events-none"
    />
  </div>
</template>