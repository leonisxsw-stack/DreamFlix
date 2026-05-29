const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configurer CORS pour autoriser l'application front-end (DreamFlix) à faire des requêtes au serveur local
app.use(cors());

// Dossier où seront stockés tous tes fichiers
const storageFolder = path.join(__dirname, 'mon_stockage');

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(storageFolder)) {
    fs.mkdirSync(storageFolder, { recursive: true });
}

// Configurer Multer pour sauvegarder les fichiers sans limite de taille
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Enregistrer dans notre dossier local
        cb(null, storageFolder);
    },
    filename: function (req, file, cb) {
        // Nettoyer le nom de fichier et ajouter un timestamp pour éviter les doublons
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, name + '_' + uniqueSuffix + ext);
    }
});

// Initialiser multer avec aucune limite de taille définie
const upload = multer({ 
    storage: storage,
    limits: { fileSize: Infinity } // AUCUNE LIMITE DE TAILLE !
});

// Route pour l'upload d'un fichier (vidéo ou image)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier envoyé' });
    }

    console.log(`✅ Fichier reçu : ${req.file.filename} (${(req.file.size / (1024 * 1024)).toFixed(2)} MB)`);

    // Renvoie l'URL locale à ton application DreamFlix
    const fileUrl = `http://localhost:${PORT}/media/${req.file.filename}`;
    
    res.json({
        success: true,
        url: fileUrl,
        filename: req.file.filename
    });
});

// Servir le dossier 'mon_stockage' publiquement sur la route '/media'
app.use('/media', express.static(storageFolder));

// Lancer le serveur
app.listen(PORT, () => {
    console.log('\n=============================================');
    console.log(`🎬 DREAMFLIX SERVEUR DE STOCKAGE DEMARRE !`);
    console.log(`🚀 Ton serveur personnel écoute sur http://localhost:${PORT}`);
    console.log(`📂 Les gros films seront enregistrés dans : ${storageFolder}`);
    console.log('=============================================\n');
});
