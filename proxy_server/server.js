const express = require('express');
const http = require('http');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const PORT = 3000;
const OLLAMA_API_BASE_URL = 'http://localhost:11434';
const extensionOrigin = 'chrome-extension://gkpfpdekobmonacdgjgbfehilnloaacm';

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || origin === extensionOrigin) {
            callback(null, true);
        } else {
            console.warn(`CORS: Request from origin '${origin}' blocked. Expected '${extensionOrigin}'`);
            callback(new Error('Not allowed by CORS'));
        }
    }
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => {
            req.rawBody = data;
            try {
                req.body = JSON.parse(data);
            } catch (e) {
                // ignore
            }
            next();
        });
    } else {
        next();
    }
});

app.all('/proxy/*', (req, res) => {
    const originalPath = req.params[0];
    const ollamaPath = '/' + originalPath;
    const targetUrlString = OLLAMA_API_BASE_URL + ollamaPath;
    const ALLOWED_OLLAMA_PATHS = ['/api/tags', '/api/chat', '/api/generate'];

    console.log(`Proxying request: ${req.method} ${req.originalUrl} -> ${targetUrlString}`);

    if (!ALLOWED_OLLAMA_PATHS.some(allowedPath => ollamaPath.startsWith(allowedPath))) {
        console.warn(`Forbidden: Path '${ollamaPath}' not allowed.`);
        return res.status(403).send('Forbidden: Path not allowed.');
    }

    try {
        const targetUrl = new URL(targetUrlString);

        if (targetUrl.hostname !== 'localhost' && targetUrl.hostname !== '127.0.0.1') {
            console.warn(`Forbidden: Host '${targetUrl.hostname}' not allowed.`);
            return res.status(403).send('Forbidden: Host not allowed.');
        }

        // Construct headers for the outgoing request to Ollama
        const ollamaRequestHeaders = {
            'host': targetUrl.hostname, // Essential: Must match the target
            'accept': req.headers['accept'] || '*/*', // Pass through accept or default
            'user-agent': req.headers['user-agent'] || 'OllamaBroProxy/1.0', // Pass through user-agent or set a custom one
            // We will set Content-Type and Content-Length specifically when sending the body
        };

        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: ollamaRequestHeaders, // Use our more controlled set of headers
        };

        const proxyReq = http.request(options, (proxyRes) => {
            console.log(`Proxy to Ollama: Received response status: ${proxyRes.statusCode}`);
            console.log('Proxy to Ollama: Received response headers:', JSON.stringify(proxyRes.headers, null, 2));
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
            proxyRes.on('end', () => console.log('Proxy to Ollama: Response stream from Ollama ended.'));
            proxyRes.on('error', (err) => console.error('Proxy to Ollama: Error on response stream from Ollama:', err));
        });

        const OLLAMA_REQUEST_TIMEOUT = 60000;
        proxyReq.setTimeout(OLLAMA_REQUEST_TIMEOUT, () => {
            console.error(`Proxy to Ollama: Request timed out after ${OLLAMA_REQUEST_TIMEOUT / 1000}s. Aborting.`);
            proxyReq.abort();
            if (!res.headersSent) res.status(504).send('Gateway Timeout: Ollama did not respond.');
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy to Ollama: Request error:', err);
            if (!res.headersSent) res.status(502).send('Bad Gateway: Proxy request to Ollama failed.');
        });

        proxyReq.on('socket', (socket) => {
            console.log('Proxy to Ollama: Socket assigned.');
            socket.on('connect', () => console.log('Proxy to Ollama: Socket connected.'));
            socket.on('timeout', () => console.error('Proxy to Ollama: Socket timeout event.'));
        });

        if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.rawBody) {
            console.log('Proxy to Ollama: Sending request body to Ollama:', req.rawBody);
            
            // Set Content-Type and Content-Length specifically for the outgoing request
            proxyReq.setHeader('Content-Type', req.headers['content-type'] || 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(req.rawBody));
            
            proxyReq.write(req.rawBody);
            proxyReq.end();
        } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            console.warn('Proxy to Ollama: POST/PUT/PATCH request, but req.rawBody is not set. Attempting to pipe.');
            // This path should ideally not be hit if rawBody middleware works.
            // If piping, Node will set Content-Length and Content-Type if possible, but it can be less reliable.
            req.pipe(proxyReq, { end: true });
        } else {
            proxyReq.end();
        }

    } catch (error) {
        console.error('Error in proxy logic:', error);
        if (!res.headersSent) res.status(500).send('Internal proxy error.');
    }
});

app.listen(PORT, () => {
    console.log(`OllamaBro CORS Proxy server running on http://localhost:${PORT}`);
    console.log(`Allowing CORS origin: ${extensionOrigin}`);
    console.log(`Proxying requests from /proxy/* to ${OLLAMA_API_BASE_URL}`);
});