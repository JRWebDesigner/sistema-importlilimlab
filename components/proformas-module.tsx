'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'

type Product = { id: string; name: string; sku: string; price: string; currentStock: number }
type Customer = { id: string; name: string; document: string }
type CashAccount = { id: string; name: string; type: 'CASH' | 'BANK' | 'POS'; balance: string }
type ProformaRecord = {
  id: string
  number: string
  status: 'SENT' | 'ACCEPTED' | 'REJECTED'
  total: string | number
  notes?: string | null
  customer?: { name?: string | null; document?: string | null } | null
  items?: Array<{ id: string; quantity: number; unitPrice: string | number; product?: { name?: string; sku?: string } | null }>
}

type ProformaLine = {
  id: string
  name: string
  sku: string
  quantity: number
  unitPrice: number
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

async function parseJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return { error: 'La respuesta del servidor no es válida.' }
  }
}

export default function ProformasModule() {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [lines, setLines] = useState<ProformaLine[]>([])
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [proformas, setProformas] = useState<ProformaRecord[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([])
  const [pendingAcceptId, setPendingAcceptId] = useState<string | null>(null)
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CARD' | 'QR' | 'CREDIT'>('CASH')
  const [pendingCashAccountId, setPendingCashAccountId] = useState('')

  const loadProformas = async () => {
    const response = await fetch('/api/proformas')
    const data = await parseJsonResponse(response)

    if (!response.ok) {
      setProformas([])
      if (response.status === 401 || response.status === 403) {
        setMessage('Sesión requerida. Inicia sesión para gestionar proformas.')
      }
      return
    }

    setProformas(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then((response) => response.json()),
      fetch('/api/customers').then((response) => response.json()),
      fetch('/api/cash').then((response) => response.json()),
    ]).then(([productData, customerData, accountsData]) => {
      setProducts(productData)
      setCustomers(customerData)
      setCashAccounts(Array.isArray(accountsData) ? accountsData : [])
      if (Array.isArray(accountsData) && accountsData[0]) setPendingCashAccountId(accountsData[0].id)
    })

    void loadProformas()
  }, [])

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines],
  )
  const tax = subtotal * 0.13
  const total = subtotal + tax

  function addLine() {
    const product = products.find((item) => item.id === productId)
    const qty = Number(quantity)
    if (!product || !Number.isFinite(qty) || qty < 1) {
      setMessage('Selecciona un producto válido y una cantidad mayor a 0.')
      return
    }

    setLines((current) => {
      const existing = current.find((line) => line.id === product.id)
      if (existing) {
        return current.map((line) =>
          line.id === product.id
            ? { ...line, quantity: Math.min(line.quantity + qty, product.currentStock || line.quantity + qty) }
            : line,
        )
      }

      return [...current, {
        id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: Math.min(qty, product.currentStock || qty),
        unitPrice: Number(product.price),
      }]
    })

    setProductId('')
    setQuantity('1')
    setMessage('')
  }

  function removeLine(productIdToRemove: string) {
    setLines((current) => current.filter((line) => line.id !== productIdToRemove))
  }

  function exportCurrentProforma() {
    if (lines.length === 0) {
      setMessage('Agrega productos para generar la proforma.')
      return
    }

    const customerName = customers.find((customer) => customer.id === customerId)?.name ?? 'Consumidor final'
    const effectiveNotes = notes || 'Sin observaciones'
    const printable = window.open('', '_blank', 'width=1200,height=900')

    if (!printable) {
      setMessage('El navegador bloqueó la ventana para exportar la proforma. Permite pop-ups e inténtalo otra vez.')
      return
    }

    printable.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Proforma</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 32px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
            .brand { font-size: 26px; font-weight: 700; }
            .meta { font-size: 12px; color: #4b5563; line-height: 1.7; }
            h2 { margin: 0 0 16px; font-size: 28px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 12px; }
            th { background: #f3f4f6; }
            .totals { margin-top: 18px; width: 260px; margin-left: auto; }
            .totals tr td:last-child { text-align: right; }
            .footer { margin-top: 24px; font-size: 12px; color: #374151; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">Import lilimlab</div>
              <div class="meta">Proforma</div>
            </div>
            <div class="meta">
              <div>Fecha: ${new Date().toLocaleDateString('es-ES')}</div>
              <div>Cliente: ${customerName}</div>
            </div>
          </div>
          <h2>Proforma</h2>
          <div class="meta">Observaciones: ${effectiveNotes}</div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map((line) => `
                <tr>
                  <td>${line.name}</td>
                  <td>${line.quantity}</td>
                  <td>${money.format(line.unitPrice)}</td>
                  <td>${money.format(line.quantity * line.unitPrice)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <table class="totals">
            <tr><td>Subtotal</td><td>${money.format(subtotal)}</td></tr>
            <tr><td>IVA 13%</td><td>${money.format(tax)}</td></tr>
            <tr><td><strong>Total</strong></td><td><strong>${money.format(total)}</strong></td></tr>
          </table>
          <div class="footer">Gracias por confiar en nosotros.</div>
        </body>
      </html>
    `)
    printable.document.close()
    printable.focus()
    setTimeout(() => {
      try {
        printable.print()
      } catch {
        setMessage('No se pudo abrir la vista de impresión. Puedes intentar nuevamente desde el navegador.')
      }
    }, 250)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (lines.length === 0) {
      setMessage('Agrega al menos un producto a la proforma.')
      return
    }

    const response = await fetch('/api/proformas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customerId || undefined,
        notes: notes ? `${notes} · Proforma` : 'Proforma',
        items: lines.map((line) => ({
          productId: line.id,
          quantity: line.quantity,
        })),
      }),
    })

    const data = await parseJsonResponse(response)

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setMessage('Sesión requerida. Inicia sesión nuevamente para crear proformas.')
        return
      }
      setMessage(data.error ?? 'No se pudo guardar la proforma.')
      return
    }

    setLines([])
    setCustomerId('')
    setNotes('')
    await loadProformas()
    setMessage(`Proforma ${data.number ?? 'registrada'} creada correctamente. Total estimado: ${money.format(Number(data.total ?? total))}`)
  }

  function exportProforma(proforma: ProformaRecord) {
    const rows = proforma.items ?? []
    const printable = window.open('', '_blank', 'width=1200,height=900')

    if (!printable) {
      setMessage('El navegador bloqueó la ventana para imprimir la proforma.')
      return
    }

    printable.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>${proforma.number}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 32px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
            .brand { font-size: 26px; font-weight: 700; }
            .meta { font-size: 12px; color: #4b5563; line-height: 1.7; }
            h2 { margin: 0 0 16px; font-size: 28px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 12px; }
            th { background: #f3f4f6; }
            .totals { margin-top: 18px; width: 260px; margin-left: auto; }
            .totals tr td:last-child { text-align: right; }
            .footer { margin-top: 24px; font-size: 12px; color: #374151; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">Import lilimlab</div>
              <div class="meta">Proforma</div>
            </div>
            <div class="meta">
              <div>Fecha: ${new Date(proforma?.['createdAt'] ?? Date.now()).toLocaleDateString('es-ES')}</div>
              <div>Cliente: ${proforma.customer?.name ?? 'Consumidor final'}</div>
            </div>
          </div>
          <h2>${proforma.number}</h2>
          <div class="meta">Observaciones: ${proforma.notes ?? 'Sin observaciones'}</div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${row.product?.name ?? 'Producto'}</td>
                  <td>${row.quantity}</td>
                  <td>${money.format(Number(row.unitPrice ?? 0))}</td>
                  <td>${money.format(Number(row.quantity) * Number(row.unitPrice ?? 0))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <table class="totals">
            <tr><td>Subtotal</td><td>${money.format(Number(proforma.total ?? 0))}</td></tr>
            <tr><td><strong>Total</strong></td><td><strong>${money.format(Number(proforma.total ?? 0))}</strong></td></tr>
          </table>
          <div class="footer">Gracias por confiar en nosotros.</div>
        </body>
      </html>
    `)
    printable.document.close()
    printable.focus()
    setTimeout(() => {
      try {
        printable.print()
      } catch {
        setMessage('No se pudo abrir la impresión de la proforma.')
      }
    }, 250)
  }

  async function handleProformaDecision(proformaId: string, action: 'accept' | 'reject', paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'QR' | 'CREDIT') {
    setMessage('')

    const response = await fetch('/api/proformas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proformaId,
        action,
        paymentMethod: paymentMethod ?? pendingPaymentMethod,
        cashAccountId: pendingCashAccountId || undefined,
      }),
    })

    const data = await parseJsonResponse(response)
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setMessage('Sesión requerida para aceptar o rechazar proformas.')
        return
      }
      setMessage(data.error ?? 'No se pudo actualizar la proforma.')
      return
    }

    setPendingAcceptId(null)
    await loadProformas()
    setMessage(action === 'accept' ? 'La proforma fue aceptada y convertida en venta.' : 'La proforma fue rechazada.')
  }

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Cotizaciones · Bolivia</p>
          <h1>Proformas</h1>
          <p className="muted">Crea una cotización para un cliente con productos y precio estimado.</p>
        </div>
        <span className="currency-note">Moneda: USD</span>
      </div>

      {message && <p className="module-message">{message}</p>}

      <form className="panel product-form" onSubmit={handleSubmit}>
        <div className="product-form-grid">
          <label>
            Cliente
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Consumidor final</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.document}
                </option>
              ))}
            </select>
          </label>

          <label>
            Producto
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Selecciona un producto</option>
              {products.filter((product) => product.currentStock > 0).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {money.format(Number(product.price))} · stock {product.currentStock}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cantidad
            <input min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>

          <label>
            Observaciones
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" />
          </label>
        </div>

        <button className="outline-button" type="button" onClick={addLine}>
          <Plus size={15} /> Agregar producto
        </button>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5}>No hay productos en la proforma.</td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb"><FileText size={16} /></span>
                        <div>
                          <strong>{line.name}</strong>
                          <small>{line.sku}</small>
                        </div>
                      </div>
                    </td>
                    <td>{line.quantity}</td>
                    <td>{money.format(line.unitPrice)}</td>
                    <td>{money.format(line.quantity * line.unitPrice)}</td>
                    <td>
                      <button className="row-menu" type="button" aria-label="Eliminar línea" onClick={() => removeLine(line.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="module-stats">
          <div>
            <span>Subtotal</span>
            <strong>{money.format(subtotal)}</strong>
          </div>
          <div>
            <span>IVA 13%</span>
            <strong>{money.format(tax)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{money.format(total)}</strong>
          </div>
        </div>

        <div className="panel-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="outline-button" type="button" onClick={exportCurrentProforma}>
            Descargar PDF
          </button>
          <button className="primary-button" type="submit">
            Guardar proforma
          </button>
        </div>
      </form>

      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <div>
            <h2>Historial de proformas</h2>
            <p>Últimas cotizaciones realizadas</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {proformas.length === 0 ? (
                <tr>
                  <td colSpan={4}>Todavía no hay proformas registradas.</td>
                </tr>
              ) : (
                proformas.map((proforma) => (
                  <tr key={proforma.id}>
                    <td>{proforma.number}</td>
                    <td>{proforma.customer?.name ?? 'Consumidor final'}</td>
                    <td>{money.format(Number(proforma.total ?? 0))}</td>
                    <td>
                      <span className={`status ${proforma.status === 'REJECTED' ? 'warning' : 'success'}`}>
                        <i />{proforma.status === 'SENT' ? 'Enviada' : proforma.status === 'ACCEPTED' ? 'Aceptada' : 'Rechazada'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button type="button" className="outline-button" onClick={() => exportProforma(proforma)}>PDF</button>
                        {proforma.status === 'SENT' && (
                          <>
                            {pendingAcceptId === proforma.id ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <select value={pendingPaymentMethod} onChange={(event) => setPendingPaymentMethod(event.target.value as 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'QR' | 'CREDIT')}>
                                  <option value="CASH">Efectivo</option>
                                  <option value="BANK_TRANSFER">Transferencia</option>
                                  <option value="CARD">Tarjeta</option>
                                  <option value="QR">QR</option>
                                  <option value="CREDIT">Crédito</option>
                                </select>
                                {pendingPaymentMethod !== 'CREDIT' && (
                                  <select value={pendingCashAccountId} onChange={(event) => setPendingCashAccountId(event.target.value)}>
                                    {cashAccounts.map((account) => (
                                      <option key={account.id} value={account.id}>{account.name}</option>
                                    ))}
                                  </select>
                                )}
                                <button type="button" className="primary-button" onClick={() => handleProformaDecision(proforma.id, 'accept', pendingPaymentMethod)}>Confirmar</button>
                                <button type="button" className="outline-button" onClick={() => setPendingAcceptId(null)}>Cancelar</button>
                              </div>
                            ) : (
                              <>
                                <button type="button" className="primary-button" onClick={() => { setPendingAcceptId(proforma.id); setPendingPaymentMethod('CASH'); }}>Aceptar</button>
                                <button type="button" className="outline-button" onClick={() => handleProformaDecision(proforma.id, 'reject')}>Rechazar</button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
