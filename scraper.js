import puppeteer from 'puppeteer';
import fs from 'fs/promises';

const CATEGORIES = [
  { name: 'portatiles', url: 'https://www.pccomponentes.com/portatiles' },
  { name: 'smartphones', url: 'https://www.pccomponentes.com/smartphones' }
];

// Pausa aleatoria entre 1 y 3 segundos
const delay = async (ms) => new Promise((res) => setTimeout(res, ms));

const randomDelay = async () => {
  const ms = Math.floor(Math.random() * 2000) + 1000;
  await delay(ms);
};

const scrapeCategory = async (categoryName, url, browser) => {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  );

  const products = [];

  console.log(`🔎 Accediendo a la categoría: ${categoryName}`);
  await page.goto(url, { waitUntil: 'networkidle2' });

  try {
    await page.click('#cookies-accept-all', { timeout: 3000 });
  } catch {}

  let hasNext = true;
  while (hasNext) {
    try {
      await page.waitForSelector('.c-product-card', { timeout: 10000 });

      const pageProducts = await page.evaluate(() => {
        return [...document.querySelectorAll('.c-product-card')].map(product => {
          const name = product.querySelector('.c-product-card__title')?.innerText.trim();
          const price = product.querySelector('.c-product-card__price-actual')?.innerText.trim();
          const img = product.querySelector('img')?.src;
          return { name, price, img };
        });
      });

      products.push(...pageProducts);
      console.log(`📦 Página con ${pageProducts.length} productos`);

      // Pausa antes de navegar
      await randomDelay();

      const nextButton = await page.$('.c-pagination__next:not(.is-disabled)');
      if (nextButton) {
        await Promise.all([
          nextButton.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
        ]);
      } else {
        hasNext = false;
      }
    } catch (error) {
      console.warn(`⚠️ Error en scraping de ${categoryName}:`, error.message);
      hasNext = false;
    }
  }

  await page.close();
  return products;
};

const scrape = async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const allResults = {};

  for (const category of CATEGORIES) {
    const data = await scrapeCategory(category.name, category.url, browser);
    allResults[category.name] = data;
    console.log(`✅ ${category.name}: ${data.length} productos extraídos`);
  }

  await browser.close();
  await fs.writeFile('products.json', JSON.stringify(allResults, null, 2));
  console.log("📝 Archivo 'products.json' generado con éxito.");
};

scrape();
