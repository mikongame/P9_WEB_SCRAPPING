import fs from 'fs';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const BASE = 'https://www.pccomponentes.com/';

const SEARCH_TERMS = { 
  portatiles: ['portátiles', 'laptop', 'ordenadores portátiles', 'macbook', 'notebook'],
  smartphones: ['smartphone', 'móviles', 'teléfonos móviles', 'iphone']
};

const LAZY_SCROLL_STEPS = 12;
const LAZY_SCROLL_WAIT = 800;
const MAX_PAGES_PER_SEARCH = 5;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function acceptCookieAndModals(page) {
  const candidates = [
    '#cookies-accept-all',
    '#onetrust-accept-btn-handler', 
    '#didomi-notice-agree-button',
    'button[aria-label="Aceptar"]',
    'button[data-qa="accept-cookies"]',
    '.cookie-accept',
    'button:contains("Aceptar todas")',
    'button:contains("Accept")'
  ];
  for (const sel of candidates) {
    try { 
      await page.click(sel, { timeout: 2000 }); 
      await sleep(500);
      console.log(`Cookies aceptadas con selector: ${sel}`);
      break; 
    } catch {}
  }
  
  const closeCandidates = [
    'button[aria-label="Cerrar"]',
    '.c-modal__close',
    '.modal__close',
    '.popup-close',
    '.sc-dskThN',
    'button:contains("×")'
  ];
  for (const sel of closeCandidates) {
    try { await page.click(sel, { timeout: 1000 }); } catch {}
  }
}

async function openHome(page) {
  console.log('🏠 Accediendo a página principal...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await sleep(1500);
  await acceptCookieAndModals(page);
}

async function doSearch(page, term) {
  console.log(`🔍 Buscando: "${term}"`);
  
  const searchSelectors = [
    'input[type="search"]',
    'input[placeholder*="Buscar"]',
    'input[placeholder*="buscar"]', 
    '#search',
    'input[name="query"]',
    'input[name="search"]',
    '.search-input',
    'input[data-testid="search"]'
  ];

  let found = false;
  for (const sel of searchSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 15000 });
      
      await page.click(sel, { clickCount: 3 });
      await sleep(300);
      await page.type(sel, term, { delay: 80 });
      await sleep(500);
      await page.keyboard.press('Enter');
      
      found = true;
      console.log(`Búsqueda realizada con selector: ${sel}`);
      break;
    } catch {}
  }
  
  if (!found) throw new Error('No se encontró la barra de búsqueda.');

  await page.waitForFunction(
    () => {
      return document.body.innerText.toLowerCase().includes('resultados') || 
             document.body.innerText.toLowerCase().includes('productos') ||
             document.querySelectorAll('.product-card, .c-product-card, [data-testid="product-card"]').length > 0;
    },
    { timeout: 25000 }
  );
  
  await sleep(1000);
  await acceptCookieAndModals(page);
}

async function loadAllProductsOnPage(page) {
  console.log('Cargando todos los productos de la página...');
  
  let lastCount = 0;
  let stableCount = 0;
  
  for (let i = 0; i < LAZY_SCROLL_STEPS; i++) {
    const count = await page.evaluate(() => {
      return document.querySelectorAll(
        '.product-card, .c-product-card, [data-testid="product-card"], .sc-eIrltS, .sc-fGjrnr'
      ).length;
    });
    
    console.log(`   Scroll ${i + 1}/${LAZY_SCROLL_STEPS}: ${count} productos detectados`);
    
    if (count > lastCount) {
      lastCount = count;
      stableCount = 0;
      
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 0.8);
      });
      await sleep(LAZY_SCROLL_WAIT);
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await sleep(LAZY_SCROLL_WAIT);
      
    } else {
      stableCount++;
      if (stableCount >= 3) {
        console.log('No se detectan más productos, continuando...');
        break;
      }
      await sleep(LAZY_SCROLL_WAIT);
    }
  }
  
  console.log(`Total de productos detectados en página: ${lastCount}`);
}

