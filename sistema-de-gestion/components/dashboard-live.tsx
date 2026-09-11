'use client'

import { useEffect, useState } from 'react'
import { Boxes, Building2, CircleDollarSign, CreditCard, LogOut, Package, WalletCards } from 'lucide-react'

type DashboardData = {
  kpis: { sales: string; profit: string; receivables: string; inventory: string; salesChange: string }
  chart: { month: string; value: number }[]
  accounts: { name: string; type: string; balance: string }[]
  lowStock: { name: string; sku: string; category: string; stock: number; price: string }[]
  movements: { type: string; product: string; sku: string; quantity: number; time: string }[]
}

const money = (value: string) => `$ ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

export default function DashboardLive({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dashboard').then(async (response) => {
      if (!response.ok) throw new Error('No se pudo cargar el dashboard.')
      return response.json()
    }).then(setData).catch((reason: Error) => setError(reason.message))
  }, [])

  if (error) return <div className="dashboard-content"><p className="module-message">{error}</p></div>
  if (!data) return <div className="dashboard-content"><p className="muted">Cargando indicadores reales...</p></div>

  const maxChart = Math.max(...data.chart.map((item) => item.value), 1)
  const totalCash = data.accounts.reduce((sum, account) => sum + Number(account.balance), 0)

  return <div className="dashboard-content">
    <div className="page-heading"><div><p className="eyebrow">Resumen general · Bolivia</p><h1>Dashboard</h1><p className="muted">Indicadores calculados desde PostgreSQL en USD.</p></div><div className="heading-actions"><button className="primary-button" onClick={() => onNavigate('ventas')}>Nueva venta</button><button className="outline-button" onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/login' }}><LogOut size={15} /> Cerrar sesión</button></div></div>
    <section className="kpi-grid"><Kpi label="Ventas del mes" value={money(data.kpis.sales)} detail={data.kpis.salesChange} tone="green" /><Kpi label="Ganancia estimada" value={money(data.kpis.profit)} detail="Real" tone="blue" /><Kpi label="Cuentas por cobrar" value={money(data.kpis.receivables)} detail="Pendiente" tone="purple" /><Kpi label="Valor inventario" value={money(data.kpis.inventory)} detail="A costo" tone="orange" /></section>
    <section className="main-grid"><article className="panel sales-panel"><div className="panel-header"><div><h2>Ventas del año</h2><p>Totales mensuales desde PostgreSQL</p></div></div><div className="chart-wrap"><div className="chart"><div className="grid-lines"><i /><i /><i /><i /></div><div className="bars">{data.chart.map((item) => <div className="bar-group" key={item.month}><div className="bar-value" style={{ height: `${Math.max((item.value / maxChart) * 100, 3)}%` }}><b /></div><span>{item.month}</span></div>)}</div></div></div></article><article className="panel summary-panel"><div className="panel-header"><div><h2>Resumen de caja</h2><p>Saldos actuales</p></div></div><div className="cash-total"><span>Total en cuentas</span><strong>{money(totalCash.toFixed(2))}</strong></div><div className="cash-list">{data.accounts.length === 0 ? <p className="muted">No hay cuentas registradas.</p> : data.accounts.map((account) => <div key={account.name}><span className="cash-icon wallet"><AccountIcon type={account.type} /></span><label>{account.name}<b>{money(account.balance)}</b></label></div>)}</div></article></section>
    <section className="lower-grid"><article className="panel"><div className="panel-header"><div><h2>Stock bajo</h2><p>Productos que requieren reposición</p></div><button className="text-button" onClick={() => onNavigate('inventario')}>Ver inventario</button></div><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Precio</th></tr></thead><tbody>{data.lowStock.length === 0 ? <tr><td colSpan={4}>No hay productos bajo el mínimo.</td></tr> : data.lowStock.map((product) => <tr key={product.sku}><td><div className="product-cell"><span className="product-thumb"><Package size={16} /></span><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td>{product.category}</td><td><strong className="stock-low">{product.stock}</strong></td><td>{money(product.price)}</td></tr>)}</tbody></table></div></article><article className="panel activity-panel"><div className="panel-header"><div><h2>Movimientos recientes</h2><p>Últimas entradas y salidas</p></div></div><div className="activity-list">{data.movements.length === 0 ? <p className="muted">No hay movimientos registrados.</p> : data.movements.map((movement) => <div className="activity-item" key={`${movement.sku}-${movement.time}`}><span className="activity-icon blue"><Boxes size={15} /></span><div><strong>{movement.product}</strong><p>{movement.type} · {movement.sku}</p><small>{new Date(movement.time).toLocaleString('es-BO')}</small></div><b>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</b></div>)}</div></article></section>
  </div>
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><CircleDollarSign size={19} /></div><div className="kpi-info"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article> }
function AccountIcon({ type }: { type: string }) { return type === 'BANK' ? <Building2 size={15} /> : type === 'POS' ? <CreditCard size={15} /> : <WalletCards size={15} /> }
