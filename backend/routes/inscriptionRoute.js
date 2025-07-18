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




// 📎 Génération PDF liste
router.get('/pdf-liste', async (req, res) => {
  try {
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
    const filename = 'liste_inscriptions.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${filename}`);
    doc.pipe(res);

    // Titre
    let titre = "Liste des inscriptions";
    if (formation) titre += ` – ${formation}`;
    doc.fontSize(16).fillColor('#2c3e50').text(titre, { align: 'center' });
    doc.moveDown();

    // Filtres appliqués
    doc.fontSize(10).fillColor('#555');
    if (formation) doc.text(`Formation : ${formation}`);
    if (debut) doc.text(`À partir du : ${new Date(debut).toLocaleDateString()}`);
    if (fin) doc.text(`Jusqu'au : ${new Date(fin).toLocaleDateString()}`);
    doc.moveDown();

    let y = doc.y;
    const colonnes = [
      { label: 'Nom & Prénom', keys: ['nom_prenom', 'nom', 'prenom', 'nomprenom'] },
      { label: 'Formation', keys: ['formation', 'nom_formation'] },
      { label: "Date d'inscription", keys: [] },
      { label: 'Téléphone', keys: ['telephone', 'tel', 'numéro', 'numero'] },
      { label: 'Statut', keys: [] }
    ];
    const colWidths = [130, 100, 90, 100, 80];
    const rowHeight = 30;
    const startX = 50;

    // En-tête du tableau
    let x = startX;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#3498db');
    colonnes.forEach((col, idx) => {
      doc.rect(x, y, colWidths[idx], rowHeight).fill('#3498db');
      doc.fillColor('#fff').text(col.label, x + 5, y + 9, { width: colWidths[idx] - 10 });
      x += colWidths[idx];
    });
    y += rowHeight;

    // Lignes du tableau
    inscrits.forEach((etudiant, index) => {
      x = startX;
      doc.font('Helvetica').fontSize(10);
      colonnes.forEach((col, idx) => {
        // Alternance de couleur de fond
        doc.rect(x, y, colWidths[idx], rowHeight).fill(index % 2 === 0 ? '#ecf0f1' : '#ffffff');
        doc.fillColor('#000');

        let valeur = '—';
        if (col.label === "Date d'inscription") {
          valeur = etudiant.createdAt ? new Date(etudiant.createdAt).toLocaleDateString() : '—';
        } else if (col.label === 'Statut') {
          valeur = etudiant.statut || 'En attente';
        } else {
          for (const k of col.keys) {
            if (etudiant.donnees && etudiant.donnees[k]) {
              valeur = etudiant.donnees[k];
              break;
            }
          }
        }

        // Centrage vertical (ajusté avec la taille de la police)
        doc.text(valeur, x + 5, y + 9, { width: colWidths[idx] - 10, height: rowHeight, align: 'left' });
        x += colWidths[idx];
      });

      y += rowHeight;
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
    });

    // Pied du document
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#888').text(`Total : ${inscrits.length} inscrit(s)`, { align: 'left' });
    doc.fontSize(10).fillColor('#888').text('Document généré automatiquement. Merci de vérifier les informations.', { align: 'center' });

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

    // Récupérer tous les champs dynamiques via Formulaire
    const formulaire = await Formulaire.findOne().sort({ createdAt: -1 }); // le plus récent
    const champs = formulaire?.champs || [];

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=fiche_etudiant.pdf');
    doc.pipe(res);

    // Titre
    doc.fontSize(20).fillColor('#3498db').text("Fiche d'inscription", { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).fillColor('#000');

    // Affichage dynamique des champs depuis etudiant.donnees
    champs.forEach(champ => {
      const cle = champ.key;
      const label = champ.label || cle;
      const valeur = etudiant.donnees?.[cle] ?? '—';
      doc.text(`${label} : ${valeur}`);
    });

    // Ajout du statut et date d’inscription
    doc.text(`Statut : ${etudiant.statut || 'En attente'}`);
    doc.text(`Date d'inscription : ${new Date(etudiant.createdAt).toLocaleDateString()}`);

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#888').text('Document généré automatiquement. Merci de vérifier les informations.', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error("Erreur PDF :", err);
    res.status(500).send("Erreur serveur lors de la génération du PDF.");
  }
});


// ✅ Confirmer un inscrit (statut = Confirmée via PATCH)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    const updated = await Etudiant.findByIdAndUpdate(id, { statut }, { new: true });

    if (!updated) return res.status(404).json({ message: "Inscription non trouvée" });

    res.json(updated);
  } catch (err) {
    console.error("Erreur de mise à jour du statut :", err);
    res.status(500).json({ message: "Erreur serveur" });
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
