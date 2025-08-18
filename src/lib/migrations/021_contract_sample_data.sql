-- Migration 021: Contract Sample Data
-- Creates sample contracts for testing the vendor contract management system

-- Get existing vendor and properties
DO $$
DECLARE
    v_vendor_id uuid;
    v_prop1 uuid;
    v_prop2 uuid;
    v_owner_id uuid;
    v_tenant_id uuid;
BEGIN
    -- Get vendor (Appopoleis)
    SELECT id INTO v_vendor_id FROM profiles WHERE email = 'appopoleis@example.com' AND role = 'vendor' LIMIT 1;
    
    -- Get properties
    SELECT id INTO v_prop1 FROM properties WHERE title = 'Rosebank Lofts' LIMIT 1;
    SELECT id INTO v_prop2 FROM properties WHERE title = 'Sandton Heights' LIMIT 1;
    
    -- Get owner
    SELECT id INTO v_owner_id FROM profiles WHERE email = 'arsalanahmed82@hotmail.com' AND role = 'owner' LIMIT 1;
    
    -- Get tenant
    SELECT id INTO v_tenant_id FROM profiles WHERE email = 'tenant@example.com' AND role = 'tenant' LIMIT 1;

    -- Create sample contracts
    INSERT INTO service_contracts (
        id,
        title,
        status,
        contract_type,
        priority,
        contract_value,
        sla_hours,
        renewal_date,
        auto_renew,
        termination_notice_days,
        vendor_notes,
        owner_notes,
        estimated_duration_hours,
        start_date,
        end_date,
        vendor_id,
        owner_id,
        tenant_id,
        property_id,
        created_at,
        updated_at
    ) VALUES 
    -- Active Maintenance Contract
    (
        gen_random_uuid(),
        'Monthly Maintenance Contract - Rosebank Lofts',
        'active',
        'maintenance',
        'medium',
        15000,
        24,
        '2025-12-31',
        true,
        30,
        'Regular monthly maintenance including HVAC, plumbing, and electrical systems',
        'Vendor has been performing well. Good communication and timely service.',
        40,
        '2025-01-01',
        '2025-12-31',
        v_vendor_id,
        v_owner_id,
        v_tenant_id,
        v_prop1,
        now() - interval '8 months',
        now() - interval '1 month'
    ),
    -- Pending Signature Contract
    (
        gen_random_uuid(),
        'Emergency Plumbing Services - Sandton Heights',
        'pending_signatures',
        'emergency',
        'urgent',
        8500,
        4,
        null,
        false,
        7,
        'Emergency plumbing repair contract for burst pipe incident',
        'Need this contract signed quickly due to urgent plumbing issues',
        8,
        '2025-08-20',
        '2025-09-20',
        v_vendor_id,
        v_owner_id,
        v_tenant_id,
        v_prop2,
        now() - interval '2 days',
        now() - interval '2 days'
    ),
    -- Completed Contract
    (
        gen_random_uuid(),
        'Kitchen Renovation Project - Rosebank Lofts',
        'completed',
        'project',
        'high',
        45000,
        168,
        null,
        false,
        14,
        'Kitchen renovation completed successfully. All appliances installed and tested.',
        'Excellent work on the kitchen renovation. Very satisfied with the quality.',
        120,
        '2025-03-01',
        '2025-06-30',
        v_vendor_id,
        v_owner_id,
        v_tenant_id,
        v_prop1,
        now() - interval '6 months',
        now() - interval '1 month'
    ),
    -- Draft Contract
    (
        gen_random_uuid(),
        'Annual HVAC Maintenance - Sandton Heights',
        'draft',
        'retainer',
        'low',
        12000,
        48,
        '2026-01-31',
        true,
        60,
        'Annual HVAC maintenance and inspection contract',
        'Standard annual maintenance contract for HVAC systems',
        24,
        '2025-09-01',
        '2026-08-31',
        v_vendor_id,
        v_owner_id,
        v_tenant_id,
        v_prop2,
        now() - interval '1 day',
        now() - interval '1 day'
    ),
    -- Expired Contract
    (
        gen_random_uuid(),
        'Security System Installation - Rosebank Lofts',
        'expired',
        'project',
        'high',
        25000,
        72,
        null,
        false,
        30,
        'Security system installation completed. All cameras and sensors operational.',
        'Security system working well. May need renewal for maintenance.',
        48,
        '2024-01-01',
        '2024-12-31',
        v_vendor_id,
        v_owner_id,
        v_tenant_id,
        v_prop1,
        now() - interval '1 year',
        now() - interval '8 months'
    );

    -- Create sample contract documents
    INSERT INTO contract_documents (
        id,
        contract_id,
        document_type,
        file_name,
        file_url,
        file_size,
        mime_type,
        uploaded_by,
        version,
        is_primary,
        notes,
        uploaded_at
    )
    SELECT 
        gen_random_uuid(),
        sc.id,
        'contract_terms',
        'Contract Terms and Conditions.pdf',
        'https://example.com/contracts/' || sc.id || '/terms.pdf',
        1024000,
        'application/pdf',
        v_owner_id,
        1,
        true,
        'Original contract terms and conditions',
        sc.created_at
    FROM service_contracts sc
    WHERE sc.vendor_id = v_vendor_id;

    -- Create sample notifications
    INSERT INTO contract_notifications (
        id,
        contract_id,
        recipient_id,
        notification_type,
        title,
        message,
        is_read,
        created_at
    )
    SELECT 
        gen_random_uuid(),
        sc.id,
        v_vendor_id,
        'status_change',
        'Contract Status Updated',
        'Contract "' || sc.title || '" status has been updated to ' || sc.status,
        false,
        sc.updated_at
    FROM service_contracts sc
    WHERE sc.vendor_id = v_vendor_id AND sc.status IN ('pending_signatures', 'active');

    -- Create sample audit logs
    INSERT INTO contract_management_audit_logs (
        id,
        contract_id,
        event,
        actor_id,
        old_values,
        new_values,
        created_at
    )
    SELECT 
        gen_random_uuid(),
        sc.id,
        'contract_created',
        v_owner_id,
        '{}',
        jsonb_build_object('title', sc.title, 'status', sc.status),
        sc.created_at
    FROM service_contracts sc
    WHERE sc.vendor_id = v_vendor_id;

    -- Add status change events for active contracts
    INSERT INTO contract_management_audit_logs (
        id,
        contract_id,
        event,
        actor_id,
        old_values,
        new_values,
        created_at
    )
    SELECT 
        gen_random_uuid(),
        sc.id,
        'status_changed',
        v_owner_id,
        jsonb_build_object('status', 'draft'),
        jsonb_build_object('status', sc.status),
        sc.created_at + interval '1 day'
    FROM service_contracts sc
    WHERE sc.vendor_id = v_vendor_id AND sc.status IN ('active', 'pending_signatures', 'completed');

    RAISE NOTICE 'Sample contract data created for vendor %', v_vendor_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating sample contract data: %', SQLERRM;
END $$;
