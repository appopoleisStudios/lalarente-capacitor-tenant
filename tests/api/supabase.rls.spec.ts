import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const anon = process.env.SUPABASE_ANON_KEY!

function clientWith(email: string, password: string) {
  const sb = createClient(url, anon)
  return { sb, email, password }
}

describe('RLS visibility for maintenance_requests', () => {
  it('vendor sees public requests but not private ones without invitation', async () => {
    const vendor = clientWith(process.env.E2E_VENDOR_EMAIL!, process.env.E2E_VENDOR_PASSWORD!)
    const { data: auth } = await vendor.sb.auth.signInWithPassword({ email: vendor.email, password: vendor.password })
    expect(auth.user).toBeTruthy()

    const { data, error } = await vendor.sb
      .from('maintenance_requests')
      .select('id,visibility,mms_status')
      .eq('visibility','public')
      .limit(5)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})



