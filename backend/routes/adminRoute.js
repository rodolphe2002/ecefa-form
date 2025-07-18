const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET;

if (!SECRET_KEY) {
  console.error('⚠️ JWT_SECRET n’est pas défini dans le .env');
  process.exit(1);
}

// ---------------- Connexion Admin ----------------
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    console.log("Champs requis manquants.");
    return res.status(400).json({ message: 'Champs requis manquants.' });
  }

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: '❌ Utilisateur introuvable' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: '❌ Mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      SECRET_KEY,
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      message: '✅ Connexion réussie',
      token
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Erreur serveur',
      error: err.message
    });
  }
});



// ---------------- Modifier mot de passe Admin ----------------
router.post('/change-password', verifierToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Champs requis manquants." });
  }

  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: "Admin introuvable." });

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "❌ Ancien mot de passe incorrect." });
    }

    admin.password = newPassword;
    await admin.save();

    return res.status(200).json({ message: "✅ Mot de passe mis à jour avec succès." });
  } catch (err) {
    console.error("Erreur modification mot de passe :", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});





// ---------------- Middleware de vérification du token ----------------
function verifierToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ message: 'Token requis ou mal formé' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Token invalide' });
    }

    req.user = decoded;
    next();
  });
}

// Tu peux ajouter une route protégée ici si tu veux :
router.get('/dashboard', verifierToken, (req, res) => {
  res.json({ message: `Bienvenue ${req.user.username}` });
});

// module.exports = { router, verifierToken };

module.exports = router;

