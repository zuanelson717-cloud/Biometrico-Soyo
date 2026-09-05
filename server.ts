import express from 'express';
import { Dropbox } from 'dropbox';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';
import cors from 'cors';

async function startServer() {
    const app = express();
    const upload = multer({ storage: multer.memoryStorage() });

    // Initialize Dropbox client lazily inside the route handler
    const getDbx = () => {
        const token = process.env.DROPBOX_ACCESS_TOKEN;
        console.log(`[DIAGNOSTIC] DROPBOX_ACCESS_TOKEN prefix: ${token ? token.substring(0, 4) + '...' : 'UNDEFINED/EMPTY'}`);
        return new Dropbox({ accessToken: token || '' });
    };

    // Extreme CORS
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Handle OPTIONS pre-flight requests explicitly
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
        console.log('Body:', req.body);
        console.log('File:', req.file ? req.file.originalname : 'No file');

        if (!process.env.DROPBOX_ACCESS_TOKEN) {
            console.error('DROPBOX_ACCESS_TOKEN missing');
            return res.status(500).json({ error: 'DROPBOX_ACCESS_TOKEN not configured' });
        }
        try {
            const { employeeId } = req.body;
            const file = req.file;

            if (!employeeId || !file) {
                console.error('Missing employeeId or file', { employeeId, file: !!file });
                return res.status(400).json({ error: 'Missing employeeId or file' });
            }

            const path = `/FotosFuncionarios/${employeeId}.jpeg`;
            
            console.log('Uploading to Dropbox:', path);
            const dbx = getDbx();
            await dbx.filesUpload({
                path: path,
                contents: file.buffer,
                mode: { '.tag': 'overwrite' }
            });

            const link = await dbx.filesGetTemporaryLink({ path: path });
            console.log('Upload successful, URL:', link.result.link);
            res.json({ url: link.result.link, path: path });
        } catch (error: any) {
            console.error('Dropbox upload error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            // Return the actual error message from the Dropbox SDK/API if available
            const errorMessage = error.error?.error_summary || error.message || String(error);
            res.status(500).json({ 
                error: 'Failed to upload photo', 
                message: errorMessage,
                details: error.error ? JSON.stringify(error.error) : 'No additional details'
            });
        }
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
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(3000, '0.0.0.0', () => {
        console.log('Server running on port 3000');
        console.log('Dropbox Token:', process.env.DROPBOX_ACCESS_TOKEN ? 'CONFIGURADO' : 'NÃO CONFIGURADO');
    });
}

startServer();
