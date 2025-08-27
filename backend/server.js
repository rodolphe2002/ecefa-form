const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const Admin = require('./models/Admin'); // chemin vers modèle Admin

const app = express();
// Handle preflight requests
app.options('*', cors());

const allowedOrigins = ['https://ecefa-form-seven.vercel.app', 'http://localhost:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});
app.use(express.json());

const { MONGO_URI, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

// Connexion MongoDB
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connecté à MongoDB');

    // Vérifier si admin existe
    const exists = await Admin.findOne({ username: ADMIN_USERNAME });
    if (exists) {
      console.log('⚠️ Admin existe déjà.');
    } else {
      // Créer admin
      const admin = new Admin({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD, // sera hashé dans le modèle automatiquement
      });
      await admin.save();
      console.log('✅ Admin créé avec succès');
    }

    // Routes API
    app.use('/api/inscription', require('./routes/inscriptionRoute'));
    app.use('/api/admin', require('./routes/adminRoute'));
    app.use('/api/formulaires', require('./routes/formulairesRoute'));

    // ⚡ Chemin absolu vers le dossier "public"
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // Route principale : renvoie index.html
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    // Lancement du serveur : utiliser le port fourni par l'hébergeur ou 3000 en local
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
    });

  })
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err);
  });
