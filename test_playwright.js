const { chromium } = require('playwright');

(async () => {
    console.log("Starting browser...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    let nvDefined = false;

    // Capture console logs
    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}:`, msg.text());
        if (msg.text().includes('NV is not defined')) {
            console.error("!!! DETECTED NV is not defined error !!!");
        }
    });

    page.on('pageerror', err => {
        console.error(`[BROWSER UNCAUGHT EXCEPTION]:`, err.toString());
    });

    // Intercept requests to see if app.js is failing to load
    page.on('response', response => {
        if (response.url().includes('app.js') || response.url().includes('supabase')) {
            console.log(`[NETWORK] ${response.status()} ${response.url()}`);
        }
    });

    console.log("Navigating to http://localhost:3456/admin.html...");
    await page.goto('http://localhost:3456/admin.html', { waitUntil: 'networkidle' });

    console.log("Page loaded. Checking for window.NV...");

    try {
        const isNVDefined = await page.evaluate(() => {
            return typeof window.NV !== 'undefined';
        });
        console.log(`Is window.NV defined? ${isNVDefined}`);
    } catch (e) {
        console.log(`Error checking window.NV: ${e}`);
    }

    // Try to trigger the invoice creation visually
    console.log("Trying to click 'Gerar Fatura' button...");
    try {
        await page.click('button:has-text("Gerar Fatura")');
        // wait a bit for any errors
        await page.waitForTimeout(2000);
    } catch (e) {
        console.error("Failed to click 'Gerar Fatura':", e);
    }

    console.log("Closing browser.");
    await browser.close();
})();
