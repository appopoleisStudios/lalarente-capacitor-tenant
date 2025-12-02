-- Drop existing tables first
DROP TABLE IF EXISTS message_attachments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS message_threads CASCADE;

-- Now create fresh
BEGIN;

CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  lease_id UUID REFERENCES leases(id),
  
  owner_id UUID NOT NULL REFERENCES profiles(id),
  tenant_id UUID NOT NULL REFERENCES profiles(id),
  
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('general', 'maintenance', 'payment', 'lease', 'emergency')),
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count_owner INTEGER DEFAULT 0 CHECK (unread_count_owner >= 0),
  unread_count_tenant INTEGER DEFAULT 0 CHECK (unread_count_tenant >= 0),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_threads_owner ON message_threads(owner_id);
CREATE INDEX idx_message_threads_tenant ON message_threads(tenant_id);
CREATE INDEX idx_message_threads_property ON message_threads(property_id);
CREATE INDEX idx_message_threads_lease ON message_threads(lease_id);
CREATE INDEX idx_message_threads_last_message ON message_threads(last_message_at DESC);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  
  sender_id UUID NOT NULL REFERENCES profiles(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'tenant')),
  
  content TEXT NOT NULL CHECK (length(content) > 0),
  
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(thread_id, created_at);

CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  mime_type TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);

-- Trigger functions
CREATE OR REPLACE FUNCTION update_message_thread_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  
  IF NEW.sender_role = 'owner' THEN
    UPDATE message_threads
    SET unread_count_tenant = unread_count_tenant + 1
    WHERE id = NEW.thread_id;
  ELSE
    UPDATE message_threads
    SET unread_count_owner = unread_count_owner + 1
    WHERE id = NEW.thread_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_unread_count_on_read()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
    IF NEW.sender_role = 'owner' THEN
      UPDATE message_threads
      SET unread_count_tenant = GREATEST(0, unread_count_tenant - 1)
      WHERE id = NEW.thread_id;
    ELSE
      UPDATE message_threads
      SET unread_count_owner = GREATEST(0, unread_count_owner - 1)
      WHERE id = NEW.thread_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_thread_on_new_message ON messages;
CREATE TRIGGER update_thread_on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_message_thread_on_new_message();

DROP TRIGGER IF EXISTS update_unread_on_read ON messages;
CREATE TRIGGER update_unread_on_read
  AFTER UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_unread_count_on_read();

COMMIT;
