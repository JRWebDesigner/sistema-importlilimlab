'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ArrowDownRight, CircleDollarSign } from 'lucide-react'

type Receivable = { id: string; number: string; status: string; originalAmount: string; paidAmount: string; balance: string; dueDate: string; customer: { name: string; document: string }; sale: { number: string } }
type Account = { id: string; name: string; balance: string }
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function ReceivablesModule() {
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState('')
  const [form, setForm] = useState({ cashAccountId: '', paymentMethod: 'CASH', amount: '' })
  const [message, setMessage] = useState('')

  async function load() {
    const [receivableResponse, accountResponse] = await Promise.all([fetch('/api/receivables'), fetch('/api/cash')])
    setReceivables(await receivableResponse.json())
    const accountData = await accountResponse.json()
    setAccounts(accountData)
    setForm((current) => ({ ...current, cashAccountId: current.cashAccountId || accountData[0]?.id || '' }))
  }

  useEffect(() => { void load() }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/receivables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, receivableId: selected }) })
    const data = await response.json()
    setMessage(response.ok ? `Pago ${data.reference} registrado en caja.` : data.error ?? 'No se pudo registrar el pago.')
    if (response.ok) { setSelected(''); setForm((current) => ({ ...current, amount: '' })); await load() }
  }

  const pending = receivables.filter((item) => item.status !== 'PAID').reduce((sum, item) => sum + Number(item.balance), 0)

  return <div className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">Finanzas · Bolivia</p><h1>Cuentas por cobrar</h1><p className="muted">Saldos pendientes en USD y cobros aplicados a Caja/Bancos.</p></div><span className="currency-note">Pendiente: {money.format(pending)}</span></div>{message && <p className="module-message">{message}</p>}<form className="panel product-form" onSubmit={handleSubmit}><div className="product-form-grid"><label>Cuenta pendiente<select required value={selected} onChange={(event) => { setSelected(event.target.value); const item = receivables.find((row) => row.id === event.target.value); setForm((current) => ({ ...current, amount: item?.balance ?? '' })) }}><option value="">Selecciona una cuenta</option>{receivables.filter((item) => item.status !== 'PAID').map((item) => <option key={item.id} value={item.id}>{item.customer.name} · {money.format(Number(item.balance))}</option>)}</select></label><label>Cuenta que recibe<select required value={form.cashAccountId} onChange={(event) => setForm({ ...form, cashAccountId: event.target.value })}><option value="">Selecciona una cuenta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {money.format(Number(account.balance))}</option>)}</select></label><label>Medio de pago<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option value="CASH">Efectivo</option><option value="BANK_TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option><option value="QR">QR</option></select></label><label>Monto USD<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label></div><button className="primary-button" type="submit"><CircleDollarSign size={15} /> Registrar pago</button></form><article className="panel module-table"><div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Venta</th><th>Vencimiento</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>{receivables.length === 0 ? <tr><td colSpan={7}>No hay cuentas por cobrar.</td></tr> : receivables.map((item) => <tr key={item.id}><td><div className="product-cell"><span className="product-thumb"><ArrowDownRight size={16} /></span><div><strong>{item.customer.name}</strong><small>{item.customer.document}</small></div></div></td><td>{item.sale.number}</td><td>{new Date(item.dueDate).toLocaleDateString('es-BO')}</td><td>{money.format(Number(item.originalAmount))}</td><td>{money.format(Number(item.paidAmount))}</td><td><strong>{money.format(Number(item.balance))}</strong></td><td><span className={`status ${item.status === 'PAID' ? 'success' : item.status === 'OVERDUE' ? 'warning' : 'success'}`}><i />{item.status === 'PARTIAL' ? 'Parcial' : item.status === 'PAID' ? 'Pagada' : item.status === 'OVERDUE' ? 'Vencida' : 'Pendiente'}</span></td></tr>)}</tbody></table></div></article></div>
}
