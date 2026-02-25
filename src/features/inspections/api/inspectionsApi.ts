import { supabase } from '../../../lib/supabase';
import type {
  Inspection,
  InspectionWithRelations,
  CreateInspectionInput,
  InspectionRooms,
  InspectionStatus,
  DepositCalculation,
  DepositDeduction,
  InspectionComparison,
  RoomCondition,
} from '../types';

export const inspectionsApi = {
  /**
   * Create a new inspection
   */
  async createInspection(input: CreateInspectionInput): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspections')
      .insert({
        property_id: input.property_id,
        lease_id: input.lease_id,
        tenant_id: input.tenant_id,
        owner_id: input.owner_id,
        type: input.type,
        scheduled_date: input.scheduled_date,
        inspector_id: input.inspector_id || null,
        status: 'scheduled',
        rooms: { rooms: [], utilities: {} },
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating inspection:', error);
      throw new Error(`Failed to create inspection: ${error.message}`);
    }

    return data;
  },

  /**
   * Get inspection by ID with relations
   */
  async getInspection(id: string): Promise<InspectionWithRelations> {
    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        lease:leases!lease_id(id, start_date, end_date, monthly_rent, deposit_amount),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone),
        inspector:profiles!inspector_id(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching inspection:', error);
      throw new Error(`Failed to fetch inspection: ${error.message}`);
    }

    return data as unknown as InspectionWithRelations;
  },

  /**
   * Get inspections for a property
   */
  async getPropertyInspections(propertyId: string): Promise<InspectionWithRelations[]> {
    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('property_id', propertyId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      console.error('Error fetching property inspections:', error);
      throw new Error(`Failed to fetch property inspections: ${error.message}`);
    }

    return data as unknown as InspectionWithRelations[];
  },

  /**
   * Get inspections for a lease
   */
  async getLeaseInspections(leaseId: string): Promise<InspectionWithRelations[]> {
    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('lease_id', leaseId)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Error fetching lease inspections:', error);
      throw new Error(`Failed to fetch lease inspections: ${error.message}`);
    }

    return data as unknown as InspectionWithRelations[];
  },

  /**
   * Get inspections for an owner
   */
  async getOwnerInspections(
    ownerId: string,
    status?: InspectionStatus
  ): Promise<InspectionWithRelations[]> {
    let query = supabase
      .from('inspections')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('owner_id', ownerId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('scheduled_date', { ascending: false });

    if (error) {
      console.error('Error fetching owner inspections:', error);
      throw new Error(`Failed to fetch owner inspections: ${error.message}`);
    }

    return data as unknown as InspectionWithRelations[];
  },

  /**
   * Get inspections for a tenant
   */
  async getTenantInspections(
    tenantId: string,
    status?: InspectionStatus
  ): Promise<InspectionWithRelations[]> {
    let query = supabase
      .from('inspections')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('scheduled_date', { ascending: false });

    if (error) {
      console.error('Error fetching tenant inspections:', error);
      throw new Error(`Failed to fetch tenant inspections: ${error.message}`);
    }

    return data as unknown as InspectionWithRelations[];
  },

  /**
   * Start an inspection (change status to in_progress)
   */
  async startInspection(id: string): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspections')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error starting inspection:', error);
      throw new Error(`Failed to start inspection: ${error.message}`);
    }

    return data;
  },

  /**
   * Update inspection rooms data
   */
  async updateInspectionRooms(
    id: string,
    rooms: InspectionRooms
  ): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspections')
      .update({ rooms: rooms as any })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating inspection rooms:', error);
      throw new Error(`Failed to update inspection rooms: ${error.message}`);
    }

    return data;
  },

  /**
   * Add notes and overall condition
   */
  async updateInspectionNotes(
    id: string,
    notes: string,
    overallCondition: RoomCondition
  ): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspections')
      .update({
        notes,
        overall_condition: overallCondition,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating inspection notes:', error);
      throw new Error(`Failed to update inspection notes: ${error.message}`);
    }

    return data;
  },

  /**
   * Complete inspection and request signatures
   */
  async completeInspection(id: string): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspections')
      .update({
        status: 'pending_signatures',
        completed_date: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error completing inspection:', error);
      throw new Error(`Failed to complete inspection: ${error.message}`);
    }

    return data;
  },

  /**
   * Sign inspection (owner or tenant)
   */
  async signInspection(
    id: string,
    party: 'owner' | 'tenant',
    signatureUrl: string
  ): Promise<Inspection> {
    const updateData: any = {};

    if (party === 'owner') {
      updateData.owner_signature_url = signatureUrl;
      updateData.owner_signed_at = new Date().toISOString();
    } else {
      updateData.tenant_signature_url = signatureUrl;
      updateData.tenant_signed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('inspections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error signing inspection:', error);
      throw new Error(`Failed to sign inspection: ${error.message}`);
    }

    // Check if both parties have signed
    const inspection = data as Inspection;
    if (inspection.owner_signed_at && inspection.tenant_signed_at) {
      // Both signed - mark as completed
      return this.finalizeInspection(id);
    }

    return data;
  },

  /**
   * Finalize inspection (both parties signed)
   */
  async finalizeInspection(id: string): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspections')
      .update({ status: 'completed' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error finalizing inspection:', error);
      throw new Error(`Failed to finalize inspection: ${error.message}`);
    }

    // TODO: Generate inspection report PDF
    // TODO: Send notifications to both parties

    return data;
  },

  /**
   * Cancel inspection
   */
  async cancelInspection(id: string, reason?: string): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspections')
      .update({
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling inspection:', error);
      throw new Error(`Failed to cancel inspection: ${error.message}`);
    }

    return data;
  },

  /**
   * Reschedule inspection
   */
  async rescheduleInspection(
    id: string,
    newDate: string
  ): Promise<Inspection> {
    const { data, error } = await supabase
      .from('inspections')
      .update({
        scheduled_date: newDate,
        status: 'scheduled',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error rescheduling inspection:', error);
      throw new Error(`Failed to reschedule inspection: ${error.message}`);
    }

    return data;
  },

  /**
   * Get move-in inspection for a lease
   */
  async getMoveInInspection(leaseId: string): Promise<InspectionWithRelations | null> {
    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('lease_id', leaseId)
      .eq('type', 'move_in')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching move-in inspection:', error);
      throw new Error(`Failed to fetch move-in inspection: ${error.message}`);
    }

    return data as unknown as InspectionWithRelations;
  },

  /**
   * Compare move-out inspection with move-in
   */
  async compareInspections(
    moveInId: string,
    moveOutId: string
  ): Promise<InspectionComparison[]> {
    const [moveIn, moveOut] = await Promise.all([
      this.getInspection(moveInId),
      this.getInspection(moveOutId),
    ]);

    const comparisons: InspectionComparison[] = [];
    const moveInRooms = (moveIn.rooms as InspectionRooms)?.rooms || [];
    const moveOutRooms = (moveOut.rooms as InspectionRooms)?.rooms || [];

    for (const moveOutRoom of moveOutRooms) {
      const moveInRoom = moveInRooms.find(r => r.name === moveOutRoom.name);

      const comparison: InspectionComparison = {
        roomName: moveOutRoom.name,
        moveInCondition: moveInRoom?.overallCondition || 'good',
        moveOutCondition: moveOutRoom.overallCondition,
        newDamages: [],
        estimatedRepairCost: 0,
      };

      // Find new damages (not in move-in)
      for (const item of moveOutRoom.items) {
        if (item.damages) {
          const newDamages = item.damages.filter(d => !d.existingDamage);
          comparison.newDamages.push(...newDamages);
          comparison.estimatedRepairCost += newDamages.reduce(
            (sum, d) => sum + (d.estimatedCost || 0),
            0
          );
        }
      }

      comparisons.push(comparison);
    }

    return comparisons;
  },

  /**
   * Calculate deposit refund based on move-out inspection
   */
  async calculateDepositRefund(
    leaseId: string,
    moveOutInspectionId: string
  ): Promise<DepositCalculation> {
    // Get lease and move-in inspection
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select('deposit_amount')
      .eq('id', leaseId)
      .single();

    if (leaseError || !lease) {
      throw new Error('Lease not found');
    }

    const originalDeposit = lease.deposit_amount || 0;
    // Validate move-out inspection exists
    await this.getInspection(moveOutInspectionId);
    const moveInInspection = await this.getMoveInInspection(leaseId);

    const deductions: DepositDeduction[] = [];
    let totalDeductions = 0;

    if (moveInInspection) {
      // Compare inspections to find new damages
      const comparisons = await this.compareInspections(
        moveInInspection.id,
        moveOutInspectionId
      );

      for (const comparison of comparisons) {
        for (const damage of comparison.newDamages) {
          if (damage.estimatedCost && damage.estimatedCost > 0) {
            deductions.push({
              reason: damage.description,
              amount: damage.estimatedCost,
              roomName: comparison.roomName,
              photos: damage.photos,
            });
            totalDeductions += damage.estimatedCost;
          }
        }
      }
    }

    // Cap deductions at deposit amount
    totalDeductions = Math.min(totalDeductions, originalDeposit);

    return {
      originalDeposit,
      totalDeductions,
      refundAmount: originalDeposit - totalDeductions,
      deductions,
      notes: deductions.length === 0
        ? 'No damages found. Full deposit to be refunded.'
        : `${deductions.length} deductions totalling R ${totalDeductions.toLocaleString()}`,
    };
  },

  /**
   * Schedule move-in inspection for a new lease
   */
  async scheduleMoveInInspection(
    leaseId: string,
    scheduledDate: string
  ): Promise<Inspection> {
    // Get lease details
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select('property_id, tenant_id, owner_id')
      .eq('id', leaseId)
      .single();

    if (leaseError || !lease) {
      throw new Error('Lease not found');
    }

    return this.createInspection({
      property_id: lease.property_id!,
      lease_id: leaseId,
      tenant_id: lease.tenant_id!,
      owner_id: lease.owner_id!,
      type: 'move_in',
      scheduled_date: scheduledDate,
    });
  },

  /**
   * Schedule move-out inspection for ending lease
   */
  async scheduleMoveOutInspection(
    leaseId: string,
    scheduledDate: string
  ): Promise<Inspection> {
    // Get lease details
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select('property_id, tenant_id, owner_id')
      .eq('id', leaseId)
      .single();

    if (leaseError || !lease) {
      throw new Error('Lease not found');
    }

    return this.createInspection({
      property_id: lease.property_id!,
      lease_id: leaseId,
      tenant_id: lease.tenant_id!,
      owner_id: lease.owner_id!,
      type: 'move_out',
      scheduled_date: scheduledDate,
    });
  },
};
