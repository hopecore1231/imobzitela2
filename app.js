/**
 * app.js — NV Imóveis · Sistema de Faturas (Supabase Version)
 * CRUD completo no Supabase (PostgreSQL)
 */

const SUPABASE_URL = 'https://duuhuypxprwmvolexpnd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1dWh1eXB4cHJ3bXZvbGV4cG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzUyNDIsImV4cCI6MjA4NzcxMTI0Mn0.YrYkJ3LMvaIIaJ_-Jy7cKVzlLH1B4SS63SWxYKkABog';

// Inicializa o cliente do Supabase de forma segura.
// Se a lib do CDN ainda não carregou, tenta novamente depois.
let _supabase = null;

function getSupabaseClient() {
    if (_supabase) return _supabase;

    // Tenta várias formas de acessar a lib
    const lib = window.supabase || window.Supabase;
    if (!lib) {
        throw new Error('Biblioteca do Supabase não foi carregada. Verifique sua conexão com a internet.');
    }
    // supabase-js v2 UMD exporta createClient diretamente no objeto
    if (typeof lib.createClient === 'function') {
        _supabase = lib.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else if (typeof lib === 'function') {
        _supabase = lib(SUPABASE_URL, SUPABASE_KEY);
    } else {
        throw new Error('Formato inesperado da biblioteca Supabase. Verifique a versão do CDN.');
    }
    return _supabase;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function today() {
    return new Date().toISOString().split('T')[0];
}

// Converte as chaves do Javascript (camelCase) para as colunas do DB (snake_case)
function toDbFormat(data) {
    return {
        client_name: data.clientName || '',
        client_doc: data.clientDoc || '',
        client_email: data.clientEmail || '',
        address: data.address || '',
        address_number: data.addressNumber || '',
        address_complement: data.addressComplement || '',
        address_neighborhood: data.addressNeighborhood || '',
        address_city: data.addressCity || '',
        address_state: data.addressState || '',
        invoice_type: data.invoiceType || 'Aluguel',
        value: parseFloat(String(data.value).replace(',', '.')) || 0,
        additional_items: data.additionalItems || [],
        period_from: data.periodFrom || null,
        period_to: data.periodTo || null,
        due_date: data.dueDate || null,
        emission_date: data.emissionDate || today(),
        status: data.status || 'pendente',
        payment_method: data.paymentMethod || 'pix',
        notes: data.notes || '',
        is_custom_html: data.isCustomHtml || false,
        raw_html_template: data.rawHtmlTemplate || '',
        client_logo: data.clientLogo || '',

        company_name: data.companyName || '',
        company_email: data.companyEmail || '',
        company_creci: data.companyCreci || ''
    };
}

// Converte dados do DB (snake_case) de volta para o JS (camelCase)
function fromDbFormat(dbData) {
    if (!dbData) return null;
    return {
        id: dbData.id,
        createdAt: dbData.created_at,
        clientName: dbData.client_name,
        clientDoc: dbData.client_doc,
        clientEmail: dbData.client_email,
        address: dbData.address,
        addressNumber: dbData.address_number,
        addressComplement: dbData.address_complement,
        addressNeighborhood: dbData.address_neighborhood,
        addressCity: dbData.address_city,
        addressState: dbData.address_state,
        invoiceType: dbData.invoice_type,
        value: parseFloat(dbData.value),
        additionalItems: dbData.additional_items || [],
        periodFrom: dbData.period_from,
        periodTo: dbData.period_to,
        dueDate: dbData.due_date,
        emissionDate: dbData.emission_date,
        status: dbData.status,
        paymentMethod: dbData.payment_method,
        notes: dbData.notes,
        isCustomHtml: dbData.is_custom_html,
        rawHtmlTemplate: dbData.raw_html_template,
        clientLogo: dbData.client_logo,

        paidAt: dbData.paid_at,
        companyName: dbData.company_name || '',
        companyEmail: dbData.company_email || '',
        companyCreci: dbData.company_creci || ''
    };
}


// ─── CRUD ────────────────────────────────────────────────────────────────────

async function createInvoice(data) {
    const sb = getSupabaseClient();
    const dbInvoice = toDbFormat(data);
    const { data: result, error } = await sb
        .from('faturas')
        .insert([dbInvoice])
        .select()
        .single();

    if (error) {
        console.error('Erro ao criar fatura:', error);
        throw error;
    }
    return fromDbFormat(result);
}

async function getInvoice(id) {
    const sb = getSupabaseClient();
    const { data: result, error } = await sb
        .from('faturas')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.warn('Fatura não encontrada ou erro:', error.message);
        return null; // Pode retornar null se não achar
    }
    return fromDbFormat(result);
}

async function listInvoices() {
    const sb = getSupabaseClient();
    const { data: faturas, error } = await sb
        .from('faturas')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao listar faturas:', error);
        return [];
    }
    return faturas.map(fromDbFormat);
}

async function deleteInvoice(id) {
    const sb = getSupabaseClient();
    const { error } = await sb
        .from('faturas')
        .delete()
        .eq('id', id);
    if (error) {
        console.error('Erro ao excluir fatura:', error);
        throw error;
    }
}

async function updateStatus(id, status) {
    const sb = getSupabaseClient();
    const updatePayload = { status: status };
    if (status === 'paga') {
        updatePayload.paid_at = new Date().toISOString();
    } else {
        updatePayload.paid_at = null;
    }

    const { data: result, error } = await sb
        .from('faturas')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Erro ao atualizar status:', error);
        return null;
    }
    return fromDbFormat(result);
}

async function updateInvoice(id, data) {
    const sb = getSupabaseClient();
    const dbInvoice = toDbFormat(data);

    // Evita sobrescrever datas antigas com "today" vazias caso data seja parcial
    const partialUpdate = {};
    for (const [k, v] of Object.entries(dbInvoice)) {
        if (v !== undefined) {
            partialUpdate[k] = v;
        }
    }

    const { data: result, error } = await sb
        .from('faturas')
        .update(partialUpdate)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Erro ao atualizar fatura:', error);
        return null;
    }
    return fromDbFormat(result);
}

// ─── URL Helper ──────────────────────────────────────────────────────────────

function generateInvoiceURL(id) {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return `${base}fatura.html#id=${id}`;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_LABEL = { pendente: 'Pendente', paga: 'Paga', cancelada: 'Cancelada' };
const STATUS_COLOR = { pendente: '#e03e20', paga: '#1acc27', cancelada: '#999' };
const STATUS_BG = { pendente: '#fff2a4', paga: '#f6f6f6', cancelada: '#f0f0f0' };

// ─── Edge Function Invoker ───────────────────────────────────────────────────

async function invokeFunction(functionName, body) {
    const sb = getSupabaseClient();
    const { data, error } = await sb.functions.invoke(functionName, {
        body: body
    });
    if (error) {
        console.error(`Erro ao invocar ${functionName}:`, error);
        throw error;
    }
    return data;
}

// ─── Exports (acessíveis globalmente) ────────────────────────────────────────

window.NV = {
    createInvoice,
    getInvoice,
    listInvoices,
    deleteInvoice,
    updateStatus,
    updateInvoice,
    generateInvoiceURL,
    invokeFunction,
    formatCurrency,
    formatDate,
    STATUS_LABEL,
    STATUS_COLOR,
    STATUS_BG,
};

console.log('[app.js] NV carregado com sucesso. Supabase URL:', SUPABASE_URL);
