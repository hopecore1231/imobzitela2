/**
 * server.js — Servidor local que serve os arquivos estáticos
 * e inclui endpoint /api/create-pix para gerar PIX via BlackPayments.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3456;

// MIME types para servir arquivos estáticos
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
};

// ─── Veno Payments Config ────────────────────────────────────────────────────
const VENO_TOKEN = 'veno_live_33d4b08f4dbf9da74c990859805a4860d296b96e13a881eb';
const qrcode = require('qrcode');

// ─── Helper: Chamar Veno API ─────────────────────────────────────────────────
function callVenoPayments(amountCentavos, customerName, customerEmail, customerDoc) {
    return new Promise((resolve, reject) => {
        const docClean = (customerDoc || '').replace(/\D/g, '');
        const externalId = `pix-veno-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const payload = JSON.stringify({
            amount: amountCentavos,
            external_id: externalId,
            description: 'Fatura Imobiliária',
            payer: {
                name: customerName || 'Cliente',
                email: customerEmail || 'cliente@fatura.com',
                document: docClean || '00000000000'
            }
        });

        const options = {
            hostname: 'beta.venopayments.com',
            path: '/api/v1/pix',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${VENO_TOKEN}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        console.log('[create-pix] Chamando Veno Payments, amount:', amountCentavos, 'centavos');

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                console.log('[create-pix] Veno response:', res.statusCode, data.substring(0, 300));
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400 || parsed.status === 'false') {
                        resolve({
                            _error: true,
                            error: parsed.message || 'Erro na Veno Payments',
                            _status: res.statusCode
                        });
                    } else {
                        // Gerar QR code nativamente em base64
                        let qrBase64 = '';
                        if (parsed.pix_copy_paste) {
                            try {
                                qrBase64 = await qrcode.toDataURL(parsed.pix_copy_paste);
                            } catch (err) {
                                console.error('Erro ao converter qrcode', err);
                            }
                        }

                        resolve({
                            success: true,
                            qrCode: qrBase64,
                            copyPaste: parsed.pix_copy_paste,
                            txid: parsed.txid || parsed.id,
                            raw: parsed
                        });
                    }
                } catch (e) {
                    reject(new Error('Resposta inválida da Veno Payments: ' + data.substring(0, 200)));
                }
            });
        });

        req.on('error', (err) => {
            console.error('[create-pix] Network error:', err.message);
            reject(err);
        });

        req.write(payload);
        req.end();
    });
}

// ─── Helper: Ler body do request ─────────────────────────────────────────────
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

// ─── Servidor HTTP ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {

    // ── API: Criar PIX (chama Veno Payments) ─────────────────────────────────
    if (req.url === '/api/create-pix' && req.method === 'POST') {
        try {
            const body = await readBody(req);
            const { amount, customerName, customerDoc, customerEmail } = JSON.parse(body);

            // amount vem em centavos do frontend, a Veno também usa centavos
            const amountCentavos = parseInt(amount, 10);

            if (!amountCentavos || amountCentavos < 100) { // Veno exige min 100 centavos
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Valor mínimo: R$ 1,00' }));
                return;
            }

            const data = await callVenoPayments(amountCentavos, customerName, customerEmail, customerDoc);

            if (data._error) {
                const status = data._status || 500;
                delete data._error;
                delete data._status;
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            }
        } catch (err) {
            console.error('[create-pix] Erro interno:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || 'Erro interno' }));
        }
        return;
    }

    // ── Arquivos estáticos ───────────────────────────────────────────────────
    let urlPath = req.url.split('?')[0].split('#')[0];
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(__dirname, urlPath);
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 - Não encontrado</h1>');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const stream = fs.createReadStream(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`   📄 Arquivos estáticos servidos do diretório: ${__dirname}`);
    console.log(`   💰 Endpoint PIX: POST /api/create-pix → BlackPayments`);
});
