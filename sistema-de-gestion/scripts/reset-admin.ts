import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const before = await prisma.user.count()

  await prisma.user.deleteMany({})

  const email = 'admin@nexo.com'
  const alias = 'admin'
  const passwordHash = await bcrypt.hash('admin123456', 12)

  const created = await prisma.user.create({
    data: {
      name: 'Administrador',
      alias,
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      alias: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  const after = await prisma.user.count()

  console.log(JSON.stringify({ before, deleted: before, after, created }, null, 2))
}

main()
  .catch((error) => {
    console.error('Error resetting admin:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
