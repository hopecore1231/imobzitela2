/**
 * test_veno.js
 * Testa a API Veno Payments para gerar cobranças PIX, testando diferentes valores.
 */

const https = require('https');

// Credenciais e Configuração
const TOKEN = 'veno_live_33d4b08f4dbf9da74c990859805a4860d296b96e13a881eb';
const BASE_URL = 'beta.venopayments.com';
const API_PATH = '/api/v1/pix';

function apiRequest(body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Length': Buffer.byteLength(payload)
        };

        const req = https.request({
            hostname: BASE_URL,
            path: API_PATH,
            method: 'POST',
            headers
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function generateIdempotencia(valorCentavos) {
    return `teste-venv-${Date.now()}-${valorCentavos}`;
}

async function testarValor(centavos) {
    const reais = (centavos / 100).toFixed(2);
    const payload = {
        amount: centavos,
        external_id: generateIdempotencia(centavos),
        description: `Teste Veno Payments R$ ${reais}`,
        payer: {
            name: "João Silva Teste",
            email: "joao.teste@email.com",
            document: "52998224725"
        }
    };

    console.log(`\n--- Testando R$ ${reais} (${centavos} centavos) ---`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));

    try {
        const r = await apiRequest(payload);
        const ok = r.status === 200 || r.status === 201;

        console.log(`Status: ${r.status}`);

        if (ok) {
            console.log(`>>> SUCESSO! <<<`);
            console.log(`ID: ${r.data.id}`);
            if (r.data.pix_copy_paste) {
                console.log(`PIX: ${r.data.pix_copy_paste.substring(0, 50)}...`);
            }
            if (r.data.qr_code) {
                console.log(`QR_CODE (primeiros 60 chars): ${r.data.qr_code.substring(0, 60)}`);
            }
        } else {
            console.log(`>>> FALHA! <<<`);
            console.log(`Resposta:`, JSON.stringify(r.data, null, 2));
        }
        return ok;
    } catch (err) {
        console.error(`Erro de rede:`, err.message);
        return false;
    }
}

async function main() {
    console.log('=== TESTE API VENO PAYMENTS ===\n');

    // Testar os valores solicitados. A API diz permitir até R$1.000.000 (100000000 centavos)
    // na documentação, mas o usuário disse que essa suporta até 3k (R$3000), então vamos testar
    // R$ 100, R$ 2.900, R$ 3.000, R$ 3.100, R$ 4.500 para encontrar o limite real.
    const valoresTestar = [
        10000,   // R$100
        290000,  // R$2.900
        300000,  // R$3.000
        310000,  // R$3.100
        450000   // R$4.500
    ];

    for (const v of valoresTestar) {
        await testarValor(v);
        // Esperar um pouco entre requests
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n=== FIM DOS TESTES ===');
}

main();
