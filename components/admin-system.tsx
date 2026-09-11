'use client'

import { useMemo, useState } from 'react'
import ProductsModule from './products-module'
import CustomersModule from './customers-module'
import SalesModule from './sales-module'
import InventoryModule from './inventory-module'
import CashModule from './cash-module'
import ReceivablesModule from './receivables-module'
import SuppliersModule from './suppliers-module'
import PayablesModule from './payables-module'
import UsersModule from './users-module'
import DashboardLive from './dashboard-live'
import PurchasesModule from './purchases-module'
import ReportsModule from './reports-module'
import ProformasModule from './proformas-module'
import AuditModule from './audit-module'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tags,
  TrendingUp,
  Truck,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react'

const navGroups = [
  { label: 'Principal', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Operaciones', items: [
    { id: 'ventas', label: 'Ventas', icon: ShoppingCart, badge: '12' },
    { id: 'proformas', label: 'Proformas', icon: FileText },
    { id: 'productos', label: 'Productos', icon: Package },
    { id: 'categorias', label: 'Categorías', icon: Tags },
    { id: 'inventario', label: 'Inventario', icon: Boxes, badge: '3' },
  ] },
  { label: 'Contactos', items: [
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
  ] },
  { label: 'Finanzas', items: [
    { id: 'compras', label: 'Compras', icon: ClipboardList },
    { id: 'caja', label: 'Caja y bancos', icon: WalletCards },
    { id: 'cxc', label: 'Cuentas por cobrar', icon: ArrowDownRight, badge: '5' },
    { id: 'cxp', label: 'Cuentas por pagar', icon: ArrowUpRight },
  ] },
  { label: 'Análisis', items: [
    { id: 'reportes', label: 'Reportes', icon: BarChart3 },
    { id: 'auditoria', label: 'Auditoría', icon: ShieldCheck },
    { id: 'usuarios', label: 'Usuarios y roles', icon: UserRound },
  ] },
]

const chartData = [
  { month: 'Ene', value: 58 }, { month: 'Feb', value: 72 }, { month: 'Mar', value: 64 },
  { month: 'Abr', value: 86 }, { month: 'May', value: 78 }, { month: 'Jun', value: 94 },
  { month: 'Jul', value: 82 }, { month: 'Ago', value: 98 }, { month: 'Sep', value: 88 },
  { month: 'Oct', value: 100 }, { month: 'Nov', value: 91 }, { month: 'Dic', value: 76 },
]

const products = [
  { name: 'Laptop Lenovo ThinkPad E14', sku: 'TEC-001', category: 'Tecnología', stock: 8, price: '$ 2,899.00', status: 'Bajo stock' },
  { name: 'Monitor LG UltraWide 29”', sku: 'TEC-008', category: 'Tecnología', stock: 24, price: '$ 1,249.00', status: 'Disponible' },
  { name: 'Silla Ergonómica Office Pro', sku: 'MUE-014', category: 'Mobiliario', stock: 4, price: '$ 689.00', status: 'Bajo stock' },
  { name: 'Pack papel bond A4 x 500', sku: 'OFI-022', category: 'Oficina', stock: 156, price: '$ 18.50', status: 'Disponible' },
]

const activity = [
  { icon: ShoppingCart, title: 'Nueva venta registrada', detail: 'Venta #V-1048 · María Torres', amount: '+ $ 1,249.00', time: 'Hace 8 min', tone: 'green' },
  { icon: Truck, title: 'Compra recibida', detail: 'Orden #C-0231 · TechDistribuye SAC', amount: '$ 8,430.00', time: 'Hace 42 min', tone: 'blue' },
  { icon: CircleDollarSign, title: 'Pago recibido', detail: 'Factura #F-0892 · Carlos Mendoza', amount: '+ $ 580.00', time: 'Hace 1 h', tone: 'purple' },
  { icon: AlertTriangle, title: 'Stock bajo', detail: 'Silla Ergonómica Office Pro', amount: '4 unidades', time: 'Hace 2 h', tone: 'amber' },
]

