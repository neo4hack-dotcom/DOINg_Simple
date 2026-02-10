
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize db.json if not exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

app.get('/api/data', (req, res) => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            res.json(JSON.parse(data || '{}'));
        } else {
            res.json({});
        }
    } catch (err) {
        console.error("Read Error:", err);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/data', (req, res) => {
    try {
        const newData = req.body;
        // Ensure lastUpdated is set if not present (though client should set it)
        if (!newData.lastUpdated) {
            newData.lastUpdated = Date.now();
        }
        
        fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2));
        res.json({ success: true, timestamp: newData.lastUpdated });
    } catch (err) {
        console.error("Write Error:", err);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

app.listen(PORT, () => {
    console.log(`Synchronization Server running on http://localhost:${PORT}`);
    console.log(`Database file: ${DB_FILE}`);
});
