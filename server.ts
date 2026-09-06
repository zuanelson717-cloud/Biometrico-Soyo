import express from 'express';
import { Dropbox, DropboxAuth } from 'dropbox';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase for server
let db: any;
try {
    const appFirebase = initializeApp(firebaseConfig);
    db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);
    console.log('[SERVER] Firebase initialized successfully with database:', firebaseConfig.firestoreDatabaseId);
} catch (error) {
    console.error('[SERVER] Failed to initialize Firebase:', error);
}

async function startServer() {
    const app = express();
    const upload = multer({ storage: multer.memoryStorage() });

    // Dropbox OAuth helper
    const getDropboxAuth = () => {
        return new DropboxAuth({
            clientId: process.env.DROPBOX_APP_KEY,
            clientSecret: process.env.DROPBOX_APP_SECRET,
        });
    };

    // Helper to get or refresh DBX client
    const getDbx = async () => {
        if (!db) throw new Error('Firebase DB not initialized');
        const auth = getDropboxAuth();
        const docRef = doc(db, 'dropbox_config', 'settings');
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            throw new Error('Dropbox not configured. Please authorize first.');
        }
        
        const { refresh_token } = docSnap.data();
        auth.setRefreshToken(refresh_token);
        
        // This will automatically handle token refresh if expired
        const response = await auth.getAccessTokenFromRefreshToken();
        auth.setAccessToken(response.result.access_token);
        
        return new Dropbox({ auth });
    };
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Handle OPTIONS pre-flight requests explicitly
    app.options('*', cors());

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Dropbox OAuth Routes
    app.get('/api/dropbox/auth', async (req, res) => {
        const auth = getDropboxAuth();
        const authUrl = await auth.getAuthenticationUrl(
            'https://biometrico-tgqi.onrender.com/api/dropbox/callback',
            null,
            'code',
            'offline',
            undefined,
            'none',
            false
        );
        res.redirect(authUrl as string);
    });

    app.get('/api/dropbox/callback', async (req, res) => {
        try {
            const { code } = req.query;
            const auth = getDropboxAuth();
            const tokenResponse = await auth.getAccessTokenFromCode(
                'https://biometrico-tgqi.onrender.com/api/dropbox/callback',
                code as string
            );
            
            await setDoc(doc(db, 'dropbox_config', 'settings'), {
                refresh_token: tokenResponse.result.refresh_token
            });
            
            res.send('Dropbox configurado com sucesso! Pode fechar esta janela.');
        } catch (error: any) {
            console.error('[DROPBOX CALLBACK ERROR]', error);
            res.status(500).send(`Erro na configuração do Dropbox: ${error.message || String(error)}. Por favor, tente novamente.`);
        }
    });

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
        console.log('Body:', req.body);
        console.log('File:', req.file ? req.file.originalname : 'No file');

        try {
            const { employeeId } = req.body;
            const file = req.file;

            if (!employeeId || !file) {
                console.error('Missing employeeId or file', { employeeId, file: !!file });
                return res.status(400).json({ error: 'Missing employeeId or file' });
            }

            const path = `/FotosFuncionarios/${employeeId}.jpeg`;
            
            console.log('Uploading to Dropbox:', path);
            const dbx = await getDbx();
            await dbx.filesUpload({
                path: path,
                contents: file.buffer,
                mode: { '.tag': 'overwrite' }
            });

            const link = await dbx.filesGetTemporaryLink({ path: path });
            console.log('Upload successful, URL:', link.result.link);
            res.json({ url: link.result.link, path: path });
        } catch (error: any) {
            console.error('[UPLOAD ERROR]', error);
            // Always return JSON, even on error
            res.status(500).json({ 
                error: 'Failed to upload photo', 
                message: error.message || 'Unknown error'
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
        // SPA fallback: Serve index.html for all non-API requests
        app.get('*', (req, res) => {
            console.log(`[SPA FALLBACK] Request path: ${req.path}`);
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(3000, '0.0.0.0', () => {
        console.log('Server running on port 3000');
        console.log('Dropbox Token:', process.env.DROPBOX_ACCESS_TOKEN ? 'CONFIGURADO' : 'NÃO CONFIGURADO');
    });
}

startServer();
