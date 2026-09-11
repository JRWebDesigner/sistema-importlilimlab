import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, alias: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(JSON.stringify(users, null, 2))
}

main().finally(() => prisma.$disconnect())
