import { randomBytes, scryptSync } from 'crypto'

const password = process.argv[2]

if (!password) {
  console.error('사용법: node scripts/generate-password-hash.mjs <plain-password>')
  process.exit(1)
}

const salt = randomBytes(16).toString('hex')
const hash = scryptSync(password, salt, 64).toString('hex')
console.log(`${salt}:${hash}`)
