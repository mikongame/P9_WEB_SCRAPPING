import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import productsRouter from './routes/products.js';

dotenv.config();

const app = express();
app.use(express.json());

// Conexión Mongo
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error conexión:', err));

// Rutas
app.use('/products', productsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
