import express from 'express';
import { Color } from './types'
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

// Store players waiting for each mode
// Key: GameMode (e.g., 'classical', 'dominion'), Value: Socket ID
const waitingPlayers: Record<string, string | null> = {
    'classical': null,
    'dominion': null
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('find_match', (data: { mode: string }) => {
    const mode = data.mode;
    console.log(`User ${socket.id} looking for ${mode} match`);

    const opponentId = waitingPlayers[mode];

    if (opponentId && opponentId !== socket.id) {
      // MATCH FOUND!
      const roomId = `room-${opponentId}-${socket.id}`;
      
      // Clear the waiting slot
      waitingPlayers[mode] = null;

      // Join both to the new room
      const opponentSocket = io.sockets.sockets.get(opponentId);
      if (opponentSocket) {
        opponentSocket.join(roomId);
        socket.join(roomId);

        // Notify both and assign roles
        io.to(opponentId).emit('match_found', { roomId, role: 'white' });
        socket.emit('match_found', { roomId, role: 'black' });
        
        // Start the game for both
        io.to(roomId).emit('game_ready');
        console.log(`Match started in ${roomId} for mode ${mode}`);
      }
    } else {
      // NO OPPONENT: Put the player in the waiting line
      waitingPlayers[mode] = socket.id;
      socket.emit('waiting_for_opponent');
      console.log(`User ${socket.id} is now waiting for ${mode}`);
    }
  });

  socket.on('disconnect', () => {
    // Remove from waiting lines if they disconnect
    for (const mode in waitingPlayers) {
      if (waitingPlayers[mode] === socket.id) {
          waitingPlayers[mode] = null;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor multiplayer corriendo en puerto ${PORT}`);
});