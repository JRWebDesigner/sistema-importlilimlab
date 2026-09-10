'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus, ShoppingCart, Trash2 } from 'lucide-react'

type Product = { id: string; name: string; sku: string; price: string; currentStock: number }
type Customer = { id: string; name: string; document: string }
type CashAccount = { id: string; name: string; type: 'CASH' | 'BANK' | 'POS'; balance: string }
type CartLine = Product & { quantity: number }

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function SalesModule() {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [cashAccountId, setCashAccountId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([fetch('/api/products').then((response) => response.json()), fetch('/api/customers').then((response) => response.json()), fetch('/api/cash').then((response) => response.json())]).then(([productData, customerData, accountData]) => {
      setProducts(productData)
      setCustomers(customerData)
      setAccounts(accountData)
    })
  }, [])

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0), [cart])
  const tax = subtotal * 0.13
  const total = subtotal + tax

  function addProduct() {
    const product = products.find((item) => item.id === productId)
    const amount = Number(quantity)
    if (!product || !Number.isInteger(amount) || amount < 1) return
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id)
      if (existing) return current.map((line) => line.id === product.id ? { ...line, quantity: Math.min(line.quantity + amount, product.currentStock) } : line)
      return [...current, { ...product, quantity: Math.min(amount, product.currentStock) }]
    })
    setProductId('')
    setQuantity('1')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const response = await fetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: customerId || undefined, cashAccountId: paymentMethod === 'CREDIT' ? undefined : cashAccountId || undefined, paymentMethod, items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })) }) })
    const data = await response.json()
    if (!response.ok) { setMessage(data.error ?? 'No se pudo registrar la venta.'); return }
    setCart([])
    setCustomerId('')
    setMessage(`Venta ${data.number} registrada. Total: ${money.format(Number(data.total))}`)
  }

  return <div className="dashboard-content"><div className="page-heading"><div><p className="eyebrow">Operaciones · Bolivia</p><h1>Nueva venta</h1><p className="muted">Venta interna en USD con IVA boliviano del 13%.</p></div><span className="currency-note">Moneda: USD</span></div>{message && <p className="module-message">{message}</p>}<form className="panel product-form" onSubmit={handleSubmit}><div className="product-form-grid"><label>Cliente<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Consumidor final</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.document}</option>)}</select></label><label>Medio de pago<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="CASH">Efectivo</option><option value="BANK_TRANSFER">Transferencia bancaria</option><option value="CARD">Tarjeta</option><option value="QR">QR</option><option value="CREDIT">Crédito</option></select></label><label>Producto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecciona un producto</option>{products.filter((product) => product.currentStock > 0).map((product) => <option key={product.id} value={product.id}>{product.name} · {money.format(Number(product.price))} · stock {product.currentStock}</option>)}</select></label><label>Cantidad<input min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label></div><button className="outline-button" type="button" onClick={addProduct}><Plus size={15} /> Agregar producto</button><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio USD</th><th>Total USD</th><th /></tr></thead><tbody>{cart.length === 0 ? <tr><td colSpan={5}>Agrega productos para comenzar.</td></tr> : cart.map((line) => <tr key={line.id}><td><div className="product-cell"><span className="product-thumb"><ShoppingCart size={16} /></span><div><strong>{line.name}</strong><small>{line.sku}</small></div></div></td><td>{line.quantity}</td><td>{money.format(Number(line.price))}</td><td>{money.format(Number(line.price) * line.quantity)}</td><td><button className="row-menu" type="button" onClick={() => setCart((current) => current.filter((item) => item.id !== line.id))} aria-label="Quitar producto"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div><div className="sale-total"><span>Subtotal: {money.format(subtotal)}</span><span>IVA 13%: {money.format(tax)}</span><strong>Total: {money.format(total)}</strong></div><button className="primary-button" type="submit" disabled={cart.length === 0}>Registrar venta</button></form></div>
}