const moduleCopy: Record<string, { title: string; description: string; action: string; icon: typeof Package }> = {
  ventas: { title: 'Ventas', description: 'Gestiona tus ventas y comprobantes emitidos.', action: 'Nueva venta', icon: ShoppingCart },
  proformas: { title: 'Proformas', description: 'Cotizaciones pendientes y convertidas.', action: 'Nueva proforma', icon: FileText },
  productos: { title: 'Productos', description: 'Catálogo, precios y niveles de stock.', action: 'Nuevo producto', icon: Package },
  categorias: { title: 'Categorías', description: 'Organiza tu catálogo de productos.', action: 'Nueva categoría', icon: Tags },
  inventario: { title: 'Inventario', description: 'Movimientos y disponibilidad por almacén.', action: 'Registrar movimiento', icon: Boxes },
  clientes: { title: 'Clientes', description: 'Directorio de clientes y saldos.', action: 'Nuevo cliente', icon: Users },
  proveedores: { title: 'Proveedores', description: 'Contactos y órdenes de compra.', action: 'Nuevo proveedor', icon: Truck },
  compras: { title: 'Compras', description: 'Órdenes de compra y recepción.', action: 'Nueva compra', icon: ClipboardList },
  caja: { title: 'Caja y bancos', description: 'Control de movimientos y saldos.', action: 'Registrar movimiento', icon: WalletCards },
  cxc: { title: 'Cuentas por cobrar', description: 'Seguimiento de facturas pendientes.', action: 'Registrar pago', icon: ArrowDownRight },
  cxp: { title: 'Cuentas por pagar', description: 'Obligaciones pendientes con proveedores.', action: 'Registrar pago', icon: ArrowUpRight },
  reportes: { title: 'Reportes', description: 'Indicadores y reportes del negocio.', action: 'Exportar reporte', icon: BarChart3 },
  auditoria: { title: 'Auditoría', description: 'Historial de cambios, accesos y acciones del equipo.', action: 'Ver historial', icon: ShieldCheck },
  usuarios: { title: 'Usuarios y roles', description: 'Gestiona accesos y permisos del equipo.', action: 'Nuevo usuario', icon: UserRound },
}

