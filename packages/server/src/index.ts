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

// Use a unique room for testing
const TEST_ROOM = "demo-room-123";

io.on('connection', (socket) => {
  socket.on('join_room', (roomId: string) => {
    // 1. Leave any previous rooms to avoid "double moves"
    const currentRooms = Array.from(socket.rooms);
    currentRooms.forEach(room => {
        if (room !== socket.id) socket.leave(room);
    });

    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
    
    // 2. Count players in this room
    const room = io.sockets.adapter.rooms.get(roomId);
    const numClients = room ? room.size : 0;

    // 3. Assign role based on room occupancy
    const assignedColor = numClients === 1 ? Color.White : Color.Black;
    socket.emit('assigned_role', assignedColor);

    if (numClients === 2) {
      io.to(roomId).emit('game_ready');
    }
  });

//   socket.on('send_move', (data: { roomId: string, from: number, to: number, promotion: string }) => {
//     // Reenviamos el movimiento a todos en la sala EXCEPTO al que lo envió
//     socket.to(data.roomId).emit('receive_move', data);
//   });

  socket.on('make_move', (data: { roomId: string, from: number, to: number, promotion: string }) => {
    // El servidor recibe el movimiento y lo envía a los DEMÁS en la misma sala
    socket.to(data.roomId).emit('opponent_move', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor multiplayer corriendo en puerto ${PORT}`);
});