'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Package, Plus, Search } from 'lucide-react'

type Product = {
  id: string
  sku: string
  name: string
  cost: string
  price: string
  currentStock: number
  minimumStock: number
  category: { id: string; name: string }
}

type Category = { id: string; name: string }

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default function ProductsModule() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [query, setQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [form, setForm] = useState({
    sku: '',
    name: '',
    categoryId: '',
    cost: '',
    price: '',
    currentStock: '0',
    minimumStock: '0',
  })

  async function loadProducts(search = query) {
    setIsLoading(true)
    const response = await fetch(`/api/products?q=${encodeURIComponent(search)}`)
    const data = await response.json()
    setProducts(response.ok ? data : [])
    setIsLoading(false)
  }

  async function loadCategories() {
    const response = await fetch('/api/categories')
    if (response.ok) setCategories(await response.json())
  }

  useEffect(() => {
    void loadProducts('')
    void loadCategories()
  }, [])

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: categoryName }),
    })
    const data = await response.json()

    if (!response.ok) {
      setMessage(data.error ?? 'No se pudo guardar la categoría.')
      return
    }

    setCategoryName('')
    setCategories((current) => [...current, data].sort((left, right) => left.name.localeCompare(right.name)))
    setForm((current) => ({ ...current, categoryId: data.id }))
    setMessage('Categoría guardada en PostgreSQL.')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await response.json()

    if (!response.ok) {
      setMessage(data.error ?? 'No se pudo guardar el producto.')
      return
    }

    setForm({ sku: '', name: '', categoryId: '', cost: '', price: '', currentStock: '0', minimumStock: '0' })
    setIsFormOpen(false)
    setMessage('Producto guardado en PostgreSQL.')
    await loadProducts()
  }

  return <div className="dashboard-content">
    <div className="page-heading">
      <div><p className="eyebrow">Catálogo</p><h1>Productos</h1><p className="muted">Precios y costos expresados en dólares estadounidenses.</p></div>
      <button className="primary-button" onClick={() => setIsFormOpen((open) => !open)}><Plus size={17} /> Nuevo producto</button>
    </div>
    {message && <p className="module-message">{message}</p>}
    {isFormOpen && <form className="panel product-form" onSubmit={handleSubmit}>
      <div className="product-form-grid">
        <label>SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label>
        <label>Nombre<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Categoría<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Costo USD<input required min="0" step="0.01" type="number" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} /></label>
        <label>Precio USD<input required min="0.01" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
        <label>Stock inicial<input min="0" type="number" value={form.currentStock} onChange={(event) => setForm({ ...form, currentStock: event.target.value })} /></label>
        <label>Stock mínimo<input min="0" type="number" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /></label>
      </div>
      <button className="primary-button" type="submit">Guardar producto</button>
    </form>}
    <form className="panel category-form" onSubmit={handleCategorySubmit}><label>Nueva categoría<input required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ej. Tecnología" /></label><button className="outline-button" type="submit">Crear categoría</button></form>
    <article className="panel module-table">
      <div className="module-toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); void loadProducts(event.target.value) }} placeholder="Buscar productos..." /></div><span className="currency-note">Moneda: USD</span></div>
      <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Costo</th><th>Precio</th><th>Estado</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={6}>Cargando productos...</td></tr> : products.map((product) => <tr key={product.id}><td><div className="product-cell"><span className="product-thumb"><Package size={16} /></span><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td>{product.category.name}</td><td>{product.currentStock} unid.</td><td>{money.format(Number(product.cost))}</td><td><strong>{money.format(Number(product.price))}</strong></td><td><span className={`status ${product.currentStock <= product.minimumStock ? 'warning' : 'success'}`}><i />{product.currentStock <= product.minimumStock ? 'Bajo stock' : 'Disponible'}</span></td></tr>)}</tbody></table></div>
    </article>
  </div>
}
