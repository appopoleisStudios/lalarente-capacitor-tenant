import type { Database } from '../../../types/database.types';

// Base types from database
export type Inspection = Database['public']['Tables']['inspections']['Row'];
export type InspectionInsert = Database['public']['Tables']['inspections']['Insert'];
export type InspectionUpdate = Database['public']['Tables']['inspections']['Update'];

// Inspection type enum
export type InspectionType = 'move_in' | 'periodic' | 'move_out';

// Inspection status enum
export type InspectionStatus = 'scheduled' | 'in_progress' | 'pending_signatures' | 'completed' | 'cancelled';

// Room condition enum
export type RoomCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';

// Room inspection item
export interface RoomItem {
  name: string;
  condition: RoomCondition;
  notes?: string;
  photos?: string[];
  damages?: DamageItem[];
}

// Damage item
export interface DamageItem {
  description: string;
  severity: 'minor' | 'moderate' | 'severe';
  estimatedCost?: number;
  photos?: string[];
  existingDamage?: boolean; // Was it there at move-in?
}

// Room inspection data
export interface RoomInspection {
  name: string; // e.g., "Living Room", "Kitchen", "Bedroom 1"
  items: RoomItem[];
  overallCondition: RoomCondition;
  notes?: string;
  photos?: string[];
}

// Complete rooms JSON structure
export interface InspectionRooms {
  rooms: RoomInspection[];
  generalNotes?: string;
  externalAreas?: RoomInspection[];
  utilities?: {
    electricity: { working: boolean; meterReading?: number; notes?: string };
    water: { working: boolean; meterReading?: number; notes?: string };
    gas?: { working: boolean; meterReading?: number; notes?: string };
  };
  keys?: KeyHandover;
}

// Key handover data
export interface KeyHandover {
  physicalKeys: number;
  accessCards: number;
  remoteControls: number;
  accessCodes?: string[];
  notes?: string;
  photos?: string[];
}

// Extended inspection with relations
export interface InspectionWithRelations extends Omit<Inspection, 'rooms'> {
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
  };
  lease?: {
    id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    deposit_amount: number | null;
  };
  tenant?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  owner?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  inspector?: {
    id: string;
    full_name: string;
  };
  rooms: InspectionRooms;
}

// Create inspection input
export interface CreateInspectionInput {
  property_id: string;
  lease_id: string;
  tenant_id: string;
  owner_id: string;
  type: InspectionType;
  scheduled_date: string;
  inspector_id?: string;
}

// Deposit deduction for move-out
export interface DepositDeduction {
  reason: string;
  amount: number;
  roomName?: string;
  photos?: string[];
}

// Deposit calculation result
export interface DepositCalculation {
  originalDeposit: number;
  totalDeductions: number;
  refundAmount: number;
  deductions: DepositDeduction[];
  notes?: string;
}

// Comparison result for move-out vs move-in
export interface InspectionComparison {
  roomName: string;
  moveInCondition: RoomCondition;
  moveOutCondition: RoomCondition;
  newDamages: DamageItem[];
  estimatedRepairCost: number;
}

// Default rooms for South African properties
export const DEFAULT_ROOMS = [
  'Living Room',
  'Kitchen',
  'Main Bedroom',
  'Bedroom 2',
  'Bedroom 3',
  'Bathroom 1',
  'Bathroom 2',
  'Garage',
  'Garden/Yard',
  'Entrance/Hallway',
];

// Standard items to check in each room
export const ROOM_ITEMS: Record<string, string[]> = {
  'Living Room': ['Walls', 'Ceiling', 'Floor/Carpet', 'Windows', 'Doors', 'Light Fixtures', 'Electrical Outlets', 'Curtains/Blinds'],
  'Kitchen': ['Walls', 'Ceiling', 'Floor', 'Countertops', 'Cabinets', 'Sink', 'Stove/Oven', 'Extractor Fan', 'Windows', 'Electrical Outlets'],
  'Main Bedroom': ['Walls', 'Ceiling', 'Floor/Carpet', 'Windows', 'Doors', 'Built-in Cupboards', 'Light Fixtures', 'Electrical Outlets'],
  'Bedroom 2': ['Walls', 'Ceiling', 'Floor/Carpet', 'Windows', 'Doors', 'Built-in Cupboards', 'Light Fixtures', 'Electrical Outlets'],
  'Bedroom 3': ['Walls', 'Ceiling', 'Floor/Carpet', 'Windows', 'Doors', 'Built-in Cupboards', 'Light Fixtures', 'Electrical Outlets'],
  'Bathroom 1': ['Walls', 'Ceiling', 'Floor/Tiles', 'Toilet', 'Basin', 'Shower/Bath', 'Taps', 'Mirror', 'Towel Rails', 'Extractor Fan'],
  'Bathroom 2': ['Walls', 'Ceiling', 'Floor/Tiles', 'Toilet', 'Basin', 'Shower/Bath', 'Taps', 'Mirror', 'Towel Rails', 'Extractor Fan'],
  'Garage': ['Walls', 'Floor', 'Door', 'Automated Door Opener', 'Light Fixtures', 'Electrical Outlets'],
  'Garden/Yard': ['Lawn', 'Garden Beds', 'Fencing', 'Gate', 'Paving', 'Pool (if applicable)', 'Borehole (if applicable)'],
  'Entrance/Hallway': ['Walls', 'Ceiling', 'Floor', 'Front Door', 'Security Gate', 'Intercom', 'Light Fixtures'],
};
