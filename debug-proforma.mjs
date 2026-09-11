import { PrismaClient } from './lib/generated/prisma/client.js';

const prisma = new PrismaClient();

const products = await prisma.product.findMany({
  where: { isActive: true },
  select: { id: true, name: true, currentStock: true, price: true },
  take: 5,
});

const customers = await prisma.customer.findMany({
  select: { id: true, name: true, document: true },
  take: 5,
});

const loginRes = await fetch('http://localhost:3000/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'admin@nexo.com', password: 'admin123456' }),
});

console.log('LOGIN_STATUS', loginRes.status);
console.log('LOGIN_BODY', await loginRes.text());
console.log('SET_COOKIE', loginRes.headers.get('set-cookie'));

const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
console.log('PRODUCTS', JSON.stringify(products, null, 2));
console.log('CUSTOMERS', JSON.stringify(customers, null, 2));

if (products[0] && customers[0]) {
  const res = await fetch('http://localhost:3000/api/proformas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      customerId: customers[0].id,
      notes: 'Prueba real',
      items: [{ productId: products[0].id, quantity: 1 }],
    }),
  });

  console.log('PROFORMA_STATUS', res.status);
  console.log('PROFORMA_BODY', await res.text());
}

await prisma.$disconnect();
