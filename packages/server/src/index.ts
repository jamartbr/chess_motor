import express from 'express';
import { Color, GameMode } from './types'
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "https://chess-motor.vercel.app",
    methods: ["GET", "POST"]
  }
});

// Room for testing
const TEST_ROOM = "demo-room-123";


// Structure for a waiting player
interface WaitingPlayer {
  id: string;           // Player's socket id
  color: Color | null;  // null when 'Random' color is selected and still searching for a match
}

// One queue for each mode
// This queues store players waiting for each mode, i. e.,
//    Key: GameMode (e.g., 'classical', 'dominion'), 
//    Value: WaitingPlayer
const queues: Record<string, WaitingPlayer[]> = {
  'classical': [],
  'dominion': []
};

// // Store players waiting for each mode 
// // Key: GameMode (e.g., 'classical', 'dominion'), Value: Socket ID
// const waitingPlayers: Record<string, string | null> = {
//   'classical': null,
//   'dominion': null
// };

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('find_match', (data: { mode: string, roomId: string, color: Color }) => {
    const mode = data.mode;
    const color = data.color;
    const currentQueue = queues[mode];
    console.log(`User ${socket.id} looking for ${mode} match with color ${color}`);

    // --- MATCHMAKING LOGIC ---
    let opponentIndex = -1;

    // If color not selected by user: Take the first person in line, if any
    if (color === null)
      opponentIndex = currentQueue.length > 0 ? 0 : -1;
    // If color selected by user: check if first in line is compatible (the opposite or any color)
    else if (currentQueue.length > 0) {
      const first = currentQueue[0];
      const oppositeColor = color === 'w' ? 'b' : 'w';
      opponentIndex = (first.color === null || first.color === oppositeColor) ? 0 : -1;
      
    }

    if (opponentIndex !== -1) {
      // MATCH FOUND!
      const [opponent] = currentQueue.splice(opponentIndex, 1);
      const roomId = `room-${opponent.id}-${socket.id}`;

      // // Clear the waiting slot
      // waitingPlayers[mode] = null;

      // Join both to the new room
      const opponentSocket = io.sockets.sockets.get(opponent.id);
      if (opponentSocket) {
        opponentSocket.join(roomId);
        socket.join(roomId);

        // Decide roles
        let whiteId, blackId;

        if (color === Color.White || opponent.color === Color.Black) {
          whiteId = socket.id; blackId = opponent.id;
        } else if (color === Color.Black || opponent.color === Color.White) {
          whiteId = opponent.id; blackId = socket.id;
        } else {
          // Both chose 'Random', flip a coin
          const flip = Math.random() > 0.5;
          whiteId = flip ? socket.id : opponent.id;
          blackId = flip ? opponent.id : socket.id;
        }

        // Notify both
        io.to(whiteId).emit('match_found', { roomId, role: 'w' });
        io.to(blackId).emit('match_found', { roomId, role: 'b' });

        // // Start the game for both
        // setTimeout(() => {
        //   io.to(roomId).emit('game_ready');
        // }, 100);
        // console.log(`Match started in ${data.roomId} for mode ${mode}`);
      }
    } else {
      // NO OPPONENT: Put the player in the waiting line
      queues[mode].push({ id: socket.id, color });
      socket.emit('waiting_for_opponent');
      console.log(`User ${socket.id} is now waiting for ${mode} match with color ${color}`);
    }
  });

  socket.on('make_move', (data) => {
    // // El servidor recibe el movimiento y lo envía a los DEMÁS en la misma sala
    // socket.to(data.roomId).emit('opponent_move', data);
    // console.log(`request to make move in room ${data.roomId}: from ${data.from} to ${data.to}`)
    console.log(`Step 1: Server received move from ${socket.id} for room ${data.roomId}`);

    // Check if the room actually has the opponent
    const clients = io.sockets.adapter.rooms.get(data.roomId);
    console.log(`Step 2: Room ${data.roomId} contains clients:`, Array.from(clients || []));

    socket.to(data.roomId).emit('opponent_move', data);
    console.log(`Step 3: Broadcast sent to room ${data.roomId}`);
  });

  socket.on('disconnecting', () => {
    // Antes de salir de las salas, avisar a cualquier oponente en salas de partida
    for (const room of socket.rooms) {
      if (room.startsWith('room-')) {
        const clients = io.sockets.adapter.rooms.get(room);
        if (!clients) continue;
        for (const id of clients) {
          if (id === socket.id) continue;
          const opponentSocket = io.sockets.sockets.get(id);
          if (opponentSocket) {
            // Avisar al contrincante y devolverle al menú principal
            opponentSocket.emit('opponent_left', { roomId: room, reason: 'opponent_disconnected' });
            opponentSocket.emit('return_to_menu');
            // Sacar al contrincante de la sala para limpiar estado en el servidor
            opponentSocket.leave(room);
          }
        }
      }
    }
  });

  socket.on('disconnect', () => {
    // Limpiar colas
    for (const mode in queues) {
      queues[mode] = queues[mode].filter(p => p.id !== socket.id);
    }
    console.log(`User disconnected: ${socket.id} and removed from queues`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor multiplayer corriendo en puerto ${PORT}`);
});