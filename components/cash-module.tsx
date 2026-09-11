'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Building2, Plus, WalletCards } from 'lucide-react'

type Account = { id: string; name: string; type: 'CASH' | 'BANK' | 'POS'; balance: string }

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function CashModule() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountForm, setAccountForm] = useState({ name: '', type: 'CASH', initialBalance: '0' })
  const [movementForm, setMovementForm] = useState({ accountId: '', type: 'IN', amount: '', description: '' })
  const [message, setMessage] = useState('')

  async function loadAccounts() {
    const response = await fetch('/api/cash')
    if (response.ok) {
      const data = await response.json()
      setAccounts(data)
      setMovementForm((current) => ({ ...current, accountId: current.accountId || data[0]?.id || '' }))
    }
  }

  useEffect(() => { void loadAccounts() }, [])

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accountForm) })
    const data = await response.json()
    setMessage(response.ok ? 'Cuenta creada correctamente.' : data.error ?? 'No se pudo crear la cuenta.')
    if (response.ok) { setAccountForm({ name: '', type: 'CASH', initialBalance: '0' }); await loadAccounts() }
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(movementForm) })
    const data = await response.json()
    setMessage(response.ok ? 'Movimiento financiero registrado.' : data.error ?? 'No se pudo registrar el movimiento.')
    if (response.ok) { setMovementForm((current) => ({ ...current, amount: '', description: '' })); await loadAccounts() }
  }

  async function removeAccount(id: string) {
    const confirmed = window.confirm('¿Deseas eliminar esta cuenta/banco?')
    if (!confirmed) return
    const response = await fetch(`/api/cash?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    setMessage(response.ok ? `Cuenta eliminada: ${data.name ?? 'ok'}` : data.error ?? 'No se pudo eliminar la cuenta.')
    if (response.ok) await loadAccounts()
  }

  const total = accounts.reduce((sum, account) => sum + Number(account.balance), 0)

  return <div className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">Finanzas · Bolivia</p><h1>Caja y bancos</h1><p className="muted">Saldos y movimientos financieros expresados en USD.</p></div><span className="currency-note">Saldo total: {money.format(total)}</span></div>{message && <p className="module-message">{message}</p>}<div className="module-stats">{accounts.map((account) => <div key={account.id}><span>{account.name}</span><strong>{money.format(Number(account.balance))}</strong><small>{account.type === 'CASH' ? 'Efectivo' : account.type === 'BANK' ? 'Banco' : 'POS'}</small><button className="outline-button" style={{ marginTop: 8 }} onClick={() => void removeAccount(account.id)}>Eliminar</button></div>)}</div><div className="main-grid"><form className="panel product-form" onSubmit={submitAccount}><h2>Nueva cuenta</h2><div className="product-form-grid"><label>Nombre<input required value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} placeholder="Ej. Banco BNB" /></label><label>Tipo<select value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })}><option value="CASH">Caja</option><option value="BANK">Banco</option><option value="POS">POS</option></select></label><label>Saldo inicial USD<input min="0" step="0.01" type="number" value={accountForm.initialBalance} onChange={(event) => setAccountForm({ ...accountForm, initialBalance: event.target.value })} /></label></div><button className="primary-button" type="submit"><Plus size={15} /> Crear cuenta</button></form><form className="panel product-form" onSubmit={submitMovement}><h2>Registrar movimiento</h2><div className="product-form-grid"><label>Cuenta<select required value={movementForm.accountId} onChange={(event) => setMovementForm({ ...movementForm, accountId: event.target.value })}><option value="">Selecciona una cuenta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Tipo<select value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value })}><option value="IN">Ingreso</option><option value="OUT">Egreso</option></select></label><label>Monto USD<input required min="0.01" step="0.01" type="number" value={movementForm.amount} onChange={(event) => setMovementForm({ ...movementForm, amount: event.target.value })} /></label><label>Descripción<input required value={movementForm.description} onChange={(event) => setMovementForm({ ...movementForm, description: event.target.value })} placeholder="Ej. pago de servicio" /></label></div><button className="primary-button" type="submit"><WalletCards size={15} /> Guardar movimiento</button></form></div><article className="panel module-table"><div className="table-scroll"><table><thead><tr><th>Cuenta</th><th>Tipo</th><th>Saldo USD</th><th>Estado</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><div className="product-cell"><span className="product-thumb"><Building2 size={16} /></span><strong>{account.name}</strong></div></td><td>{account.type === 'CASH' ? 'Caja' : account.type === 'BANK' ? 'Banco' : 'POS'}</td><td><strong>{money.format(Number(account.balance))}</strong></td><td><span className="status success"><i />Activa</span></td></tr>)}</tbody></table></div></article></div>
}
