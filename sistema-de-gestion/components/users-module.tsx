'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Plus, UserRound } from 'lucide-react'

type User = { id: string; name: string; alias: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }
const roleLabels: Record<string, string> = { ADMIN: 'Administrador', SALES: 'Ventas', INVENTORY: 'Inventario', ACCOUNTING: 'Contabilidad', VIEWER: 'Solo lectura' }

export default function UsersModule() {
  const [users, setUsers] = useState<User[]>([])
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', alias: '', email: '', password: '', role: 'VIEWER' })

  async function load() {
    const response = await fetch('/api/users')
    if (response.ok) setUsers(await response.json())
    else setMessage('No tienes permisos para administrar usuarios.')
  }

  useEffect(() => { void load() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await response.json()
    setMessage(response.ok ? 'Usuario creado correctamente.' : data.error)
    if (response.ok) { setForm({ name: '', alias: '', email: '', password: '', role: 'VIEWER' }); setOpen(false); await load() }
  }

  async function toggle(user: User) {
    const response = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, isActive: !user.isActive }) })
    const data = await response.json()
    setMessage(response.ok ? 'Estado actualizado.' : data.error)
    if (response.ok) await load()
  }

  return <div className="dashboard-content">
    <div className="page-heading"><div><p className="eyebrow">Administración</p><h1>Usuarios y roles</h1><p className="muted">Cada usuario debe tener un alias y correo únicos.</p></div><button className="primary-button" onClick={() => setOpen((value) => !value)}><Plus size={17} /> Nuevo usuario</button></div>
    {message && <p className="module-message">{message}</p>}
    {open && <form className="panel product-form" onSubmit={submit}><div className="product-form-grid"><label>Nombre<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Alias<input required minLength={3} pattern="[A-Za-z0-9._-]+" value={form.alias} onChange={(event) => setForm({ ...form, alias: event.target.value })} placeholder="Ej. fernando" /></label><label>Correo<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Contraseña<input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><button className="primary-button" type="submit">Guardar usuario</button></form>}
    <article className="panel module-table"><div className="table-scroll"><table><thead><tr><th>Usuario</th><th>Alias</th><th>Correo</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="product-cell"><span className="product-thumb"><UserRound size={16} /></span><strong>{user.name}</strong></div></td><td>{user.alias}</td><td>{user.email}</td><td>{roleLabels[user.role] ?? user.role}</td><td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-BO') : 'Nunca'}</td><td><span className={`status ${user.isActive ? 'success' : 'warning'}`}><i />{user.isActive ? 'Activo' : 'Inactivo'}</span></td><td><button className="outline-button" onClick={() => void toggle(user)}>{user.isActive ? 'Desactivar' : 'Activar'}</button></td></tr>)}</tbody></table></div></article>
  </div>
}
