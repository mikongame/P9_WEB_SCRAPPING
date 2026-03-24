import fs from 'fs';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const BASE = 'https://www.pccomponentes.com/';
const MAX_PAGES_PER_SEARCH = 5;

const SEARCH_TERMS = { 
  portatiles: ['portatiles', 'laptop', 'macbook'],
  smartphones: ['smartphone', 'moviles', 'iphone'],
  cajas: ['fractal design'],
  placas: ['asus', 'msi', 'gigabyte'].flatMap(m => `placa ${m}`),
  fuentes_alimentacion: ['corsair', 'asus'].flatMap(m => `alimentacion ${m} 850w`),
  refrigeracion: ['corsair', 'asus', 'forgeon'].flatMap(m => `refrigeracion ${m} 360mm`)
};

const SELECTORS = {
  SEARCH_INPUTS: [
    'input[type="search"]', 'input[placeholder*="Buscar"]', 'input[data-testid="search"]', '#search'
  ],
  PRODUCT_CARD: '.product-card, .c-product-card, [data-testid="product-card"], .sc-eIrltS',
  NAME_SELECTORS: ['.product-card__title', '.c-product-card__title', 'h3', 'a[title]'],
  PRICE_SELECTORS: ['[data-e2e="price-card"]', '.sc-ldFCYb', '.product-card__price', '.c-product-card__price-actual'],
  NEXT_BUTTONS: [
    'button[aria-label="Página siguiente"]',
    'button[data-testid="icon_right"]',
    '.paginator-module_iconButton__qFRLX',
    '.c-pagination__next:not(.is-disabled)', 
    'a[rel="next"]:not(.disabled)',
     '.pagination .next'
  ],
  VERIFICATION: ['#challenge-form', '.cf-turnstile', 'iframe[src*="cloudflare"]']
};

const randomSleep = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));

async function acceptCookieAndModals(page) {
  const candidates = [
    '#cookies-accept-all', '#onetrust-accept-btn-handler', '#didomi-notice-agree-button',
    'button[aria-label="Aceptar"]', 'button[data-qa="accept-cookies"]'
  ];
  for (const sel of candidates) {
    try { 
      await page.click(sel, { timeout: 1500 }); 
      await randomSleep(200, 400);
      break; 
    } catch {}
  }
}

async function handleCheckIfBlocked(page) {
  for (const sel of SELECTORS.VERIFICATION) {
    if (await page.$(sel)) {
      console.log('⚠️ [BLOQUEO] Control de humano detectado. Resuélvelo manualmente.');
      await page.waitForFunction((s) => !document.querySelector(s), { timeout: 60000 }, sel);
      console.log('✅ Continuando...');
      return true;
    }
  }
  return false;
}

async function openHome(page) {
  console.log('🏠 Cargando Home...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await randomSleep(800, 1400);
  await acceptCookieAndModals(page);
}

async function doSearch(page, term) {
  console.log(`🔍 Buscando: "${term}"`);
  let found = false;
  for (const sel of SELECTORS.SEARCH_INPUTS) {
    try {
      await page.waitForSelector(sel, { timeout: 10000 });
      await page.click(sel, { clickCount: 3 });
      
      const charDelay = Math.floor(Math.random() * 40) + 30;
      await page.type(sel, term, { delay: charDelay });
      await page.keyboard.press('Enter');
      found = true;
      break;
    } catch {
      await handleCheckIfBlocked(page);
    }
  }
  if (!found) throw new Error('Caja de búsqueda no encontrada.');
  await randomSleep(500, 1000);
  await acceptCookieAndModals(page);
}

async function loadAllProductsOnPage(page) {
  let lastCount = 0;
  for (let i = 0; i < 4; i++) {
    const count = await page.evaluate((sel) => document.querySelectorAll(sel).length, SELECTORS.PRODUCT_CARD);
    if (count > lastCount) {
      lastCount = count;
      await page.evaluate(() => window.scrollBy(0, 1200));
      await randomSleep(200, 400);
    } else break;
  }
}

async function extractProducts(page) {
  return await page.evaluate((sel_card, sel_name, sel_price) => {
    const cards = document.querySelectorAll(sel_card);
    return [...cards].map((card, index) => {
      try {
        let name = '';
        for (const s of sel_name) {
          const el = card.querySelector(s);
          if (el) name = el.textContent?.trim() || el.getAttribute('title')?.trim() || '';
          if (name) break;
        }
        let price = '';
        for (const s of sel_price) {
          const el = card.querySelector(s);
          if (el) price = el.textContent?.trim() || '';
          if (price && price.includes('€')) break;
        }
        const imgEl = card.querySelector('img');
        const img = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || '';
        const link = card.querySelector('a[href]')?.href || '';
        return {
          name: name || `Producto ${index + 1}`,
          price: price || 'Sin precio',
          img, link,
          extracted_at: new Date().toISOString()
        };
      } catch { return null; }
    }).filter(p => p);
  }, SELECTORS.PRODUCT_CARD, SELECTORS.NAME_SELECTORS, SELECTORS.PRICE_SELECTORS);
}

async function clickNextIfAny(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 500));
  await randomSleep(150, 300);

  for (const sel of SELECTORS.NEXT_BUTTONS) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        const isClickable = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && !el.classList.contains('is-disabled');
        }, btn);

        if (isClickable) {
          await btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await randomSleep(400, 600);
          
          const oldProducts = await page.evaluate((s) => document.querySelectorAll(s).length, SELECTORS.PRODUCT_CARD);
          await btn.click();
          
          try {
            await page.waitForFunction((old, s) => document.querySelectorAll(s).length !== old, { timeout: 6000 }, oldProducts, SELECTORS.PRODUCT_CARD);
          } catch {
            await randomSleep(800, 1200);
          }
          
          return true;
        }
      }
    } catch {
      await handleCheckIfBlocked(page);
    }
  }
  return false;
}

async function scrapeSearchTerm(browser, categoryName, searchTerm) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const results = [];
  try {
    await openHome(page);
    await doSearch(page, searchTerm);

    let pageIndex = 1;
    while (pageIndex <= MAX_PAGES_PER_SEARCH) {
      console.log(`Página ${pageIndex}`);
      await loadAllProductsOnPage(page);
      const items = await extractProducts(page);
      
      items.forEach(p => { 
        p.category = categoryName; 
        p.search_term = searchTerm; 
      });
      results.push(...items);

      const hasNext = await clickNextIfAny(page);
      if (!hasNext) break;
      pageIndex++;
    }
  } catch (err) {
    console.error(`Error en ${searchTerm}: ${err.message}`);
  } finally {
    await page.close();
  }
  return results;
}

async function main() {
  console.log('--- Iniciando Scraper ---');
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,900'] 
  });

  try {
    const allResults = [];
    for (const [category, terms] of Object.entries(SEARCH_TERMS)) {
      for (const term of terms) {
        const found = await scrapeSearchTerm(browser, category, term);
        allResults.push(...found);
        
        await randomSleep(700, 1200);
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `results_${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(allResults, null, 2));
    
    console.log(`\nCompletado! Guardado en ${filename}`);
  } catch (error) {
    console.error('Error general:', error);
  } finally {
    console.log('Cerrando navegador...');
    await browser.close();
  }
}

main().catch(console.error);
