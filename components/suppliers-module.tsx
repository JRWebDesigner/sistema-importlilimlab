'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Plus, Truck } from 'lucide-react'

type Supplier = { id: string; document: string; name: string; email: string | null; phone: string | null }

export default function SuppliersModule() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ document: '', name: '', email: '', phone: '', address: '' })
  async function load() { const response = await fetch('/api/suppliers'); if (response.ok) setSuppliers(await response.json()) }
  useEffect(() => { void load() }, [])
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const response = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const data = await response.json(); setMessage(response.ok ? 'Proveedor guardado.' : data.error); if (response.ok) { setForm({ document: '', name: '', email: '', phone: '', address: '' }); setOpen(false); await load() } }
  async function remove(id: string) {
    const confirmed = window.confirm('¿Deseas eliminar este proveedor?')
    if (!confirmed) return
    const response = await fetch(`/api/suppliers?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    setMessage(response.ok ? `Proveedor eliminado: ${data.name ?? 'ok'}` : data.error ?? 'No se pudo eliminar el proveedor.')
    if (response.ok) await load()
  }
  return <div className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">Contactos · Bolivia</p><h1>Proveedores</h1><p className="muted">Directorio de proveedores identificados por NIT.</p></div><button className="primary-button" onClick={() => setOpen((value) => !value)}><Plus size={17} /> Nuevo proveedor</button></div>{message && <p className="module-message">{message}</p>}{open && <form className="panel product-form" onSubmit={submit}><div className="product-form-grid"><label>NIT<input required value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} /></label><label>Razón social<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Correo<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Teléfono<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Dirección<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label></div><button className="primary-button" type="submit">Guardar proveedor</button></form>}<article className="panel module-table"><div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>NIT</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td><div className="product-cell"><span className="product-thumb"><Truck size={16} /></span><strong>{supplier.name}</strong></div></td><td>{supplier.document}</td><td>{supplier.email || 'Sin correo'}</td><td>{supplier.phone || 'Sin teléfono'}</td><td><span className="status success"><i />Activo</span></td><td><button className="outline-button" onClick={() => void remove(supplier.id)}>Eliminar</button></td></tr>)}</tbody></table></div></article></div>
}
