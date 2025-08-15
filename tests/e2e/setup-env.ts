import { config } from 'dotenv'
import path from 'path'

export default async function globalSetup() {
  // Load .env.local explicitly (Next.js-style), then fall back to default .env if present
  const root = path.resolve(__dirname, '../../')
  config({ path: path.join(root, '.env.local') })
  config()
}


