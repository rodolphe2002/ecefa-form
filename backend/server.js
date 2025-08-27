const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const Admin = require('./models/Admin'); // chemin vers modèle Admin

const app = express();

// CORS avec liste blanche + patterns (Vercel previews et domaines Render)
const allowedOrigins = [
  'http://localhost:3000',
  'https://ecefa-form-seven.vercel.app',
  'https://ecefa-form-0l7s.onrender.com'
];

const allowedOriginPatterns = [
  /\.vercel\.app$/i,          // toutes les previews Vercel
  /\.onrender\.com$/i         // domaines Render
];

const corsOptions = {
  origin: function(origin, callback) {
    // origin peut être undefined (ex: requêtes serveur à serveur, healthchecks), on autorise
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes(origin) ||
      allowedOriginPatterns.some((rx) => rx.test(origin));

    if (isAllowed) return callback(null, true);

    console.warn('CORS: origine refusée ->', origin);
    return callback(new Error('Origin non autorisée par CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
// Le préflight OPTIONS est géré par le middleware CORS global au-dessus.

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
