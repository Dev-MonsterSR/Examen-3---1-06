// Servicio de imagen externa: Lorem Picsum.
// Genera una URL determinística basada en el nombre del producto para que
// cada producto tenga una imagen consistente entre requests.
const crypto = require('node:crypto');
const { env } = require('../config/env');

/**
 * Genera una URL de imagen para un producto a partir de su nombre.
 * El "seed" hace que el mismo nombre siempre devuelva la misma imagen.
 */
function generateImageUrl(name) {
  const seed = crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 12);
  // picsum.photos soporta /seed/{seed}/{width}/{height
  return `${env.EXTERNAL_IMAGE_BASE_URL}/seed/${seed}/${env.EXTERNAL_IMAGE_WIDTH}/${env.EXTERNAL_IMAGE_HEIGHT}`;
}

/**
 * Verifica que la URL de imagen responde 200/3xx. Si no, devuelve un fallback.
 * Lorem Picsum es muy estable, pero en caso de outage queremos no romper el POST.
 */
async function verifyImageUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (res.ok) return url;
  } catch {
    /* ignore */
  }
  // Fallback genérico sin seed
  return `${env.EXTERNAL_IMAGE_BASE_URL}/${env.EXTERNAL_IMAGE_WIDTH}/${env.EXTERNAL_IMAGE_HEIGHT}`;
}

module.exports = { generateImageUrl, verifyImageUrl };
