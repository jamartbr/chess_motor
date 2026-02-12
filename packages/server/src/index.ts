import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // En producción cambia esto por tu URL de Vercel
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);

  socket.on('join_room', (roomId: string) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} unido a sala: ${roomId}`);
    
    // Si hay 2 personas, avisamos que el juego puede empezar
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.size === 2) {
      io.to(roomId).emit('game_ready');
    }
  });

  socket.on('send_move', (data: { roomId: string, from: number, to: number, promotion: string }) => {
    // Reenviamos el movimiento a todos en la sala EXCEPTO al que lo envió
    socket.to(data.roomId).emit('receive_move', data);
  });

  socket.on('disconnect', () => {
    console.log('Jugador desconectado');
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor multiplayer corriendo en puerto ${PORT}`);
});