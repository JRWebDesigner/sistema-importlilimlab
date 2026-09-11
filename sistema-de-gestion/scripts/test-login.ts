import 'dotenv/config'
import { POST } from '../app/api/auth/route'

async function main() {
  const req = new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin@nexo.com',
      password: 'admin123456',
    }),
  })

  const res = await POST(req)
  const text = await res.text()
  console.log('status:', res.status)
  console.log('headers:', Object.fromEntries(res.headers.entries()))
  console.log('body:', text)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
