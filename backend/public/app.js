// Cliente JS plano. Sin frameworks. Consume /api/products.
(function () {
  'use strict';

  const $  = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const API = '/api/products';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const form     = $('#product-form');
  const formMsg  = $('#form-msg');
  const formTit  = $('#form-title');
  const submit   = $('#submit-btn');
  const resetBtn = $('#reset-btn');
  const grid     = $('#products');
  const empty    = $('#empty-msg');
  const search   = $('#search');
  const envBadge = $('#env-badge');

  let products = [];
  let editingId = null;

  function setMsg(text, kind) {
    formMsg.textContent = text || '';
    formMsg.className = 'form-msg' + (kind ? ' ' + kind : '');
  }

  function resetForm() {
    form.reset();
    editingId = null;
    formTit.textContent = 'Crear producto';
    submit.textContent = 'Crear producto';
    resetBtn.hidden = true;
    setMsg('');
  }

  function fillForm(p) {
    form.id.value = p.id;
    form.name.value = p.name;
    form.description.value = p.description;
    form.price.value = p.price;
    form.stock.value = p.stock;
    form.image_url.value = p.image_url || '';
    editingId = p.id;
    formTit.textContent = `Editar producto #${p.id}`;
    submit.textContent = 'Guardar cambios';
    resetBtn.hidden = false;
    setMsg('');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = list.map((p) => {
      const stockClass = p.stock <= 5 ? 'stock low' : 'stock';
      const stockTxt   = p.stock === 0 ? 'Sin stock' : `Stock: ${p.stock}`;
      return `
        <article class="card" data-id="${p.id}">
          <div class="thumb" style="background-image:url('${esc(p.image_url)}')"></div>
          <div class="body">
            <div class="name">${esc(p.name)}</div>
            <div class="desc">${esc(p.description)}</div>
            <div class="meta">
              <span class="price">S/ ${Number(p.price).toFixed(2)}</span>
              <span class="${stockClass}">${stockTxt}</span>
            </div>
          </div>
          <div class="actions">
            <button type="button" class="btn" data-action="edit" data-id="${p.id}">Editar</button>
            <button type="button" class="btn btn-danger" data-action="del" data-id="${p.id}">Eliminar</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    if (!q) return render(products);
    render(products.filter((p) => (p.name || '').toLowerCase().includes(q)));
  }

  async function loadHealth() {
    try {
      const r = await fetch('/api/health');
      const j = await r.json();
      envBadge.textContent = j.env || '—';
    } catch { envBadge.textContent = 'offline'; }
  }

  async function load() {
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      products = j.data || [];
      applyFilter();
    } catch (e) {
      grid.innerHTML = '';
      empty.hidden = false;
      empty.textContent = `Error cargando productos: ${e.message}`;
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg('Enviando…');
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      price: Number(fd.get('price')),
      stock: Number(fd.get('stock')),
    };
    const img = String(fd.get('image_url') || '').trim();
    if (img) payload.image_url = img;

    try {
      let r;
      if (editingId) {
        r = await fetch(`${API}/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        r = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detail = (data.details || []).map((d) => `${d.field}: ${d.message}`).join('; ');
        throw new Error(detail || data.message || `HTTP ${r.status}`);
      }
      setMsg(editingId ? 'Producto actualizado ✓' : 'Producto creado ✓', 'ok');
      resetForm();
      await load();
    } catch (e) {
      setMsg(`Error: ${e.message}`, 'err');
    }
  }

  async function onGridClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'edit') {
      const p = products.find((x) => String(x.id) === String(id));
      if (p) fillForm(p);
    } else if (action === 'del') {
      const p = products.find((x) => String(x.id) === String(id));
      if (!p) return;
      if (!confirm(`¿Eliminar "${p.name}"?`)) return;
      try {
        const r = await fetch(`${API}/${id}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.message || `HTTP ${r.status}`);
        }
        setMsg('Producto eliminado ✓', 'ok');
        if (editingId && String(editingId) === String(id)) resetForm();
        await load();
      } catch (e) {
        setMsg(`Error: ${e.message}`, 'err');
      }
    }
  }

  // wire
  form.addEventListener('submit', onSubmit);
  resetBtn.addEventListener('click', resetForm);
  grid.addEventListener('click', onGridClick);
  search.addEventListener('input', applyFilter);
  $('#refresh-btn').addEventListener('click', load);

  loadHealth();
  load();
})();
