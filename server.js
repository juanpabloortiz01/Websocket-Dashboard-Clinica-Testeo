require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// ✅ 1. Configuración de Socket.io (Abierto para evitar bloqueos de CORS iniciales)
const io = socketIo(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Configuración de PostgreSQL
const pool = new Pool({
  user: 'juan',
  host: '178.18.255.107',
  database: 'postgres',
  password: 'juanpiz01',
  port: 5432,
  ssl: {
    rejectUnauthorized: false // 👈 Esto es vital para conectar desde fuera a Easypanel
  }
});

// ✅ 2. Middlewares (CORS abierto para desarrollo)
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());

// ✅ 3. RUTA DE BIENVENIDA (Para que no de error al entrar a la URL)
app.get('/', (req, res) => {
  res.send('<h1>🚀 Servidor Quantum Operativo</h1><p>Conectado a DB y WebSockets listos.</p>');
});

// ============================================
// API REST - ENDPOINTS
// ============================================

app.get('/api/appointments', async (req, res) => {
  try {
    const result = await pool.query('SELECT pk_id, nombre_cliente, numero_cliente, fecha_hora, precio_total, pedido FROM "Odontologia - Citas Agendadas" ORDER BY fecha_hora');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener citas:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 ENDPOINT PARA n8n (Ajustado a tu ruta original)
app.post('/api/notify-change', (req, res) => {
  try {
    const { type, data } = req.body;
    io.emit('appointment_update', {
      type: type,
      data: data,
      timestamp: new Date()
    });
    console.log('📢 n8n notificó un cambio:', type);
    res.json({ success: true, message: 'Notificación enviada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// WEBSOCKET - CONEXIONES
// ============================================

io.on('connection', (socket) => {
  console.log(`✅ Nuevo cliente conectado: ${socket.id}`);
  
  socket.emit('connected', { 
    message: 'Conectado al servidor WebSocket de Quantum',
    timestamp: new Date()
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado');
  });
});

// ============================================
// INICIAR SERVIDOR (AJUSTADO PARA EASYPANEL)
// ============================================

const PORT = process.env.PORT || 3000; // Usamos 3000 que es el estándar de Easypanel

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║    🚀 SERVIDOR QUANTUM INICIADO          ║
  ║    📡 PUERTO: ${PORT}                      ║
  ║    🌐 HOST: 0.0.0.0                      ║
  ╚══════════════════════════════════════════╝
  `);
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en PostgreSQL:', err);
});
