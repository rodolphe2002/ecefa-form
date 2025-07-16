const express = require('express');
const router = express.Router();
const Etudiant = require('../models/Etudiant');
const PDFDocument = require('pdfkit');
const Formulaire = require('../models/Formulaire');






// 🔹 Fonction utilitaire pour extraire un champ à partir d'un label
function extraireChamp(etudiant, labelRecherche, champsFormulaire) {
  const champTrouvé = champsFormulaire.find(
    (champ) =>
      champ.label?.toLowerCase().trim() === labelRecherche.toLowerCase().trim()
  );
  if (!champTrouvé) return '—';
  const cle = champTrouvé.key;
  return etudiant.donnees?.[cle] || '—';
}

// 📌 Génération PDF liste
router.get('/pdf-liste', async (req, res) => {
  try {
    const formulaireActif = await Formulaire.findOne({ actif: true });
    const champsFormulaireActif = formulaireActif?.champs || [];

    const { formation, debut, fin } = req.query;
    const filter = {};

    if (formation) filter['donnees.formation'] = formation;
    if (debut || fin) {
      filter.createdAt = {};
      if (debut) filter.createdAt.$gte = new Date(debut);
      if (fin) filter.createdAt.$lte = new Date(fin);
    }

    const inscrits = await Etudiant.find(filter).sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    const filename = formation
      ? `liste_${formation.toLowerCase().replace(/\s+/g, '_')}.pdf`
      : 'liste_inscriptions.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${filename}`);
    doc.pipe(res);

    let titre = "Liste des inscriptions";
    if (formation) titre += ` – ${formation}`;
    doc.fontSize(16).fillColor('#2c3e50').text(titre, { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).fillColor('#555');
    if (formation) doc.text(`Formation : ${formation}`);
    if (debut) doc.text(`À partir du : ${new Date(debut).toLocaleDateString()}`);
    if (fin) doc.text(`Jusqu'au : ${new Date(fin).toLocaleDateString()}`);
    doc.moveDown();

    let y = doc.y;

    // En-têtes du tableau
    doc.rect(50, y, 500, 20).fill('#3498db');
    doc.fillColor('#fff').fontSize(11);
    doc.text("Nom", 52, y + 5, { continued: true });
    doc.text("Formation", 160, y + 5, { continued: true });
    doc.text("Téléphone", 300, y + 5, { continued: true });
    doc.text("Statut", 400, y + 5, { continued: true });
    doc.text("Date", 470, y + 5);
    y += 25;

    inscrits.forEach((etudiant, index) => {
      const nom = extraireChamp(etudiant, 'Nom & Prénom', champsFormulaireActif);
      const formationValue = extraireChamp(etudiant, 'Formation', champsFormulaireActif);
      const telephone = extraireChamp(etudiant, 'Téléphone', champsFormulaireActif);
      const statut = etudiant.statut || 'En attente';
      const date = new Date(etudiant.createdAt).toLocaleDateString();

      doc.rect(50, y, 500, 20).fill(index % 2 === 0 ? '#ecf0f1' : '#ffffff');
      doc.fillColor('#000').fontSize(10);
      doc.text(nom, 52, y + 5, { continued: true });
      doc.text(formationValue, 160, y + 5, { continued: true });
      doc.text(telephone, 300, y + 5, { continued: true });
      doc.text(statut, 400, y + 5, { continued: true });
      doc.text(date, 470, y + 5);
      y += 22;

      if (y > 750) {
        doc.addPage();
        y = 50;
      }
    });

    doc.rect(50, y + 10, 500, 20).fill('#f9e79f');
    doc.fillColor('#000').fontSize(10).text(`Total : ${inscrits.length} inscrit(s)`, 52, y + 15);

    doc.end();
  } catch (err) {
    console.error("Erreur génération PDF liste :", err);
    res.status(500).send("Erreur serveur lors de la génération du PDF.");
  }
});

// ✅ POST /inscription
// ✅ POST /inscription
router.post('/', async (req, res) => {
  try {
    const donnees = req.body;

    // Récupération sécurisée des champs
    const nom_prenom = donnees?.nom_prenom?.trim() || null;
    const telephone = donnees?.telephone?.trim() || null;
    const date_naissance = donnees?.date_naissance || null;

    // ❗ Un des trois au moins doit exister pour qu’on tente la vérification
    const conditions = [];

    if (nom_prenom && telephone && date_naissance) {
      conditions.push({
        $and: [
          { "donnees.nom_prenom": { $regex: new RegExp(`^${nom_prenom}$`, 'i') } },
          { "donnees.telephone": telephone },
          { "donnees.date_naissance": date_naissance }
        ]
      });
    }

    if (nom_prenom && telephone) {
      conditions.push({
        "donnees.nom_prenom": { $regex: new RegExp(`^${nom_prenom}$`, 'i') },
        "donnees.telephone": telephone
      });
    }

    if (nom_prenom && date_naissance) {
      conditions.push({
        "donnees.nom_prenom": { $regex: new RegExp(`^${nom_prenom}$`, 'i') },
        "donnees.date_naissance": date_naissance
      });
    }

    if (telephone && date_naissance) {
      conditions.push({
        "donnees.telephone": telephone,
        "donnees.date_naissance": date_naissance
      });
    }

    if (telephone) {
      conditions.push({ "donnees.telephone": telephone });
    }

    if (nom_prenom) {
      conditions.push({
        "donnees.nom_prenom": { $regex: new RegExp(`^${nom_prenom}$`, 'i') }
      });
    }

    if (conditions.length > 0) {
      const existing = await Etudiant.findOne({ $or: conditions });
      if (existing) {
        return res.status(400).json({ message: "⚠️ Cette personne semble déjà inscrite." });
      }
    }

    const etudiant = new Etudiant({ donnees });
    await etudiant.save();

    res.status(201).json({ message: "✅ Inscription réussie !" });
  } catch (err) {
    console.error("Erreur POST /inscription :", err);
    res.status(500).json({ message: "❌ Erreur serveur", error: err.message });
  }
});

// ✅ Vérifier inscription
router.get('/verifier', async (req, res) => {
  const { nom_prenom, date_naissance, telephone } = req.query;

  const conditions = [];

  if (telephone) conditions.push({ "donnees.telephone": telephone });
  if (telephone && nom_prenom) conditions.push({ "donnees.telephone": telephone, "donnees.nom_prenom": nom_prenom });
  if (telephone && date_naissance) conditions.push({ "donnees.telephone": telephone, "donnees.date_naissance": date_naissance });
  if (nom_prenom && date_naissance) conditions.push({ "donnees.nom_prenom": nom_prenom, "donnees.date_naissance": date_naissance });

  const exist = await Etudiant.findOne({ $or: conditions });

  if (exist) {
    return res.status(200).json({ inscrit: true, nom: exist.donnees.nom_prenom });
  }

  return res.status(200).json({ inscrit: false });
});

// ✅ Voir tous les inscrits
router.get('/', async (req, res) => {
  try {
    const etudiants = await Etudiant.find().sort({ createdAt: -1 });
    res.json(etudiants);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// ✅ Confirmer un inscrit
router.patch('/confirmer/:id', async (req, res) => {
  try {
    const updated = await Etudiant.findByIdAndUpdate(
      req.params.id,
      { statut: 'Confirmée' },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// ✅ Modifier un inscrit
router.put('/:id', async (req, res) => {
  try {
    const updated = await Etudiant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// ✅ Statistiques globales
router.get('/stats', async (req, res) => {
  try {
    const total = await Etudiant.countDocuments();
    const confirmees = await Etudiant.countDocuments({ statut: 'Confirmée' });
    const enAttente = await Etudiant.countDocuments({ statut: 'En attente' });

    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalCeMois = await Etudiant.countDocuments({ createdAt: { $gte: debutMois } });
    const confirmeesCeMois = await Etudiant.countDocuments({ statut: 'Confirmée', createdAt: { $gte: debutMois } });
    const enAttenteCeMois = await Etudiant.countDocuments({ statut: 'En attente', createdAt: { $gte: debutMois } });

    const tauxConfirmation = total > 0 ? Math.round((confirmees / total) * 100) : 0;
    const tauxConfirmationCeMois = totalCeMois > 0 ? Math.round((confirmeesCeMois / totalCeMois) * 100) : 0;
    const variationTaux = tauxConfirmationCeMois - tauxConfirmation;

    res.json({
      total,
      confirmees,
      enAttente,
      totalCeMois,
      confirmeesCeMois,
      enAttenteCeMois,
      tauxConfirmation,
      variationTaux
    });
  } catch (err) {
    res.status(500).json({ message: "Erreur stats", error: err.message });
  }
});

// ✅ Statistiques par formation
router.get('/stats/formations', async (req, res) => {
  try {
    const stats = await Etudiant.aggregate([
      { $group: { _id: "$formation", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "Erreur stats formations", error: err.message });
  }
});

// ✅ Fiche PDF étudiant
router.get('/fiche/:id', async (req, res) => {
  try {
    const etudiant = await Etudiant.findById(req.params.id);
    if (!etudiant) return res.status(404).send("Étudiant non trouvé");

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=fiche_etudiant.pdf');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#3498db').text("Fiche d'inscription", { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).fillColor('#000');
    doc.text(`Nom et Prénom : ${etudiant.nom_prenom}`);
    doc.text(`Date de naissance : ${etudiant.date_naissance || '—'}`);
    doc.text(`Formation : ${etudiant.formation || '—'}`);
    doc.text(`Date de formation : ${etudiant.date_formation || '—'}`);
    doc.text(`Activité : ${etudiant.activite || '—'}`);
    doc.text(`Téléphone : ${etudiant.telephone}`);
    doc.text(`WhatsApp : ${etudiant.whatsapp || '—'}`);
    doc.text(`Statut : ${etudiant.statut || 'En attente'}`);
    doc.text(`Date d'inscription : ${new Date(etudiant.createdAt).toLocaleDateString()}`);
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#888').text('Document généré automatiquement. Merci de vérifier les informations.', { align: 'center' });
    doc.end();
  } catch (err) {
    console.error("Erreur PDF :", err);
    res.status(500).send("Erreur serveur lors de la génération du PDF.");
  }
});

// ⚠️ Route par ID (toujours à la fin)
router.get('/:id', async (req, res) => {
  try {
    const etudiant = await Etudiant.findById(req.params.id);
    if (!etudiant) return res.status(404).json({ message: "Inscription non trouvée" });
    res.json(etudiant);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
