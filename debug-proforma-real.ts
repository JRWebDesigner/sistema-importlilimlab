import { PrismaClient } from './lib/generated/prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, currentStock: true, price: true, sku: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, document: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('PRODUCTS', JSON.stringify(products, null, 2));
  console.log('CUSTOMERS', JSON.stringify(customers, null, 2));

  const loginRes = await fetch('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@nexo.com', password: 'admin123456' }),
  });

  const loginText = await loginRes.text();
  console.log('LOGIN_STATUS', loginRes.status);
  console.log('LOGIN_BODY', loginText);

  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  console.log('COOKIE', cookie);

  const targetProduct = products[0];
  const targetCustomer = customers[0];

  if (targetProduct && targetCustomer) {
    const payload = {
      customerId: targetCustomer.id,
      notes: 'debug reproduccion',
      items: [{ productId: targetProduct.id, quantity: 1 }],
    };
    console.log('PAYLOAD', JSON.stringify(payload));

    const res = await fetch('http://localhost:3000/api/proformas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify(payload),
    });

    console.log('PROFORMA_STATUS', res.status);
    console.log('PROFORMA_BODY', await res.text());
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
