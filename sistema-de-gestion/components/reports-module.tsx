'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, Search } from 'lucide-react'

type ReportType = 'ventas' | 'compras' | 'clientes' | 'cxc' | 'cxp' | 'inventario' | 'proveedores'

type TableRow = {
  [key: string]: string | number | boolean | null
}

const money = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0)
  return `$ ${Number.isFinite(numeric) ? numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`
}

const labels: Record<ReportType, string> = {
  ventas: 'Ventas',
  compras: 'Compras',
  clientes: 'Clientes',
  cxc: 'Cuentas por cobrar',
  cxp: 'Cuentas por pagar',
  inventario: 'Inventario',
  proveedores: 'Proveedores',
}

const reportOptions: Array<{ value: ReportType; label: string }> = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'compras', label: 'Compras' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'cxc', label: 'Cuentas por cobrar' },
  { value: 'cxp', label: 'Cuentas por pagar' },
  { value: 'inventario', label: 'Inventario' },
  { value: 'proveedores', label: 'Proveedores' },
]

export default function ReportsModule() {
  const [reportType, setReportType] = useState<ReportType>('ventas')
  const [rows, setRows] = useState<TableRow[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [salesSummary, setSalesSummary] = useState({ receivables: 0, cash: 0 })

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')

      try {
        let response: Response
        switch (reportType) {
          case 'ventas':
            response = await fetch('/api/sales')
            break
          case 'compras':
            response = await fetch('/api/purchases')
            break
          case 'clientes':
            response = await fetch('/api/customers')
            break
          case 'cxc':
            response = await fetch('/api/receivables')
            break
          case 'cxp':
            response = await fetch('/api/payables')
            break
          case 'inventario':
            response = await fetch('/api/inventory')
            break
          case 'proveedores':
            response = await fetch('/api/suppliers')
            break
          default:
            response = await fetch('/api/dashboard')
        }

        if (!response.ok) throw new Error('No se pudo cargar el reporte solicitado.')
        const data = await response.json()

        if (!active) return

        const normalized = normalizeRows(reportType, data)
        setColumns(normalized.columns)
        setRows(normalized.rows)
      } catch (reason) {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'No se pudo cargar el reporte.')
        setRows([])
        setColumns([])
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [reportType])

  useEffect(() => {
    if (reportType !== 'ventas') {
      setSalesSummary({ receivables: 0, cash: 0 })
      return
    }

    let active = true
    async function loadSummary() {
      try {
        const [receivablesResponse, cashResponse] = await Promise.all([
          fetch('/api/receivables'),
          fetch('/api/cash'),
        ])

        if (!receivablesResponse.ok || !cashResponse.ok) throw new Error('No se pudo cargar el resumen financiero.')

        const receivablesData = await receivablesResponse.json()
        const cashData = await cashResponse.json()

        if (!active) return

        const receivablesTotal = Array.isArray(receivablesData)
          ? receivablesData.reduce((sum: number, item: any) => sum + Number(item.balance ?? 0), 0)
          : 0
        const cashTotal = Array.isArray(cashData)
          ? cashData.reduce((sum: number, item: any) => sum + Number(item.balance ?? 0), 0)
          : 0

        setSalesSummary({ receivables: receivablesTotal, cash: cashTotal })
      } catch {
        if (active) setSalesSummary({ receivables: 0, cash: 0 })
      }
    }

    void loadSummary()
    return () => {
      active = false
    }
  }, [reportType])

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(keyword)))
  }, [rows, query])

  const totalGeneral = useMemo(() => getTotalGeneral(filteredRows), [filteredRows])
  const totalCollectible = useMemo(() => salesSummary.receivables + salesSummary.cash, [salesSummary])

  const exportTable = (format: 'csv' | 'excel' | 'pdf') => {
    const sourceRows = filteredRows.length > 0 ? filteredRows : rows
    if (sourceRows.length === 0) return

    const summaryRows = reportType === 'ventas'
      ? [
          ['Resumen financiero', ''],
          ['Clientes por cobrar', money(salesSummary.receivables)],
          ['Dinero disponible', money(salesSummary.cash)],
          ['Total al cobrar', money(salesSummary.receivables + salesSummary.cash)],
        ]
      : []

    if (format === 'pdf') {
      const printable = window.open('', '_blank', 'width=1200,height=900')
      if (!printable) {
        setError('El navegador bloqueó la ventana de impresión del PDF. Permite las ventanas emergentes e inténtalo otra vez.')
        return
      }

      printable.document.write(`<!doctype html><html><head><title>${labels[reportType]}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111827}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #d1d5db;padding:8px 10px;text-align:left;font-size:12px}th{background:#f3f4f6}h2{margin:0 0 8px}p{margin:0 0 16px;color:#4b5563}.summary{margin-top:20px} .summary td:first-child{font-weight:700}</style></head><body><h2>${labels[reportType]}</h2><p>Reporte generado desde el sistema.</p>${renderTableHtml(columns, sourceRows, summaryRows)}</body></html>`)
      printable.document.close()
      printable.focus()
      setTimeout(() => {
        try {
          printable.print()
        } catch {
          setError('No se pudo abrir la impresión del PDF. Intenta nuevamente.')
        }
      }, 250)
      return
    }

    const content = buildExportContent(columns, sourceRows, format, summaryRows)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${labels[reportType].toLowerCase().replace(/\s+/g, '-')}.${format === 'excel' ? 'xls' : format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Análisis · Bolivia</p>
          <h1>Reportes</h1>
          <p className="muted">Consulta los datos por tipo de reporte y filtra la información.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div className="module-toolbar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ minWidth: 220 }}>
            Tipo de reporte
            <select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)} style={{ display: 'block', width: '100%', marginTop: 6 }}>
              {reportOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="search-box" style={{ flex: 1, minWidth: 220 }}>
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Filtrar ${labels[reportType].toLowerCase()}...`}
            />
          </div>

          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button className="outline-button" type="button" onClick={() => exportTable('csv')}><Download size={15} /> CSV</button>
            <button className="outline-button" type="button" onClick={() => exportTable('excel')}><Download size={15} /> Excel</button>
            <button className="outline-button" type="button" onClick={() => exportTable('pdf')}><FileText size={15} /> PDF</button>
          </div>
        </div>
      </div>

      {error && <p className="module-message">{error}</p>}

      <article className="panel module-table">
        <div className="table-scroll">
          {loading ? (
            <p className="muted" style={{ padding: '1rem' }}>Cargando reporte...</p>
          ) : columns.length === 0 ? (
            <p className="muted" style={{ padding: '1rem' }}>No hay datos para este reporte.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>No hay coincidencias para este filtro.</td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={`${reportType}-${index}`}>
                      {columns.map((column) => (
                        <td key={`${reportType}-${index}-${column}`}>{formatCell(row[column])}</td>
                      ))}
                    </tr>
                  ))
                )}
                {filteredRows.length > 0 && (
                  <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
                    <td colSpan={Math.max(columns.length - 1, 1)} style={{ textAlign: 'right' }}>Total general</td>
                    <td>{totalGeneral}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {reportType === 'ventas' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
              <div className="panel" style={{ padding: '0.75rem 0.9rem', background: '#f9fafb' }}>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Clientes por cobrar</div>
                <strong style={{ fontSize: 20 }}>{money(salesSummary.receivables)}</strong>
              </div>
              <div className="panel" style={{ padding: '0.75rem 0.9rem', background: '#f9fafb' }}>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Dinero disponible</div>
                <strong style={{ fontSize: 20 }}>{money(salesSummary.cash)}</strong>
              </div>
              <div className="panel" style={{ padding: '0.75rem 0.9rem', background: '#ecfdf5' }}>
                <div style={{ color: '#047857', fontSize: 12 }}>Total al cobrar</div>
                <strong style={{ fontSize: 20, color: '#047857' }}>{money(totalCollectible)}</strong>
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}

function normalizeRows(reportType: ReportType, data: unknown): { columns: string[]; rows: TableRow[] } {
  if (reportType === 'ventas') {
    const sales = Array.isArray(data) ? data : []
    const columns = ['Venta', 'Cliente', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal', 'IVA', 'Total venta', 'Saldo pendiente', 'Fecha', 'Método', 'Estado']
    const rows: TableRow[] = []

    for (const sale of sales) {
      const saleItems = Array.isArray(sale.items) && sale.items.length > 0 ? sale.items : [{
        product: { name: 'Sin producto' },
        quantity: 0,
        unitPrice: sale.total ?? 0,
        lineTotal: sale.total ?? 0,
      }]

      const subtotalSale = Number(sale.subtotal ?? 0)
      const taxAmount = Number(sale.taxAmount ?? 0)
      const saleTotal = Number(sale.total ?? 0)
      const balancePendiente = sale.paymentMethod === 'CREDIT'
        ? Number(sale?.receivable?.balance ?? 0)
        : 0

      for (const item of saleItems) {
        rows.push({
          Venta: sale.number ?? sale.id ?? '-',
          Cliente: sale.customer?.name ?? 'Consumidor final',
          Producto: item.product?.name ?? item.name ?? 'Sin producto',
          Cantidad: Number(item.quantity ?? 0),
          'Precio unitario': Number(item.unitPrice ?? item.price ?? 0),
          Subtotal: Number(item.lineTotal ?? subtotalSale ?? 0),
          IVA: taxAmount,
          'Total venta': saleTotal,
          'Saldo pendiente': balancePendiente,
          Fecha: sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('es-BO') : '-',
          Método: translatePaymentMethod(sale.paymentMethod),
          Estado: translateSaleStatus(sale),
        })
      }
    }

    return { columns, rows }
  }

  if (reportType === 'compras') {
    const purchases = Array.isArray(data) ? data : []
    const columns = ['Número', 'Proveedor', 'Fecha', 'Método', 'Total']
    const rows = purchases.map((purchase: any) => ({
      Número: purchase.number ?? purchase.id ?? '-',
      Proveedor: purchase.supplier?.name ?? 'Sin proveedor',
      Fecha: purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString('es-BO') : '-',
      Método: purchase.paymentMethod ?? '-',
      Total: Number(purchase.total ?? 0),
    }))
    return { columns, rows }
  }

  if (reportType === 'clientes') {
    const customers = Array.isArray(data) ? data : []
    const columns = ['Nombre', 'Documento', 'Tipo', 'Correo', 'Estado']
    const rows = customers.map((customer: any) => ({
      Nombre: customer.name ?? '-',
      Documento: customer.document ?? '-',
      Tipo: customer.type ?? 'PERSON',
      Correo: customer.email ?? 'Sin correo',
      Estado: customer.isActive === false ? 'Inactivo' : 'Activo',
    }))
    return { columns, rows }
  }

  if (reportType === 'cxc') {
    const receivables = Array.isArray(data) ? data : []
    const columns = ['Número', 'Cliente', 'Vence', 'Saldo', 'Estado']
    const rows = receivables.map((receivable: any) => ({
      Número: receivable.number ?? receivable.id ?? '-',
      Cliente: receivable.customer?.name ?? 'Sin cliente',
      Vence: receivable.dueDate ? new Date(receivable.dueDate).toLocaleDateString('es-BO') : '-',
      Saldo: Number(receivable.balance ?? 0),
      Estado: translateStatus(receivable.status),
    }))
    return { columns, rows }
  }

  if (reportType === 'cxp') {
    const payables = Array.isArray(data) ? data : []
    const columns = ['Número', 'Proveedor', 'Vence', 'Saldo', 'Estado']
    const rows = payables.map((payable: any) => ({
      Número: payable.number ?? payable.id ?? '-',
      Proveedor: payable.supplier?.name ?? 'Sin proveedor',
      Vence: payable.dueDate ? new Date(payable.dueDate).toLocaleDateString('es-BO') : '-',
      Saldo: Number(payable.balance ?? 0),
      Estado: translateStatus(payable.status),
    }))
    return { columns, rows }
  }

  if (reportType === 'inventario') {
    const products = Array.isArray(data) ? data : []
    const columns = ['Producto', 'SKU', 'Categoría', 'Stock', 'Precio', 'Mínimo']
    const rows = products.map((product: any) => ({
      Producto: product.name ?? '-',
      SKU: product.sku ?? '-',
      Categoría: product.category?.name ?? product.categoryName ?? '-',
      Stock: Number(product.currentStock ?? 0),
      Precio: Number(product.price ?? 0),
      Mínimo: Number(product.minimumStock ?? 0),
    }))
    return { columns, rows }
  }

  const suppliers = Array.isArray(data) ? data : []
  const columns = ['Proveedor', 'Documento', 'Correo', 'Teléfono', 'Estado']
  const rows = suppliers.map((supplier: any) => ({
    Proveedor: supplier.name ?? '-',
    Documento: supplier.document ?? '-',
    Correo: supplier.email ?? 'Sin correo',
    Teléfono: supplier.phone ?? 'Sin teléfono',
    Estado: supplier.isActive === false ? 'Inactivo' : 'Activo',
  }))
  return { columns, rows }
}

function translateSaleStatus(sale: { paymentMethod?: string | null; status?: string | null }) {
  if (String(sale.paymentMethod ?? '').toUpperCase() === 'CREDIT') return 'Crédito pendiente'
  const status = String(sale.status ?? '').toUpperCase()
  const map: Record<string, string> = {
    COMPLETED: 'Completada',
    PENDING: 'Pendiente',
    PARTIAL: 'Parcial',
    PAID: 'Pagada',
    OVERDUE: 'Vencida',
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
  }
  return (map[status] ?? status) || 'Sin estado'
}

function translateStatus(value: string | null | undefined) {
  const status = String(value ?? '').toUpperCase()
  const map: Record<string, string> = {
    COMPLETED: 'Completada',
    PENDING: 'Pendiente',
    PARTIAL: 'Parcial',
    PAID: 'Pagada',
    OVERDUE: 'Vencida',
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    CASH: 'Efectivo',
  }
  return (map[status] ?? status) || 'Sin estado'
}

function translatePaymentMethod(value: string | null | undefined) {
  const method = String(value ?? '').toUpperCase()
  const map: Record<string, string> = {
    CASH: 'Efectivo',
    BANK_TRANSFER: 'Transferencia bancaria',
    CARD: 'Tarjeta',
    QR: 'QR',
    CREDIT: 'Crédito',
  }
  return (map[method] ?? method) || 'Sin método'
}

function getTotalGeneral(rows: TableRow[]) {
  if (rows.length === 0) return '$ 0.00'

  const numericColumns = ['Total', 'Saldo', 'Precio', 'Stock', 'Mínimo', 'Subtotal', 'IVA', 'Total venta', 'Saldo pendiente']
  for (const column of numericColumns) {
    const sum = rows.reduce((accumulator, row) => {
      const value = Number(row[column] ?? 0)
      return Number.isFinite(value) ? accumulator + value : accumulator
    }, 0)

    if (sum !== 0 || rows.some((row) => String(row[column] ?? '').trim() !== '')) {
      if (column === 'Stock' || column === 'Mínimo') return sum.toLocaleString('en-US')
      return money(sum)
    }
  }

  return `${rows.length} registros`
}

function buildExportContent(columns: string[], rows: TableRow[], format: 'csv' | 'excel', summaryRows: string[][] = []) {
  const escapedRows = rows.map((row) => columns.map((column) => escapeCell(formatCell(row[column]))))
  const output = [columns.map((column) => escapeCell(column)), ...escapedRows]

  if (summaryRows.length > 0) {
    output.push([])
    output.push(['Resumen financiero', ''])
    summaryRows.forEach((summaryRow) => output.push(summaryRow.map((cell) => escapeCell(cell))))
  }

  const rowText = output.map((line) => line.join(format === 'excel' ? '\t' : ',')).join('\n')
  return rowText
}

function renderTableHtml(columns: string[], rows: TableRow[], summaryRows: string[][] = []) {
  const header = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`).join('')}</tr>`).join('')
  const totalRow = rows.length > 0 ? `<tr style="font-weight:700;background:#f9fafb"><td colspan="${Math.max(columns.length - 1, 1)}" style="text-align:right">Total general</td><td>${escapeHtml(String(getTotalGeneral(rows)))}</td></tr>` : ''
  const summaryHtml = summaryRows.length > 0
    ? `<table class="summary" style="margin-top:20px;border-collapse:collapse;width:100%"><tbody>${summaryRows.map((summaryRow) => `<tr>${summaryRow.map((cell, index) => `<td${index === 0 ? ' style="font-weight:700"' : ''}>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : ''
  return `<table><thead><tr>${header}</tr></thead><tbody>${body}${totalRow}</tbody></table>${summaryHtml}`
}

function escapeCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
}

function formatCell(value: string | number | boolean | null) {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return String(value)
}
