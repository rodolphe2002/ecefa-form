const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const Admin = require('./models/Admin'); // chemin vers modèle Admin

const app = express();
app.use(cors());
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
