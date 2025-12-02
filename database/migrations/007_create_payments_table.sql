-- Drop existing tables first
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS payment_schedules CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

-- Now create fresh
BEGIN;

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  
  type TEXT NOT NULL CHECK (type IN ('rent', 'deposit', 'application_fee', 'late_fee', 'other')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  paid_date TIMESTAMPTZ,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  
  payment_method TEXT CHECK (payment_method IN ('card', 'eft', 'instant_eft', 'cash')),
  payment_gateway TEXT CHECK (payment_gateway IN ('payfast', 'yoco', 'ozow')),
  transaction_id TEXT,
  
  transaction_fee DECIMAL(10, 2) DEFAULT 0,
  fee_paid_by TEXT CHECK (fee_paid_by IN ('owner', 'tenant')),
  
  retry_count INTEGER DEFAULT 0,
  max_retry_count INTEGER DEFAULT 3,
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_lease ON payments(lease_id);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_owner ON payments(owner_id);
CREATE INDEX idx_payments_property ON payments(property_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE TABLE payment_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_day INTEGER NOT NULL CHECK (payment_day BETWEEN 1 AND 31),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  
  auto_pay_enabled BOOLEAN DEFAULT false,
  payment_method_id TEXT,
  
  next_payment_date DATE NOT NULL,
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_schedules_lease ON payment_schedules(lease_id);
CREATE INDEX idx_payment_schedules_tenant ON payment_schedules(tenant_id);
CREATE INDEX idx_payment_schedules_active ON payment_schedules(active);

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id),
  lease_id UUID NOT NULL REFERENCES leases(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  
  type TEXT NOT NULL CHECK (type IN ('deposit', 'overpayment', 'application_fee', 'other')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  
  deductions JSONB,
  net_refund DECIMAL(10, 2) NOT NULL CHECK (net_refund >= 0 AND net_refund <= amount),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  refund_method TEXT CHECK (refund_method IN ('bank_transfer', 'original_method')),
  
  bank_account_holder TEXT,
  bank_name TEXT,
  account_number TEXT,
  branch_code TEXT,
  
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refunds_lease ON refunds(lease_id);
CREATE INDEX idx_refunds_tenant ON refunds(tenant_id);
CREATE INDEX idx_refunds_owner ON refunds(owner_id);
CREATE INDEX idx_refunds_status ON refunds(status);

COMMIT;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Payment policies
CREATE POLICY "Tenants can view their payments"
  ON payments FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Owners can view their payments"
  ON payments FOR SELECT USING (owner_id = auth.uid());

-- Schedule policies
CREATE POLICY "Tenants view schedules"
  ON payment_schedules FOR SELECT USING (tenant_id = auth.uid());

-- Refund policies
CREATE POLICY "Tenants view refunds"
  ON refunds FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Owners manage refunds"
  ON refunds FOR ALL USING (owner_id = auth.uid());


-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

CREATE TRIGGER payment_schedules_updated_at
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();
