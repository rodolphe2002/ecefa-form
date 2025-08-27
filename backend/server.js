// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const Admin = require('./models/Admin'); // ton modèle Admin

const app = express();

// 🌐 Origines autorisées
const allowedOrigins = [
  'https://ecefa-form-seven.vercel.app',
  'http://localhost:3000'
];

// 🔹 CORS configuration
app.use(cors({
  origin: function(origin, callback){
    // autoriser les requêtes sans origin (ex: Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

// Gestion des requêtes préflight OPTIONS
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// 🔹 Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connecté à MongoDB');

    // Créer l’admin si inexistant
    const exists = await Admin.findOne({ username: process.env.ADMIN_USERNAME });
    if (!exists) {
      const admin = new Admin({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD // le hash se fait dans le modèle
      });
      await admin.save();
      console.log('✅ Admin créé');
    } else {
      console.log('⚠️ Admin déjà existant');
    }
  })
  .catch(err => console.error('❌ Erreur MongoDB:', err));

// 🔹 Routes API
app.use('/api/admin', require('./routes/adminRoute'));
app.use('/api/inscription', require('./routes/inscriptionRoute'));
app.use('/api/formulaires', require('./routes/formulairesRoute'));

// 🔹 Static files (si besoin)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 🔹 Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
