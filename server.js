
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000; // Port standard web
const DB_FILE = path.join(__dirname, 'db.json');

// Middleware pour parser le JSON (augmenté à 50mb pour les images)
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// 1. Servir l'application React (les fichiers statiques)
// Cela permet d'accéder à l'app via http://localhost:3000
app.use(express.static(path.join(__dirname, 'dist')));

// Initialisation du fichier de données s'il n'existe pas
if (!fs.existsSync(DB_FILE)) {
    const initialData = {
        users: [{ 
            id: 'u1', uid: 'Admin', firstName: 'System', lastName: 'Admin', 
            functionTitle: 'Administrator', role: 'Admin', password: 'admin' 
        }],
        teams: [],
        meetings: [],
        weeklyReports: [],
        notes: [],
        lastUpdated: Date.now()
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData));
}

// 2. Endpoint "SMART READ" : Lire le fichier
app.get('/api/data', (req, res) => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({});
        }
    } catch (err) {
        console.error("Erreur lecture fichier:", err);
        res.status(500).json({ error: 'Erreur lecture données' });
    }
});

// 3. Endpoint "SMART WRITE" : Écrire dans le fichier
app.post('/api/data', (req, res) => {
    try {
        const newData = req.body;
        // On s'assure qu'il y a un timestamp
        newData.lastUpdated = Date.now();
        
        // Écriture atomique (synchronous pour éviter la corruption)
        fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2));
        
        console.log(`[Sauvegarde] Données mises à jour à ${new Date().toLocaleTimeString()}`);
        res.json({ success: true, timestamp: newData.lastUpdated });
    } catch (err) {
        console.error("Erreur écriture fichier:", err);
        res.status(500).json({ error: 'Erreur sauvegarde données' });
    }
});

// Route par défaut pour React Router (permet de recharger la page sur /dashboard par exemple)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
    🚀 APPLICATIONS LANCÉE !
    -------------------------------------
    L'application est accessible ici : http://localhost:${PORT}
    Les données sont stockées dans   : ${DB_FILE}
    -------------------------------------
    `);
});
