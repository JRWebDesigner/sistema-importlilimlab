'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Boxes, Search, SlidersHorizontal } from 'lucide-react'

type Product = {
  id: string
  sku: string
  name: string
  currentStock: number
  minimumStock: number
  category: { name: string }
}

export default function InventoryModule() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ productId: '', type: 'ADJUSTMENT_IN', quantity: '1', notes: '' })
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  async function loadInventory(search = query) {
    setIsLoading(true)
    const response = await fetch(`/api/inventory?q=${encodeURIComponent(search)}`)
    const data = await response.json()
    setProducts(response.ok ? data : [])
    setIsLoading(false)
  }

  useEffect(() => { void loadInventory('') }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await response.json()
    if (!response.ok) {
      setMessage(data.error ?? 'No se pudo registrar el movimiento.')
      return
    }

    setForm((current) => ({ ...current, quantity: '1', notes: '' }))
    setMessage('Movimiento de inventario registrado.')
    await loadInventory()
  }

  async function handleDeleteInventory(id: string) {
    const confirmed = window.confirm('¿Deseas eliminar este producto del inventario?')
    if (!confirmed) return
    const response = await fetch(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    setMessage(response.ok ? `Producto eliminado del inventario: ${data.name ?? 'ok'}` : data.error ?? 'No se pudo eliminar el producto.')
    if (response.ok) await loadInventory()
  }

  return <div className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">Operaciones · Bolivia</p><h1>Inventario</h1><p className="muted">Existencias y movimientos auditables por producto.</p></div><span className="currency-note">Costos: USD</span></div>{message && <p className="module-message">{message}</p>}<form className="panel product-form" onSubmit={handleSubmit}><div className="product-form-grid"><label>Producto<select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Selecciona un producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · stock {product.currentStock}</option>)}</select></label><label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="ADJUSTMENT_IN">Entrada por ajuste</option><option value="ADJUSTMENT_OUT">Salida por ajuste</option><option value="RETURN_IN">Devolución recibida</option><option value="RETURN_OUT">Devolución entregada</option></select></label><label>Cantidad<input required min="1" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>Motivo / nota<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Ej. conteo físico" /></label></div><button className="primary-button" type="submit"><SlidersHorizontal size={15} /> Registrar movimiento</button></form><article className="panel module-table"><div className="module-toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); void loadInventory(event.target.value) }} placeholder="Buscar inventario..." /></div></div><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Stock actual</th><th>Stock mínimo</th><th>Estado</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={5}>Cargando inventario...</td></tr> : products.map((product) => <tr key={product.id}><td><div className="product-cell"><span className="product-thumb"><Boxes size={16} /></span><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td>{product.category.name}</td><td><strong className={product.currentStock <= product.minimumStock ? 'stock-low' : ''}>{product.currentStock} unid.</strong></td><td>{product.minimumStock} unid.</td><td><span className={`status ${product.currentStock <= product.minimumStock ? 'warning' : 'success'}`}><i />{product.currentStock <= product.minimumStock ? 'Bajo stock' : 'Disponible'}</span></td></tr>)}</tbody></table></div></article></div>
}