async function extractProducts(page) {
  return await page.evaluate(() => {
    const cards = document.querySelectorAll(
      '.product-card, .c-product-card, [data-testid="product-card"], .sc-eIrltS'
    );
    
    console.log(`Encontradas ${cards.length} tarjetas de productos`);
    
    return [...cards].map((card, index) => {
      try {
        const nameSelectors = [
          '.product-card__title',
          '.c-product-card__title', 
          'h3[data-e2e="title-card"]',
          '.sc-cmEail',
          'h3',
          'h2',
          'a[title]',
          '[data-testid="product-title"]'
        ];
        
        let name = '';
        for (const selector of nameSelectors) {
          const nameEl = card.querySelector(selector);
          if (nameEl) {
            name = nameEl.textContent?.trim() || nameEl.getAttribute('title')?.trim() || '';
            if (name) break;
          }
        }

        const priceSelectors = [
          '[data-e2e="price-card"]',
          '.sc-ldFCYb',
          '.product-card__price',
          '.c-product-card__price-actual',
          '.price-current',
          '.price',
          '[data-price]',
          '.sc-eKYjST span:first-child'
        ];
        
        let price = '';
        for (const selector of priceSelectors) {
          const priceEl = card.querySelector(selector);
          if (priceEl) {
            price = priceEl.textContent?.trim() || '';
            if (price && price.includes('€')) break;
          }
        }

        let originalPrice = '';
        const crossedSelectors = [
          '[data-e2e="crossedPrice"]',
          '.sc-oQLfA',
          '.price-crossed',
          '.original-price'
        ];
        
        for (const selector of crossedSelectors) {
          const crossedEl = card.querySelector(selector);
          if (crossedEl) {
            originalPrice = crossedEl.textContent?.trim() || '';
            if (originalPrice) break;
          }
        }

        const imgEl = card.querySelector('img');
        const img = imgEl?.getAttribute('data-src') || 
                   imgEl?.getAttribute('src') || 
                   imgEl?.getAttribute('data-lazy-src') || '';

        const ratingEl = card.querySelector('.sc-dQelHR, .rating, [data-rating]');
        const rating = ratingEl?.textContent?.trim() || '';

        const linkEl = card.querySelector('a[href]');
        const link = linkEl?.href || '';

        const product = {
          name: name || `Producto ${index + 1}`,
          price: price || 'Sin precio',
          originalPrice: originalPrice || null,
          img: img || null,
          rating: rating || null,
          link: link || null,
          extracted_at: new Date().toISOString()
        };

        return product;
        
      } catch (error) {
        console.error(`Error extrayendo producto ${index}:`, error);
        return null;
      }
    }).filter(p => p && p.name !== `Producto ${cards.length + 1}`);
  });
}

async function clickNextIfAny(page) {
  const nextSelectors = [
    '.c-pagination__next:not(.is-disabled)',
    'a[rel="next"]:not(.disabled)',
    '.pagination__next a:not(.disabled)',
    'button[aria-label*="Siguiente"]:not([disabled])',
    'a[aria-label*="Siguiente"]:not(.disabled)',
    '.pagination .next:not(.disabled)',
    'a:contains("Siguiente"):not(.disabled)',
    '.pager-next:not(.disabled)'
  ];
  
  for (const sel of nextSelectors) {
    try {
      const handle = await page.$(sel);
      if (handle) {
        const isClickable = await page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && 
                 style.visibility !== 'hidden' && 
                 style.display !== 'none' &&
                 !el.disabled;
        }, handle);
        
        if (isClickable) {
          console.log(`➡️ Navegando a siguiente página con selector: ${sel}`);
          
          await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth' }), handle);
          await sleep(1000);
          
          await Promise.all([
            handle.click(),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
            page.waitForFunction(
              () => document.querySelectorAll('.product-card, .c-product-card, [data-testid="product-card"]').length > 0,
              { timeout: 20000 }
            )
          ]);
          
          await sleep(2000);
          await acceptCookieAndModals(page);
          return true;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  console.log('No se encontró botón de siguiente página');
  return false;
}

async function scrapeSearchTerm(browser, categoryName, searchTerm) {
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1366, height: 900 });
  page.setDefaultTimeout(40000);

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['media', 'font'].includes(type)) return req.abort();
    req.continue();
  });

  console.log(`\nBuscando: ${categoryName} -> "${searchTerm}"`);

  const allProducts = [];

  try {
    await openHome(page);
    await doSearch(page, searchTerm);

    let pageIndex = 1;
    
    while (pageIndex <= MAX_PAGES_PER_SEARCH) {
      console.log(`\nProcesando página ${pageIndex}/${MAX_PAGES_PER_SEARCH}`);
      
      await loadAllProductsOnPage(page);
      const products = await extractProducts(page);
      
      console.log(`Extraídos ${products.length} productos de página ${pageIndex}`);
      
      if (products.length > 0) {
        products.forEach(product => {
          product.search_term = searchTerm;
          product.category = categoryName;
          product.page_number = pageIndex;
        });
        
        allProducts.push(...products);
      } else {
        console.log('No se encontraron productos en esta página');
      }

      const moved = await clickNextIfAny(page);
      if (!moved) {
        console.log('No hay más páginas disponibles');
        break;
      }
      
      pageIndex++;
      
      await page.waitForFunction(
        () => document.querySelectorAll('.product-card, .c-product-card, [data-testid="product-card"]').length > 0,
        { timeout: 30000 }
      );
      
      await sleep(1000);
    }
    
  } catch (err) {
    console.warn(`Error en ${categoryName} - ${searchTerm}: ${err.message}`);
  } finally {
    await page.close();
  }

  console.log(`🎉 ${categoryName} - "${searchTerm}": ${allProducts.length} productos totales`);
  return allProducts;
}

