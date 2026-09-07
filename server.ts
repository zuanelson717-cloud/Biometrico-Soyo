import express from 'express';
import { google } from 'googleapis';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase for server
let db: any;
try {
    const appFirebase = initializeApp(firebaseConfig);
    db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);
    console.log('[SERVER] Firebase initialized successfully');
} catch (error) {
    console.error('[SERVER] Failed to initialize Firebase:', error);
}

async function startServer() {
    const app = express();
    const upload = multer({ storage: multer.memoryStorage() });

    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    app.options('*', cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Global request logger
    app.use((req, res, next) => {
        console.log(`[REQUEST RECEIVED] ${req.method} ${req.path}`);
        next();
    });

    // API routes FIRST
    app.get('/api/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
        console.log('--- RECEIVED UPLOAD REQUEST ---');
        
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const accessToken = authHeader.split('Bearer ')[1];
        const authClient = new google.auth.OAuth2();
        authClient.setCredentials({ access_token: accessToken });

        try {
            const { employeeId } = req.body;
            const file = req.file;

            if (!employeeId || !file) {
                return res.status(400).json({ error: 'Missing employeeId or file' });
            }

            const drive = google.drive({ version: 'v3', auth: authClient });

            // Create file in Drive
            const fileMetadata = {
                name: `${employeeId}.jpeg`,
                parents: [] // Optionally specify folder ID here
            };
            const media = {
                mimeType: 'image/jpeg',
                body: Buffer.from(file.buffer)
            };

            const driveFile = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, webViewLink'
            });

            console.log('Upload successful, file ID:', driveFile.data.id);
            res.json({ url: driveFile.data.webViewLink, fileId: driveFile.data.id });
        } catch (error: any) {
            console.error('[UPLOAD ERROR - DETAILED]:', error);
            res.status(500).json({ 
                error: 'Failed to upload photo', 
                message: error.message || 'Unknown error',
                stack: error.stack
            });
        }
    });

    // Global error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('[GLOBAL ERROR HANDLER] Caught error:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    });

    // Vite middleware for development or static serving for production
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            console.log(`[SPA FALLBACK] Request path: ${req.path}`);
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(3000, '0.0.0.0', () => {
        console.log('Server running on port 3000');
    });
}

startServer();
