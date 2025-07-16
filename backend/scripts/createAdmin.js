
const mongoose = require('mongoose');
const Admin = require('../models/Admin'); // chemin correct vers le modèle
require('dotenv').config();

const { MONGO_URI, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

mongoose.connect(MONGO_URI)
  .then(async () => {
    const exists = await Admin.findOne({ username: ADMIN_USERNAME });
    if (exists) {
      console.log('⚠️ Admin existe déjà.');
      return process.exit();
    }

    const admin = new Admin({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD, // sera hashé dans le modèle automatiquement
    });

    await admin.save();
    console.log('✅ Admin créé avec succès');
    process.exit();
  })
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err);
    process.exit(1);
  });
