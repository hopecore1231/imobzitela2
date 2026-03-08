/**
 * test_prosperidade.js — Encontrar limite máximo de valor
 * Testa valores crescentes para achar o teto da API
 */

const https = require('https');

const SECRET_KEY = '2f94acb4-6a39-43fe-906f-cf7515d012b9';
const BASE_URL = 'gateway.prosperidadepayments.com.br';
const API_PATH = '/api/v1';

function apiRequest(body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': SECRET_KEY,
            'Content-Length': Buffer.byteLength(payload)
        };

        const req = https.request({
            hostname: BASE_URL,
            path: `${API_PATH}/transaction.purchase`,
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

async function testarValor(centavos) {
    const reais = (centavos / 100).toFixed(2);
    const payload = {
        name: 'Maria Silva',
        email: 'maria@email.com',
        cpf: '52998224725',
        phone: '11999887766',
        paymentMethod: 'PIX',
        amount: centavos,
        traceable: false,
        items: [{ unitPrice: centavos, title: 'Teste', quantity: 1, tangible: false }]
    };

    const r = await apiRequest(payload);
    const ok = r.status === 200 || r.status === 201;
    console.log(`R$ ${reais.padStart(10)} (${String(centavos).padStart(8)} centavos) => ${ok ? 'OK' : 'FALHA (' + r.status + ')'}`);

    if (ok && r.data?.pixCode) {
        console.log(`   PIX: ${r.data.pixCode.substring(0, 80)}...`);
    }

    return ok;
}

async function main() {
    console.log('=== BUSCANDO LIMITE DE VALOR DA API ===\n');

    // Testar valores crescentes: 100, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 400000, 500000
    const valores = [
        10000,    // R$100
        50000,    // R$500
        100000,   // R$1.000
        200000,   // R$2.000
        300000,   // R$3.000
        400000,   // R$4.000
        450000,   // R$4.500
        500000,   // R$5.000
    ];

    let ultimoOK = 0;
    let primeiroFalha = 0;

    for (const v of valores) {
        const ok = await testarValor(v);
        if (ok) {
            ultimoOK = v;
        } else {
            primeiroFalha = v;
            break;
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    if (primeiroFalha > 0 && ultimoOK > 0) {
        console.log(`\n--- Refinando entre R$ ${(ultimoOK / 100).toFixed(2)} e R$ ${(primeiroFalha / 100).toFixed(2)} ---`);

        // Busca binaria
        let low = ultimoOK;
        let high = primeiroFalha;

        while (high - low > 10000) { // precisao de R$100
            const mid = Math.round((low + high) / 2);
            await new Promise(r => setTimeout(r, 1500));
            const ok = await testarValor(mid);
            if (ok) low = mid;
            else high = mid;
        }

        console.log(`\n=== RESULTADO ===`);
        console.log(`Limite maximo encontrado: aproximadamente R$ ${(low / 100).toFixed(2)}`);
        console.log(`Primeiro valor que falha: R$ ${(high / 100).toFixed(2)}`);
    } else if (primeiroFalha === 0) {
        console.log('\nTodos os valores testados funcionaram!');
    } else {
        console.log(`\nErro: nenhum valor funcionou`);
    }

    console.log('\n=== FIM ===');
}

main();
