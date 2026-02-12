<script setup lang="ts">
  import { computed } from 'vue';
  import { PIECE_IMAGES } from '../assets/chessPieces';
  import { PieceType, Color } from '@chess-motor/engine';

  const props = defineProps<{
    type: PieceType;
    color: Color;
    index: number;
    currentTurn: Color;
    playerColor: Color | null;
    isMultiplayer: boolean;
  }>();

  const imageSrc = computed(() => {
    const c = props.color === Color.White ? 'w' : 'b';
    // Mapeamos tu enum PieceType a las letras del objeto (P, N, B, R, Q, K)
    const t = props.type; 
    return PIECE_IMAGES[`${c}${t}`] || '';
  });

  const onDragStart = (e: DragEvent) => {
    const isCorrectTurn = props.color === props.currentTurn;

    // LOGIC: If multiplayer, check color. If single player, ignore role check.
    const canMoveThisPiece = !props.isMultiplayer || props.color === props.playerColor;
    
    if (!isCorrectTurn || !canMoveThisPiece) {
      e.preventDefault();
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