async function retryableScrape(fn, retries = 1, delay = 2000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries) throw e;
      console.warn(`Reintentando tras fallo: ${e.message}`);
      await sleep(delay);
    }
  }
}
async function main() {
  console.log('Iniciando PCComponentes Scraper ...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
  });

  const allResults = {};
  
  for (const [categoryName, searchTerms] of Object.entries(SEARCH_TERMS)) {
    console.log(`\nPROCESANDO CATEGORÍA: ${categoryName.toUpperCase()}`);
    console.log(`Términos de búsqueda: ${searchTerms.join(', ')}`);
    
    allResults[categoryName] = [];
    
    for (let i = 0; i < searchTerms.length; i++) {
      const searchTerm = searchTerms[i];
      const products = await retryableScrape(() => scrapeSearchTerm(browser, categoryName, searchTerm));

      allResults[categoryName].push(...products);
      
      if (i < searchTerms.length - 1) {
        const pauseTime = 2000 + Math.floor(Math.random() * 2000);
        console.log(`Pausa de ${pauseTime}ms antes del siguiente término...`);
        await sleep(pauseTime);
      }
    }
    
    const uniqueProducts = allResults[categoryName].filter((product, index, self) =>
      index === self.findIndex(p =>
        p.name === product.name &&
        p.price === product.price &&
        p.link === product.link
      )
    );
    
    allResults[categoryName] = uniqueProducts;
    
    console.log(`${categoryName}: ${uniqueProducts.length} productos únicos extraídos`);
    
    await sleep(3000 + Math.floor(Math.random() * 2000));
  }

  await browser.close();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pccomponentes_products_${timestamp}.json`;
  
  const finalData = {
    timestamp: new Date().toISOString(),
    total_categories: Object.keys(allResults).length,
    search_terms_used: SEARCH_TERMS,
    results: allResults,
    summary: {}
  };
  
  for (const [category, products] of Object.entries(allResults)) {
    finalData.summary[category] = {
      total_products: products.length,
      products_with_price: products.filter(p => p.price !== 'Sin precio').length,
      products_with_images: products.filter(p => p.img).length,
      search_terms_used: SEARCH_TERMS[category]
    };
  }
  
  fs.writeFileSync(filename, JSON.stringify(finalData, null, 2));
  
  console.log('\nSCRAPING COMPLETADO');
  console.log('========================');
  
  let totalProducts = 0;
  Object.entries(allResults).forEach(([category, products]) => {
    const withPrices = products.filter(p => p.price !== 'Sin precio').length;
    console.log(`${category}: ${products.length} productos (${withPrices} con precio)`);
    totalProducts += products.length;
  });
  
  console.log(`\nTotal: ${totalProducts} productos extraídos`);
  console.log(`Guardado en: ${filename}`);
}

main().catch(e => console.error('Error:', e));