# Web Scraping con Puppeteer + CRUD en MongoDB

Proyecto desarrollado como parte del bootcamp **RockTheCode**.  
El objetivo es realizar un scraper con **Puppeteer** para obtener datos de productos desde [PcComponentes](https://www.pccomponentes.com/), almacenarlos en un archivo local y posteriormente subirlos a **MongoDB** para gestionarlos mediante un **CRUD**.

---

## Características

- **Scraping con Puppeteer Extra + Stealth Plugin** para evitar bloqueos.
- **Extracción de productos** paginando automáticamente:
  - Nombre
  - Precio (y precio original si existe)
  - Imagen
  - Rating
  - Link al producto
- **Scroll dinámico** para cargar todos los resultados en cada página.
- **Eliminación de modales y popups** molestos.
- **Guardado en archivo JSON** (`products.json`).
- **Importación en MongoDB** mediante un script `seed.js`.
- **API REST con Express + Mongoose** para exponer CRUD:
  - `GET /products`
  - `GET /products/:id`
  - `POST /products`
  - `PUT /products/:id`
  - `DELETE /products/:id`

---

## Tecnologías utilizadas

- [Node.js](https://nodejs.org/)
- [Puppeteer Extra](https://github.com/berstend/puppeteer-extra)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Mongoose](https://mongoosejs.com/)
- [Express](https://expressjs.com/)

---

## Estructura del proyecto

```

P9\_WEB\_SCRAPPING/
│── models/          # Definición de esquemas Mongoose
│   └── Product.js
│── routes/          # Rutas del CRUD
│   └── products.js
│── scraper.js       # Scraper principal (Puppeteer)
│── seed.js          # Script para importar JSON a Mongo
│── server.js        # Servidor Express con CRUD
│── products.json    # Archivo generado por el scraper
│── package.json
│── .env             # Configuración sensible (Mongo URI, etc.)

````

---

## Instalación y uso

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tuusuario/p9_web_scrapping.git
   cd p9_web_scrapping
   ```

2. **Instalar dependencias**

   ```bash
   npm install
   ```

3. **Configurar variables de entorno (`.env`)**

   ```env
   MONGO_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/<db>
   PORT=3000
   ```

4. **Ejecutar el scraper**

   ```bash
   npm run scrape
   ```

   Esto generará un archivo `products.json` con todos los productos.

5. **Subir datos a MongoDB**

   ```bash
   npm run seed
   ```

6. **Iniciar el servidor Express**

   ```bash
   npm run dev
   ```

   El CRUD estará disponible en `http://localhost:3000/products`

---

## Endpoints principales

* `GET /products` → Lista todos los productos
* `GET /products/:id` → Muestra un producto
* `POST /products` → Crea un nuevo producto
* `PUT /products/:id` → Actualiza un producto
* `DELETE /products/:id` → Elimina un producto

---
