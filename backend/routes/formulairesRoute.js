const express = require('express');
const router = express.Router();
const Formulaire = require('../models/Formulaire');
const { v4: uuidv4 } = require('uuid');

// ✅ Créer un nouveau formulaire
router.post('/', async (req, res) => {
  try {
    const { nom, champs, actif = false } = req.body;

    // Si ce formulaire est actif, désactiver les autres
    if (actif) {
      await Formulaire.updateMany({ actif: true }, { $set: { actif: false } });
    }

    const nouveauFormulaire = new Formulaire({
      nom,
      champs,
      actif,
      slug: uuidv4() // ou slugify(nom) si besoin
    });

    await nouveauFormulaire.save();
    res.status(201).json(nouveauFormulaire);
  } catch (err) {
    console.error("Erreur création formulaire :", err);
    res.status(500).json({ message: "Erreur création formulaire", error: err.message });
  }
});

// ✅ Récupérer tous les formulaires
router.get('/', async (req, res) => {
  try {
    const formulaires = await Formulaire.find().sort({ dateCreation: -1 });
    res.json(formulaires);
  } catch (err) {
    console.error("Erreur récupération formulaires :", err);
    res.status(500).json({ message: "Erreur récupération formulaires", error: err.message });
  }
});

// ✅ Récupérer le formulaire actif (statique, doit être avant la route dynamique)
router.get('/actif', async (req, res) => {
  try {
    const formulaire = await Formulaire.findOne({ actif: true });
    if (!formulaire) {
      return res.status(404).json({ message: "Aucun formulaire actif trouvé." });
    }
    res.json(formulaire);
  } catch (err) {
    console.error("Erreur récupération formulaire actif :", err);
    res.status(500).json({ message: "Erreur récupération formulaire actif", error: err.message });
  }
});



// ✅ Récupérer un formulaire par son ID (utilisé dans le dashboard admin)
router.get('/id/:id', async (req, res) => {
  try {
    const formulaire = await Formulaire.findById(req.params.id);
    if (!formulaire) {
      return res.status(404).json({ message: "Formulaire introuvable" });
    }
    res.json(formulaire);
  } catch (err) {
    console.error("Erreur récupération formulaire par ID :", err);
    res.status(500).json({ message: "Erreur récupération formulaire", error: err.message });
  }
});


// ✅ Récupérer un formulaire par son slug (pour le client)
router.get('/:slug', async (req, res) => {
  try {
    const formulaire = await Formulaire.findOne({ slug: req.params.slug });
    if (!formulaire) {
      return res.status(404).json({ message: "Formulaire introuvable" });
    }
    res.json(formulaire);
  } catch (err) {
    console.error("Erreur récupération formulaire :", err);
    res.status(500).json({ message: "Erreur récupération formulaire", error: err.message });
  }
});

// ✅ Supprimer un formulaire
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Formulaire.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Formulaire introuvable" });
    }
    res.json({ message: "Formulaire supprimé" });
  } catch (err) {
    console.error("Erreur suppression formulaire :", err);
    res.status(500).json({ message: "Erreur suppression", error: err.message });
  }
});

// ✅ Modifier un formulaire
router.put('/:id', async (req, res) => {
  try {
    const { nom, champs, actif } = req.body;

    // Si on rend ce formulaire actif, désactiver les autres
    if (actif) {
      await Formulaire.updateMany({ actif: true, _id: { $ne: req.params.id } }, { $set: { actif: false } });
    }

    const updated = await Formulaire.findByIdAndUpdate(
      req.params.id,
      { nom, champs, actif },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Formulaire introuvable" });
    }

    res.json(updated);
  } catch (err) {
    console.error("Erreur mise à jour formulaire :", err);
    res.status(500).json({ message: "Erreur mise à jour", error: err.message });
  }
});



// ✅ Activer / désactiver un formulaire
router.patch('/:id/actif', async (req, res) => {
  try {
    const formulaire = await Formulaire.findById(req.params.id);
    if (!formulaire) return res.status(404).json({ message: "Formulaire introuvable" });

    // Si on l'active, désactiver les autres
    if (!formulaire.actif) {
      await Formulaire.updateMany({ actif: true }, { $set: { actif: false } });
    }

    formulaire.actif = !formulaire.actif;
    await formulaire.save();

    res.json({ message: "Statut mis à jour", actif: formulaire.actif });
  } catch (err) {
    console.error("Erreur activation formulaire :", err);
    res.status(500).json({ message: "Erreur activation", error: err.message });
  }
});


module.exports = router;
