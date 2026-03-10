<script setup lang="ts">
  import { PieceType, Color } from '@chess-motor/engine';
  import { PIECE_IMAGES } from '../assets/chessPieces';

  const props = defineProps<{
    color: Color;
    style?: any;
  }>();

  const emit = defineEmits(['select']);

  const options = [
    { type: PieceType.Queen  },
    { type: PieceType.Rook   },
    { type: PieceType.Bishop },
    { type: PieceType.Knight },
  ];

  const getPieceImage = (type: PieceType) => {
    const c = props.color === Color.White ? 'white' : 'black';
    return PIECE_IMAGES[`${c}${type}`] ?? '';
  };
</script>

<template>
  <div
    class="absolute z-[110] flex flex-col bg-white border-2 border-slate-600 shadow-2xl rounded-md overflow-hidden"
    :style="style"
  >
    <button
      v-for="opt in (props.color === Color.White ? options : [...options].reverse())"
      :key="opt.type"
      @click.stop="emit('select', opt.type)"
      class="w-[70px] h-[70px] flex items-center justify-center hover:bg-blue-100 border-b last:border-0 border-slate-200 p-2"
    >
      <img :src="getPieceImage(opt.type)" class="w-full h-full object-contain" />
    </button>
  </div>
</template>