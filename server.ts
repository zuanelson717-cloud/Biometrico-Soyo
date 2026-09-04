import express from 'express';
import { Dropbox } from 'dropbox';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';

async function startServer() {
    const app = express();
    const upload = multer({ storage: multer.memoryStorage() });

    const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN || '' });

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    app.use((req, res, next) => {
        console.log(`[${req.method}] ${req.path}`);
        next();
    });

    // API routes
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
            await dbx.filesUpload({
                path: path,
                contents: file.buffer,
                mode: { '.tag': 'overwrite' }
            });

            const link = await dbx.filesGetTemporaryLink({ path: path });
            console.log('Upload successful, URL:', link.result.link);
            res.json({ url: link.result.link, path: path });
        } catch (error) {
            console.error('Dropbox upload error:', error);
            res.status(500).json({ error: 'Failed to upload photo' });
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
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api/')) {
                return next();
            }
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(3000, '0.0.0.0', () => {
        console.log('Server running on port 3000');
    });
}

startServer();
