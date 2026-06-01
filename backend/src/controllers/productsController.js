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

  // Si el cliente NO mandó image_url, generamos una desde la API externa.
  // Si la mandó, la respetamos pero la verificamos (HEAD) por si está rota.
  let imageUrl = req.body.image_url;
  if (!imageUrl) {
    imageUrl = generateImageUrl(name);
    imageUrl = await verifyImageUrl(imageUrl);
  } else {
    imageUrl = await verifyImageUrl(imageUrl);
  }

  const [result] = await getPool().query(
    `INSERT INTO products (name, description, price, stock, image_url)
     VALUES (?, ?, ?, ?, ?)`,
    [name, description, price, stock, imageUrl]
  );

  const [rows] = await getPool().query('SELECT * FROM products WHERE id = ?', [result.insertId]);
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
