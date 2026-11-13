import { parseInspectionRoomsField, parseTenantComments } from '../utils/normalizeRooms';

let mockStored: any;
const mockUpdates: any[] = [];

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { rooms: mockStored }, error: null }) }),
      }),
      update: (payload: any) => {
        mockUpdates.push(payload);
        mockStored = payload.rooms;
        const result = { data: { rooms: mockStored }, error: null };
        return {
          eq: () => ({
            then: (resolve: any) => resolve(result),
            select: () => ({ single: async () => result }),
          }),
        };
      },
    }),
  },
}));

// eslint-disable-next-line import/first
import { inspectionsApi } from '../api/inspectionsApi';

const ownerRooms = [
  {
    name: 'Kitchen',
    overallCondition: 'poor',
    notes: 'Owner note',
    photos: ['p1'],
    items: [{ name: 'Sink', condition: 'damaged', notes: 'Cracked', photos: ['p2'] }],
  },
];

describe('tenant inspection comments', () => {
  beforeEach(() => {
    mockUpdates.length = 0;
    mockStored = { rooms: ownerRooms, generalNotes: 'General', keys: { physicalKeys: 2 } };
  });

  it('adds a comment without changing anything the owner recorded', async () => {
    const comments = await inspectionsApi.addTenantComment('i1', 'Kitchen', '  Tap drips  ');

    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ room: 'Kitchen', text: 'Tap drips' });
    expect(mockStored.rooms).toEqual(ownerRooms);
    expect(mockStored.generalNotes).toBe('General');
    expect(mockStored.keys).toEqual({ physicalKeys: 2 });
  });

  it('appends to existing comments rather than replacing them', async () => {
    await inspectionsApi.addTenantComment('i1', 'Kitchen', 'First');
    const comments = await inspectionsApi.addTenantComment('i1', 'Bathroom 1', 'Second');

    expect(comments.map((c) => c.text)).toEqual(['First', 'Second']);
  });

  it('keeps tenant comments when the owner saves the checklist', async () => {
    await inspectionsApi.addTenantComment('i1', 'Kitchen', 'Tap drips');

    await inspectionsApi.updateInspectionRooms('i1', { rooms: [], generalNotes: 'Changed' });

    expect(mockStored.generalNotes).toBe('Changed');
    expect(mockStored.tenantComments.map((c: any) => c.text)).toEqual(['Tap drips']);
  });

  it('links a comment to the maintenance request raised from it', async () => {
    const [comment] = await inspectionsApi.addTenantComment('i1', 'Kitchen', 'Tap drips');

    const comments = await inspectionsApi.linkTenantCommentToRequest('i1', comment.id, 'req-1');

    expect(comments[0].maintenanceRequestId).toBe('req-1');
    expect(comments[0].text).toBe('Tap drips');
  });

  it('handles the legacy array format for rooms', async () => {
    mockStored = ownerRooms;

    await inspectionsApi.addTenantComment('i1', 'Kitchen', 'Tap drips');

    expect(mockStored.rooms).toEqual(ownerRooms);
    expect(mockStored.tenantComments).toHaveLength(1);
  });

  it('parses comments and drops malformed entries', () => {
    const good = { id: 'a', room: 'Kitchen', text: 'x', createdAt: '2026-11-12' };
    expect(parseTenantComments([good, null, { id: 1 }, 'nope'])).toEqual([good]);
    expect(parseTenantComments(undefined)).toEqual([]);
    expect(
      parseInspectionRoomsField({ rooms: ownerRooms, tenantComments: [good] }).tenantComments
    ).toEqual([good]);
  });
});
