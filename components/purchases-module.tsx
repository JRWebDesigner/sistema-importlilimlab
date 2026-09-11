'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'

type Supplier = { id: string; name: string; document: string }
type Product = { id: string; name: string; sku: string; price: string; currentStock: number }
type CashAccount = { id: string; name: string; type: 'CASH' | 'BANK' | 'POS'; balance: string }
type PurchaseLine = { id: string; name: string; sku: string; quantity: number; unitCost: number }

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function PurchasesModule() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [cashAccountId, setCashAccountId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('0')
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/suppliers').then((response) => response.json()),
      fetch('/api/products').then((response) => response.json()),
      fetch('/api/cash').then((response) => response.json()),
    ]).then(([supplierData, productData, accountData]) => {
      setSuppliers(supplierData)
      setProducts(productData)
      setAccounts(accountData)
      if (accountData[0]) setCashAccountId(accountData[0].id)
    })
  }, [])

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
    [lines],
  )
  const tax = subtotal * 0.13
  const total = subtotal + tax

  function addLine() {
    const product = products.find((item) => item.id === productId)
    const qty = Number(quantity)
    const cost = Number(unitCost)

    if (!product || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(cost) || cost < 0) {
      setMessage('Selecciona un producto válido y un costo positivo.')
      return
    }

    setLines((current) => {
      const existing = current.find((line) => line.id === product.id)
      if (existing) {
        return current.map((line) =>
          line.id === product.id
            ? { ...line, quantity: line.quantity + qty, unitCost: cost }
            : line,
        )
      }
      return [...current, { id: product.id, name: product.name, sku: product.sku, quantity: qty, unitCost: cost }]
    })

    setProductId('')
    setQuantity('1')
    setUnitCost('0')
    setMessage('')
  }

  function removeLine(productIdToRemove: string) {
    setLines((current) => current.filter((line) => line.id !== productIdToRemove))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        paymentMethod,
        cashAccountId: paymentMethod === 'CREDIT' ? undefined : cashAccountId || undefined,
        items: lines.map((line) => ({
          productId: line.id,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      setMessage(data.error ?? 'No se pudo registrar la compra.')
      return
    }

    setLines([])
    setSupplierId('')
    setMessage(`Compra ${data.number ?? 'registrada'} guardada correctamente.`)
  }

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Compras · Bolivia</p>
          <h1>Registrar compra</h1>
          <p className="muted">Entradas de inventario y pagos a proveedores en USD.</p>
        </div>
        <span className="currency-note">Moneda: USD</span>
      </div>

      {message && <p className="module-message">{message}</p>}

      <form className="panel product-form" onSubmit={handleSubmit}>
        <div className="product-form-grid">
          <label>
            Proveedor
            <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required>
              <option value="">Selecciona un proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} · {supplier.document}
                </option>
              ))}
            </select>
          </label>

          <label>
            Medio de pago
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="CARD">Tarjeta</option>
              <option value="QR">QR</option>
              <option value="CREDIT">Crédito</option>
            </select>
          </label>

          {paymentMethod !== 'CREDIT' && (
            <label>
              Cuenta de pago
              <select value={cashAccountId} onChange={(event) => setCashAccountId(event.target.value)}>
                <option value="">Selecciona una cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.type}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Producto
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Selecciona un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.sku}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cantidad
            <input min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>

          <label>
            Costo unitario USD
            <input min="0" step="0.01" type="number" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
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
                <th>Costo unit.</th>
                <th>Subtotal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5}>Agrega productos para registrar la compra.</td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb"><ClipboardList size={16} /></span>
                        <div>
                          <strong>{line.name}</strong>
                          <small>{line.sku}</small>
                        </div>
                      </div>
                    </td>
                    <td>{line.quantity}</td>
                    <td>{money.format(line.unitCost)}</td>
                    <td>{money.format(line.quantity * line.unitCost)}</td>
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

        <button className="primary-button" type="submit" disabled={lines.length === 0 || !supplierId}>
          Guardar compra
        </button>
      </form>
    </div>
  )
}
