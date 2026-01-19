<script setup lang="ts">
    import { ref, shallowRef, triggerRef, computed } from 'vue';
    import { Board, Color, PieceType } from '@chess-motor/engine';
    import Square from './Square.vue';
    import PromotionSelector from './PromotionSelector.vue';
    import { SOUNDS } from '../assets/sounds';

    const game = shallowRef(new Board());
    const selectedSquare = ref<number | null>(null);
    const moveKey = ref(0); // Contador de movimientos

    const lastMove = ref<{ from: number; to: number } | null>(null);

    const pendingPromotion = ref<{ from: number, to: number } | null>(null);

    // Generamos los índices de forma que la fila 7 (negras) esté arriba 
    // y la fila 0 (blancas) esté abajo.
    const boardIndices = computed(() => {
        const indices = [];
        for (let rank = 7; rank >= 0; rank--) { // De fila 7 a 0
            for (let file = 0; file < 8; file++) {
                indices.push((rank << 4) | file);
            }
        }
        return indices;
    });

    const handleMove = async (from: number, to: number) => {
        const piece = game.value.getPieceAt(from);
        if (!piece) return;

        const isPawn = piece?.type === PieceType.Pawn;
        const isPromotionRank = (to >> 4) === 0 || (to >> 4) === 7;

        if (isPawn && isPromotionRank && game.value.getLegalMoves(from).includes(to)) {
            console.log("Abriendo selector de promoción..."); // Debug
            pendingPromotion.value = { from, to, color: piece.color };
            return; 
        }

        executeMove(from, to);
    };

    const executeMove = (from: number, to: number, promotion: PieceType = PieceType.Queen) => {
        if (game.value.getLegalMoves(from).includes(to)) {
            // 1. Check if there is a piece at the target before moving (to detect capture)
            const isCapture = !!game.value.getPieceAt(to);

            // 2. Execute the move in the engine
            game.value.makeMove(from, to, promotion);

            // 3. Identify who just moved and who is now under attack
            const activeColor = game.value.turn; 
            const opponentColor = activeColor === Color.White ? Color.Black : Color.White;

            // 4. Find the king of the player whose turn it is now
            const kingIndex = game.value.findKing(activeColor);
            
            // 5. Check if that king is attacked by the player who just moved
            const isCheck = game.value.isSquareAttacked(kingIndex, opponentColor);

            // 6. Play the appropriate sound
            if (isCheck) {
                playSound(SOUNDS.CHECK);
            } else if (isCapture) {
                playSound(SOUNDS.CAPTURE);
            } else {
                playSound(SOUNDS.MOVE);
            }

            // 7. Update UI state
            moveKey.value++;
            triggerRef(game);
            lastMove.value = { from, to };
            pendingPromotion.value = null;
            selectedSquare.value = null;
        }
    };

    const onSquareClick = (index: number) => {
        const piece = game.value.getPieceAt(index);

        if (selectedSquare.value === null) {
            // PRIMER CLIC: Seleccionamos solo si hay pieza y es su turno
            if (piece && piece.color === game.value.turn) {
                selectedSquare.value = index;
            }
        } else {
            // SEGUNDO CLIC:
            // Si clicamos otra pieza del mismo color, cambiamos la selección
            if (piece && piece.color === game.value.turn) {
                selectedSquare.value = index;
            } else {
                // Si es casilla vacía o enemiga, intentamos el movimiento
                handleMove(selectedSquare.value, index);
            }
        }
    };

    const getPromotionStyle = (index: number) => {
    const file = index & 7; // Columna (0-7)
    const rank = index >> 4; // Fila (0 o 7)
    
    // Cada casilla mide 64px (512 / 8)
    const left = file * 64;
    
    // Si es blanca (fila 7, arriba), lo pegamos arriba. 
    // Si es negra (fila 0, abajo), lo pegamos abajo.
    if (rank === 7) {
        return { left: `${left}px`, top: '0px' };
    } else {
        return { left: `${left}px`, bottom: '0px' };
    }
    };

    // Function to play chess sounds
    const playSound = (url: string) => {
        const audio = new Audio(url);
        // Ensure we don't block the UI if audio fails
        audio.play().catch(err => console.warn("Audio playback blocked:", err));
    };
</script>

<template>
    <div class="relative">
        <div :key="moveKey" class="grid grid-cols-8 aspect-square w-[560px] border-[12px] border-slate-700 bg-slate-800">
            <Square 
                v-for="index in boardIndices" 
                :key="index"
                :index="index"
                :piece="game.getPieceAt(index)"
                :is-selected="selectedSquare === index"
                :is-last-move="lastMove?.from === index || lastMove?.to === index"
                @click="onSquareClick(index)" 
                @move="handleMove"
            />

            <div v-if="pendingPromotion" class="absolute inset-0 z-[100] bg-black/10">
                <PromotionSelector 
                    :color="pendingPromotion.color"
                    :style="getPromotionStyle(pendingPromotion.to)"
                    @select="(type) => executeMove(pendingPromotion!.from, pendingPromotion!.to, type)"
                />
            </div>
        </div>
    </div>
</template>

