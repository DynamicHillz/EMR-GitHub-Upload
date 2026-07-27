const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const certPath = process.env.TLS_CERT_PATH;
const keyPath = process.env.TLS_KEY_PATH;

if (certPath && keyPath) {
    // Workstations reach this over the clinic LAN, not localhost, so the
    // service worker (registerSW in main.tsx) needs a real "secure context"
    // to register at all. The `serve` CLI (v14) has no --ssl-cert/--ssl-key
    // flags, so HTTPS is served directly here via serve-handler (serve's
    // own dependency) instead.
    const fs = require('fs');
    const https = require('https');
    const serveHandler = require('serve-handler');

    console.log('Starting frontend over HTTPS using serve-handler...');

    const server = https.createServer(
        { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
        (request, response) => serveHandler(request, response, { public: path.join(__dirname, 'dist/frontend'), rewrites: [{ source: '**', destination: '/index.html' }] })
    );

    server.listen(5173, '0.0.0.0', () => {
        console.log('Frontend listening on https://0.0.0.0:5173');
    });

    process.on('SIGTERM', () => server.close(() => process.exit(0)));
    process.on('SIGINT', () => server.close(() => process.exit(0)));
} else {
    const { spawn } = require('child_process');

    console.log('Starting frontend using npx serve...');

    // We use spawn so it keeps running in the background and PM2 can track this node process
    const serve = spawn('node', ['node_modules/serve/build/main.js', '-s', 'dist/frontend', '-l', 'tcp://0.0.0.0:5173'], {
        stdio: 'inherit',
        shell: false
    });

    serve.on('close', (code) => {
        console.log(`serve process exited with code ${code}`);
        process.exit(code);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down serve...');
        serve.kill('SIGTERM');
    });

    process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down serve...');
        serve.kill('SIGINT');
    });
}