function KpiCard({ label, value, change, icon: Icon, tone }: { label: string; value: string; change: string; icon: typeof TrendingUp; tone: string }) {
  return <article className="kpi-card">
    <div className={`kpi-icon ${tone}`}><Icon size={19} /></div>
    <div className="kpi-info"><span>{label}</span><strong>{value}</strong><small className={change.startsWith('-') ? 'negative' : ''}>{change.startsWith('-') ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{change} <em>vs. mes anterior</em></small></div>
  </article>
}

function Dashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  return <DashboardLive onNavigate={onNavigate} />

  return <div className="dashboard-content">
    <div className="page-heading"><div><p className="eyebrow">Resumen general</p><h1>Buenos días, Fernando</h1><p className="muted">Aquí tienes un resumen de lo que ocurre en tu negocio.</p></div><div className="heading-actions"><button className="date-button"><CalendarDays size={16} /> 01 Sep — 30 Sep 2024 <ChevronDown size={14} /></button><button className="primary-button" onClick={() => onNavigate('ventas')}><Plus size={17} /> Nueva venta</button></div></div>
    <section className="kpi-grid"><KpiCard label="Ventas del mes" value="$ 48,290.00" change="18.4%" icon={TrendingUp} tone="green" /><KpiCard label="Ganancia neta" value="$ 12,480.50" change="12.8%" icon={CircleDollarSign} tone="blue" /><KpiCard label="Cuentas por cobrar" value="$ 8,645.00" change="-4.2%" icon={ArrowDownRight} tone="purple" /><KpiCard label="Valor inventario" value="$ 96,240.00" change="6.7%" icon={Boxes} tone="orange" /></section>
    <section className="main-grid"><article className="panel sales-panel"><div className="panel-header"><div><h2>Resumen de ventas</h2><p>Ventas netas durante el año</p></div><div className="legend"><span><i className="legend-dot primary-dot" />Ventas</span><span><i className="legend-dot muted-dot" />Ganancia</span></div></div><div className="chart-wrap"><div className="y-labels"><span>$ 12k</span><span>$ 8k</span><span>$ 4k</span><span>$ 0</span></div><div className="chart"><div className="grid-lines"><i /><i /><i /><i /></div><div className="bars">{chartData.map((item) => <div className="bar-group" key={item.month}><div className="bar-value" style={{ height: `${item.value}%` }}><b /></div><span>{item.month}</span></div>)}</div></div></div></article><article className="panel summary-panel"><div className="panel-header"><div><h2>Resumen de caja</h2><p>Estado actual de tus cuentas</p></div><button className="icon-button" aria-label="Más opciones"><SlidersHorizontal size={16} /></button></div><div className="cash-total"><span>Saldo total</span><strong>$ 32,840.00</strong><small><ArrowUpRight size={13} /> 8.2% este mes</small></div><div className="cash-list"><div><span className="cash-icon wallet"><WalletCards size={15} /></span><label>Caja principal <b>$ 12,450.00</b></label><small>42.1%</small></div><div><span className="cash-icon bank"><Building2 size={15} /></span><label>Banco BCP <b>$ 18,940.00</b></label><small>51.7%</small></div><div><span className="cash-icon card"><CreditCard size={15} /></span><label>Tarjeta POS <b>$ 1,450.00</b></label><small>6.2%</small></div></div></article></section>
    <section className="lower-grid"><article className="panel"><div className="panel-header"><div><h2>Productos con stock bajo</h2><p>Requieren atención para evitar quiebres</p></div><button className="text-button" onClick={() => onNavigate('inventario')}>Ver inventario <ChevronRight size={15} /></button></div><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Stock actual</th><th>Precio</th><th>Estado</th></tr></thead><tbody>{products.map((product) => <tr key={product.sku}><td><div className="product-cell"><span className="product-thumb"><Package size={16} /></span><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td>{product.category}</td><td><strong className={product.stock < 10 ? 'stock-low' : ''}>{product.stock} <small>unid.</small></strong></td><td>{product.price}</td><td><span className={`status ${product.stock < 10 ? 'warning' : 'success'}`}><i />{product.status}</span></td></tr>)}</tbody></table></div></article><article className="panel activity-panel"><div className="panel-header"><div><h2>Actividad reciente</h2><p>Últimos movimientos registrados</p></div><button className="icon-button" aria-label="Ver notificaciones"><Bell size={16} /></button></div><div className="activity-list">{activity.map((item) => <div className="activity-item" key={item.title}><span className={`activity-icon ${item.tone}`}><item.icon size={15} /></span><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.time}</small></div><b className={item.amount.startsWith('+') ? 'amount-positive' : ''}>{item.amount}</b></div>)}</div><button className="activity-footer">Ver toda la actividad <ChevronRight size={15} /></button></article></section>
  </div>
}

