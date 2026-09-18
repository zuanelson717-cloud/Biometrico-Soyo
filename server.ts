import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();

    // Vite middleware for development or static serving for production
    if (process.env.NODE_ENV === 'development') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        // Resolve dist path relative to current working directory
        const distPath = path.resolve(process.cwd(), 'dist');
        console.log('Serving static files from:', distPath);
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(3000, '0.0.0.0', () => {
        console.log('Server running on port 3000');
    });
}

startServer();
