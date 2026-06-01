// Lógica CRUD de productos. Pasa errores al middleware global via next()
// (express-async-errors los transforma en next(err)).
const { getPool } = require('../db/pool');
const { generateImageUrl, verifyImageUrl } = require('../services/externalImageService');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function rowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stock: row.stock,
    image_url: row.image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function list(req, res) {
  const [rows] = await getPool().query(
    'SELECT * FROM products ORDER BY id DESC'
  );
  res.json({ data: rows.map(rowToProduct), total: rows.length });
}

async function getById(req, res) {
  const id = Number(req.params.id);
  const [rows] = await getPool().query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) throw new HttpError(404, `Producto ${id} no existe`);
  res.json({ data: rowToProduct(rows[0]) });
}

async function create(req, res) {
  const { name, description, price, stock } = req.body;

  // Paso 1: insertar primero con un placeholder vacío para poder usar el id generado
  // (la PK autoincrement) en el seed de la imagen. Esto garantiza que:
  //  - cada producto tenga una imagen ÚNICA (gracias al id)
  //  - la imagen sea ESTABLE (no cambia al recargar: mismo id → mismo seed → misma imagen)
  const [result] = await getPool().query(
    `INSERT INTO products (name, description, price, stock, image_url)
     VALUES (?, ?, ?, ?, ?)`,
    [name, description, price, stock, '']
  );
  const newId = result.insertId;

  // Paso 2: generar la URL usando el id real y el nombre.
  // Si el cliente mandó image_url, la respetamos (igual verificada por HEAD).
  // Si no, generamos una desde la API externa con seed único por id.
  let imageUrl = req.body.image_url;
  if (!imageUrl) {
    imageUrl = generateImageUrl(newId, name);
  }
  imageUrl = await verifyImageUrl(imageUrl);

  // Paso 3: actualizar la fila con la URL definitiva
  await getPool().query('UPDATE products SET image_url = ? WHERE id = ?', [imageUrl, newId]);

  const [rows] = await getPool().query('SELECT * FROM products WHERE id = ?', [newId]);
  res.status(201).json({ data: rowToProduct(rows[0]) });
}

async function update(req, res) {
  const id = Number(req.params.id);

  // Verificar que existe
  const [existing] = await getPool().query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
  if (existing.length === 0) throw new HttpError(404, `Producto ${id} no existe`);

  // Construir SET dinámico solo con campos provistos
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(req.body)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(id);

  await getPool().query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);

  const [rows] = await getPool().query('SELECT * FROM products WHERE id = ?', [id]);
  res.json({ data: rowToProduct(rows[0]) });
}

async function remove(req, res) {
  const id = Number(req.params.id);
  const [result] = await getPool().query('DELETE FROM products WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw new HttpError(404, `Producto ${id} no existe`);
  res.status(204).send();
}

module.exports = { list, getById, create, update, remove, HttpError };
