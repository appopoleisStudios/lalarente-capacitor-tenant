-- Migration 020: Vendor Contract Management Enhancements
-- Adds comprehensive contract management fields to service_contracts
-- and creates supporting tables for document storage and notifications

-- Enhance service_contracts table with contract management fields
ALTER TABLE public.service_contracts 
ADD COLUMN IF NOT EXISTS contract_value numeric,
ADD COLUMN IF NOT EXISTS sla_hours integer DEFAULT 48,
ADD COLUMN IF NOT EXISTS renewal_date date,
ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS termination_notice_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS vendor_notes text,
ADD COLUMN IF NOT EXISTS owner_notes text,
ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'maintenance' CHECK (contract_type IN ('maintenance', 'retainer', 'project', 'emergency')),
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS estimated_duration_hours integer,
ADD COLUMN IF NOT EXISTS actual_duration_hours integer,
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS completion_date date,
ADD COLUMN IF NOT EXISTS vendor_rating integer CHECK (vendor_rating >= 1 AND vendor_rating <= 5),
ADD COLUMN IF NOT EXISTS vendor_feedback text,
ADD COLUMN IF NOT EXISTS owner_rating integer CHECK (owner_rating >= 1 AND owner_rating <= 5),
ADD COLUMN IF NOT EXISTS owner_feedback text;

-- Create contract documents table for file storage
CREATE TABLE IF NOT EXISTS public.contract_documents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
    document_type text NOT NULL CHECK (document_type IN ('contract', 'invoice', 'receipt', 'photo', 'report', 'other')),
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    mime_type text,
    uploaded_by uuid REFERENCES public.profiles(id),
    uploaded_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1,
    is_primary boolean DEFAULT false,
    notes text
);

-- Create contract notifications table
CREATE TABLE IF NOT EXISTS public.contract_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES public.profiles(id),
    notification_type text NOT NULL CHECK (notification_type IN ('status_change', 'renewal_reminder', 'payment_due', 'completion_reminder', 'rating_request')),
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);

-- Create contract audit log for tracking all changes
CREATE TABLE IF NOT EXISTS public.contract_management_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
    event text NOT NULL,
    actor_id uuid REFERENCES public.profiles(id),
    old_values jsonb,
    new_values jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON public.contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_type ON public.contract_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_contract_notifications_recipient_id ON public.contract_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_contract_notifications_contract_id ON public.contract_notifications(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_notifications_unread ON public.contract_notifications(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_contract_management_audit_contract_id ON public.contract_management_audit_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_vendor_status ON public.service_contracts(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_service_contracts_owner_status ON public.service_contracts(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_service_contracts_renewal_date ON public.service_contracts(renewal_date) WHERE renewal_date IS NOT NULL;

-- Add RLS policies for new tables
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_management_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for contract_documents
CREATE POLICY "Users can view contract documents for contracts they're involved in" ON public.contract_documents
    FOR SELECT USING (
        contract_id IN (
            SELECT id FROM public.service_contracts 
            WHERE vendor_id = auth.uid() OR owner_id = auth.uid() OR tenant_id = auth.uid()
        )
    );

CREATE POLICY "Contract parties can upload documents" ON public.contract_documents
    FOR INSERT WITH CHECK (
        contract_id IN (
            SELECT id FROM public.service_contracts 
            WHERE vendor_id = auth.uid() OR owner_id = auth.uid()
        )
    );

CREATE POLICY "Contract parties can update their uploaded documents" ON public.contract_documents
    FOR UPDATE USING (uploaded_by = auth.uid());

-- RLS policies for contract_notifications
CREATE POLICY "Users can view their own notifications" ON public.contract_notifications
    FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.contract_notifications
    FOR UPDATE USING (recipient_id = auth.uid());

-- RLS policies for contract_management_audit_logs
CREATE POLICY "Contract parties can view audit logs" ON public.contract_management_audit_logs
    FOR SELECT USING (
        contract_id IN (
            SELECT id FROM public.service_contracts 
            WHERE vendor_id = auth.uid() OR owner_id = auth.uid() OR tenant_id = auth.uid()
        )
    );

CREATE POLICY "System can insert audit logs" ON public.contract_management_audit_logs
    FOR INSERT WITH CHECK (true);

-- Create function to generate contract notifications
CREATE OR REPLACE FUNCTION public.create_contract_notification(
    p_contract_id uuid,
    p_recipient_id uuid,
    p_notification_type text,
    p_title text,
    p_message text
) RETURNS void AS $$
BEGIN
    INSERT INTO public.contract_notifications (
        contract_id, recipient_id, notification_type, title, message
    ) VALUES (
        p_contract_id, p_recipient_id, p_notification_type, p_title, p_message
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log contract management events
CREATE OR REPLACE FUNCTION public.log_contract_event(
    p_contract_id uuid,
    p_event text,
    p_actor_id uuid DEFAULT auth.uid(),
    p_old_values jsonb DEFAULT null,
    p_new_values jsonb DEFAULT null
) RETURNS void AS $$
BEGIN
    INSERT INTO public.contract_management_audit_logs (
        contract_id, event, actor_id, old_values, new_values
    ) VALUES (
        p_contract_id, p_event, p_actor_id, p_old_values, p_new_values
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get contract summary for vendor dashboard
CREATE OR REPLACE FUNCTION public.get_vendor_contract_summary(p_vendor_id uuid)
RETURNS TABLE (
    total_contracts bigint,
    active_contracts bigint,
    pending_contracts bigint,
    completed_contracts bigint,
    total_value numeric,
    this_month_earnings numeric,
    avg_rating numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_contracts,
        COUNT(*) FILTER (WHERE status = 'active') as active_contracts,
        COUNT(*) FILTER (WHERE status = 'pending_signatures') as pending_contracts,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_contracts,
        COALESCE(SUM(contract_value), 0) as total_value,
        COALESCE(SUM(contract_value) FILTER (
            WHERE status = 'completed' 
            AND completion_date >= date_trunc('month', current_date)
        ), 0) as this_month_earnings,
        COALESCE(AVG(vendor_rating), 0) as avg_rating
    FROM public.service_contracts 
    WHERE vendor_id = p_vendor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.contract_documents TO authenticated;
GRANT SELECT, UPDATE ON public.contract_notifications TO authenticated;
GRANT SELECT ON public.contract_management_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contract_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_contract_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_contract_summary TO authenticated;
