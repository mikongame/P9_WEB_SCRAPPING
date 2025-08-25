import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Products.js';

dotenv.config();

function pickJsonPath() {
  const cwd = process.cwd();
  const candidates = fs.readdirSync(cwd)
    .filter(f => f.endsWith('.json'))
    .sort(); 
  const pccomp = candidates.filter(f => f.startsWith('pccomponentes_products_')).pop();
  if (pccomp) return path.join(cwd, pccomp);
  const fallback = path.join(cwd, 'products.json');
  if (fs.existsSync(fallback)) return fallback;
  throw new Error('No se encontró ningún JSON (pccomponentes_products_*.json o products.json)');
}

function normalizeArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && raw.results && typeof raw.results === 'object') {
    return Object.values(raw.results).flat();
  }
  if (raw && raw.products && Array.isArray(raw.products)) return raw.products;
  throw new Error('Formato JSON no reconocido. Esperaba array o { results: { ... } }');
}

async function main() {
  const jsonPath = pickJsonPath();
  console.log('Fuente:', path.basename(jsonPath));

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const items = normalizeArray(raw);
  if (!items.length) { console.log('No hay productos.'); process.exit(0); }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB conectado');

  const ops = items.map(p => ({
    updateOne: {
      filter: { name: (p.name || '').trim(), link: (p.link || '').trim() || null },
      update: {
        $set: {
          name: p.name,
          price: p.price,
          img: p.img,
          link: p.link || null,
          category: p.category || null,
          search_term: p.search_term || null,
          page_number: p.page_number ?? null,
          extracted_at: p.extracted_at ? new Date(p.extracted_at) : null
        }
      },
      upsert: true
    }
  }));

  let inserted = 0, modified = 0;
  try {
    const res = await Product.bulkWrite(ops, { ordered: false });
    inserted = res.upsertedCount || 0;
    modified = res.modifiedCount ?? res.nModified ?? 0;
  } catch (e) {
    console.warn('bulkWrite con incidencias:', e.writeErrors?.length ?? e.message);
  } finally {
    await mongoose.connection.close();
  }

  console.log(`Upsert completado. insertados=${inserted}, actualizados=${modified}, total_intentos=${ops.length}`);
  process.exit(0);
}

main().catch(err => { console.error('Seed error:', err); process.exit(1); });
