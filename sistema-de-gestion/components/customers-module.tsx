'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Plus, Search, UserRound } from 'lucide-react'

type Customer = {
  id: string
  type: 'PERSON' | 'COMPANY'
  document: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
}

export default function CustomersModule() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [form, setForm] = useState({ type: 'PERSON', document: '', name: '', email: '', phone: '', address: '' })

  async function loadCustomers(search = query) {
    setIsLoading(true)
    const response = await fetch(`/api/customers?q=${encodeURIComponent(search)}`)
    const data = await response.json()
    setCustomers(response.ok ? data : [])
    setIsLoading(false)
  }

  useEffect(() => { void loadCustomers('') }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await response.json()

    if (!response.ok) {
      setMessage(data.error ?? 'No se pudo guardar el cliente.')
      return
    }

    setForm({ type: 'PERSON', document: '', name: '', email: '', phone: '', address: '' })
    setIsFormOpen(false)
    setMessage('Cliente guardado en PostgreSQL.')
    await loadCustomers()
  }

  return <div className="dashboard-content">
    <div className="page-heading"><div><p className="eyebrow">Contactos</p><h1>Clientes</h1><p className="muted">Directorio real de personas y empresas.</p></div><button className="primary-button" onClick={() => setIsFormOpen((open) => !open)}><Plus size={17} /> Nuevo cliente</button></div>
    {message && <p className="module-message">{message}</p>}
    {isFormOpen && <form className="panel product-form" onSubmit={handleSubmit}><div className="product-form-grid"><label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="PERSON">Persona</option><option value="COMPANY">Empresa</option></select></label><label>Documento<input required value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} placeholder="CI o NIT" /></label><label>Nombre / razón social<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Correo<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Teléfono<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Dirección<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label></div><button className="primary-button" type="submit">Guardar cliente</button></form>}
    <article className="panel module-table"><div className="module-toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); void loadCustomers(event.target.value) }} placeholder="Buscar clientes..." /></div></div><div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Documento</th><th>Correo</th><th>Teléfono</th><th>Estado</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={5}>Cargando clientes...</td></tr> : customers.map((customer) => <tr key={customer.id}><td><div className="product-cell"><span className="product-thumb"><UserRound size={16} /></span><div><strong>{customer.name}</strong><small>{customer.type === 'COMPANY' ? 'Empresa' : 'Persona'}</small></div></div></td><td>{customer.document}</td><td>{customer.email || 'Sin correo'}</td><td>{customer.phone || 'Sin teléfono'}</td><td><span className="status success"><i />Activo</span></td></tr>)}</tbody></table></div></article>
  </div>
}
