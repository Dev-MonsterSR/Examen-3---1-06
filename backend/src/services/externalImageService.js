// Servicio de imagen externa: Lorem Picsum.
//
// Estrategia: cada producto recibe una URL única y ESTABLE basada en su `id`.
// El `id` es único por definición (PK autoincrement) y nunca cambia, así que:
//   - Distintos productos → distintas imágenes (gracias al id).
//   - El mismo producto → siempre la misma imagen (Picsum cachea por seed).
//   - Al recargar la página no cambia la imagen del producto.
//
// Para Picsum usamos `https://picsum.photos/seed/{seed}/{w}/{h}` que mapea
// 1:1 seed → imagen. Como el id puede ser pequeño (1, 2, 3...) lo
// combinamos con un hash del nombre para mayor dispersión en el espacio
// de seeds de Picsum, evitando que ids cercanos den imágenes similares.
const crypto = require('node:crypto');
const { env } = require('../config/env');

/**
 * Genera una URL de imagen para un producto a partir de su id y nombre.
 * Devuelve SIEMPRE la misma URL para el mismo par (id, nombre).
 */
function generateImageUrl(id, name) {
  // Combinamos id + nombre y los hasheamos para obtener un seed amplio
  const base = `${id}::${String(name || '')}`;
  const seed = crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
  return `${env.EXTERNAL_IMAGE_BASE_URL}/seed/${seed}/${env.EXTERNAL_IMAGE_WIDTH}/${env.EXTERNAL_IMAGE_HEIGHT}`;
}

/**
 * Verifica que la URL de imagen responde 200. Si no, devuelve un fallback.
 * Picsum devuelve 405 a HEAD requests, así que usamos un GET con Range
 * (descargamos solo el primer byte) para validar sin desperdiciar ancho de banda.
 */
async function verifyImageUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
    });
    // 200, 206 (Partial Content) y 3xx son válidos
    if (res.ok || res.status === 206) return url;
  } catch {
    /* ignore */
  }
  // Fallback genérico sin seed
  return `${env.EXTERNAL_IMAGE_BASE_URL}/${env.EXTERNAL_IMAGE_WIDTH}/${env.EXTERNAL_IMAGE_HEIGHT}`;
}

module.exports = { generateImageUrl, verifyImageUrl };
