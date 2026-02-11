require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuración de Socket.io con CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.DASHBOARD_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Configuración de PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Middlewares
app.use(cors({
  origin: process.env.DASHBOARD_URL,
  credentials: true
}));
app.use(express.json());

// ============================================
// API REST - ENDPOINTS
// ============================================

// 🔹 ENDPOINT 1: Obtener todas las citas
app.get('/api/appointments', async (req, res) => {
  try {
    // ⚠️ PERSONALIZA ESTA QUERY SEGÚN TU TABLA
    const result = await pool.query(`
      SELECT 
        pk_id,
        nombre_cliente,
        numero_cliente,
        fecha_hora,
        precio_total,
        pedido
      FROM 'Odontologia - Citas Agendadas'
      ORDER BY fecha_hora
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener citas:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 ENDPOINT 2: Obtener citas de hoy
app.get('/api/appointments/today', async (req, res) => {
  try {
    // ⚠️ PERSONALIZA ESTA QUERY SEGÚN TU TABLA
    const result = await pool.query(`
      SELECT * FROM 'Odontologia - Citas Agendadas'
      WHERE fecha_hora = CURRENT_DATE
      ORDER BY fecha_hora
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener citas de hoy:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 ENDPOINT 3: Notificar cambio manualmente (para n8n)
app.post('/api/notify-change', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    // Emitir evento a todos los clientes conectados
    io.emit('appointment_update', {
      type: type, // 'created', 'updated', 'deleted'
      data: data,
      timestamp: new Date()
    });
    
    res.json({ success: true, message: 'Notificación enviada' });
  } catch (err) {
    console.error('Error al notificar cambio:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// WEBSOCKET - CONEXIONES
// ============================================

let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`✅ Cliente conectado. Total: ${connectedClients}`);
  
  // Enviar confirmación de conexión
  socket.emit('connected', { 
    message: 'Conectado al servidor WebSocket',
    timestamp: new Date()
  });

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`❌ Cliente desconectado. Total: ${connectedClients}`);
  });

  // Evento personalizado: solicitar datos frescos
  socket.on('request_appointments', async () => {
    try {
      const result = await pool.query(`
        SELECT * FROM appointments 
        ORDER BY appointment_date, appointment_time
      `);
      
      socket.emit('appointments_data', result.rows);
    } catch (err) {
      console.error('Error al obtener citas:', err);
      socket.emit('error', { message: err.message });
    }
  });
});

// ============================================
// FUNCIÓN PARA NOTIFICAR CAMBIOS DESDE N8N
// ============================================

function notifyAppointmentChange(type, data) {
  io.emit('appointment_update', {
    type: type,
    data: data,
    timestamp: new Date()
  });
  console.log(`📢 Notificación enviada: ${type}`, data);
}

// Exportar para usar en otros archivos si es necesario
module.exports = { notifyAppointmentChange, io };

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🚀 Servidor WebSocket Iniciado        ║
  ║   📡 Puerto: ${PORT}                        ║
  ║   🔗 http://localhost:${PORT}              ║
  ╚══════════════════════════════════════════╝
  `);
});

// Manejo de errores de PostgreSQL
pool.on('error', (err) => {
  console.error('❌ Error inesperado en PostgreSQL:', err);
});