function ModuleView({ id, onAction }: { id: string; onAction: () => void }) {
  const copy = moduleCopy[id] ?? moduleCopy.productos
  const Icon = copy.icon
  const [query, setQuery] = useState('')
  if (id === 'productos') return <ProductsModule />
  if (id === 'clientes') return <CustomersModule />
  if (id === 'ventas') return <SalesModule />
  if (id === 'proformas') return <ProformasModule />
  if (id === 'inventario') return <InventoryModule />
  if (id === 'caja') return <CashModule />
  if (id === 'cxc') return <ReceivablesModule />
  if (id === 'proveedores') return <SuppliersModule />
  if (id === 'compras') return <PurchasesModule />
  if (id === 'cxp') return <PayablesModule />
  if (id === 'reportes') return <ReportsModule />
  if (id === 'auditoria') return <AuditModule />
  if (id === 'usuarios') return <UsersModule />
  const rows = id === 'clientes' ? [['María Torres', 'DNI 70884521', '12 compras', '$ 1,249.00'], ['Carlos Mendoza', 'DNI 45678321', '8 compras', '$ 580.00'], ['Inversiones Andinas SAC', 'RUC 20543891231', '24 compras', '$ 3,845.00'], ['Lucía Ramírez', 'DNI 74221890', '5 compras', '$ 0.00']] : id === 'proveedores' ? [['TechDistribuye SAC', 'RUC 20483910221', 'Tecnología', '$ 8,430.00'], ['OfiMarket Perú', 'RUC 20678129011', 'Oficina', '$ 2,180.00'], ['Muebles & Diseño', 'RUC 20555123991', 'Mobiliario', '$ 4,640.00'], ['Logística Express', 'RUC 20671122001', 'Servicios', '$ 920.00']] : products.map((p) => [p.name, p.sku, p.category, p.price])
  const filtered = rows.filter((row) => row.join(' ').toLowerCase().includes(query.toLowerCase()))
  return <div className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">Gestión</p><h1>{copy.title}</h1><p className="muted">{copy.description}</p></div><button className="primary-button" onClick={onAction}><Plus size={17} /> {copy.action}</button></div><div className="module-stats"><div><span>Registros totales</span><strong>248</strong><small>+12 este mes</small></div><div><span>Activos</span><strong>224</strong><small>90.3% del total</small></div><div><span>Por revisar</span><strong className="warning-text">12</strong><small>Requieren atención</small></div><div><span>Última actualización</span><strong>Hoy, 10:42</strong><small>Sincronizado</small></div></div><article className="panel module-table"><div className="module-toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar ${copy.title.toLowerCase()}...`} /></div><button className="outline-button"><SlidersHorizontal size={15} /> Filtrar</button><button className="outline-button">Exportar</button></div><div className="table-scroll"><table><thead><tr><th>Nombre / descripción</th><th>Identificador</th><th>Clasificación</th><th>Valor / detalle</th><th>Estado</th><th /></tr></thead><tbody>{filtered.map((row, index) => <tr key={row[1]}><td><div className="product-cell"><span className="product-thumb"><Icon size={16} /></span><div><strong>{row[0]}</strong><small>Actualizado hace {index + 1} h</small></div></div></td><td>{row[1]}</td><td>{row[2]}</td><td><strong>{row[3]}</strong></td><td><span className="status success"><i />Activo</span></td><td><button className="row-menu" aria-label="Más acciones"><ChevronDown size={15} /></button></td></tr>)}</tbody></table></div></article></div>
}

export default function AdminSystem() {
  const [active, setActive] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toast, setToast] = useState('')
  const title = active === 'dashboard' ? 'Dashboard' : moduleCopy[active]?.title ?? 'Dashboard'
  const handleAction = () => { setToast(active === 'dashboard' ? 'Venta iniciada correctamente' : 'Acción preparada para completar'); setTimeout(() => setToast(''), 2800) }
  const handleLogout = async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/login' }
  return <div className="admin-shell"><aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}><div className="brand"><span className="brand-mark"><Store size={19} /></span><span className="brand-name">Import<span>lilimlab</span></span><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={18} /></button></div><nav>{navGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map((item) => <button key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => { setActive(item.id); setMobileOpen(false) }} title={collapsed ? item.label : undefined}><item.icon size={17} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>)}</div>)}</nav><div className="sidebar-bottom"><button className="nav-item" onClick={() => setToast('Configuración próximamente')}><Settings size={17} /><span>Configuración</span></button><div className="user-card"><span className="avatar">FG</span><div><strong>Fernando García</strong><small>Administrador</small></div><ChevronDown size={14} /></div></div></aside><main className={`main-area ${collapsed ? 'expanded' : ''}`}><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button><div className="breadcrumbs"><span>Inicio</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="topbar-actions"><button className="icon-button notification" aria-label="Notificaciones"><Bell size={18} /><i /></button><span className="topbar-divider" /><div className="top-profile"><span className="avatar small">FG</span><span>Fernando García</span><ChevronDown size={14} /></div><button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Contraer menú">{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button></div></header>{active === 'dashboard' ? <Dashboard onNavigate={setActive} /> : <ModuleView id={active} onAction={handleAction} />}</main>{toast && <div className="toast"><Activity size={16} /> {toast}</div>}</div>
}
