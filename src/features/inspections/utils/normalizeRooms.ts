import {
  DEFAULT_ROOMS,
  ROOM_ITEMS,
  type InspectionRooms,
  type KeyHandover,
  type RoomCondition,
  type RoomInspection,
} from '../types';

const VALID_CONDITIONS: RoomCondition[] = ['excellent', 'good', 'fair', 'poor', 'damaged'];

function asCondition(value: unknown): RoomCondition {
  const v = String(value ?? '');
  return VALID_CONDITIONS.includes(v as RoomCondition) ? (v as RoomCondition) : 'good';
}

export function buildDefaultRooms(): RoomInspection[] {
  return DEFAULT_ROOMS.map((roomName) => ({
    name: roomName,
    items: (ROOM_ITEMS[roomName] || []).map((item) => ({
      name: item,
      condition: 'good' as RoomCondition,
      notes: '',
      photos: [],
    })),
    overallCondition: 'good' as RoomCondition,
    notes: '',
    photos: [],
  }));
}

/** Ensures each room has items[] and valid condition fields (prevents render crashes). */
export function normalizeRoomList(raw: unknown): RoomInspection[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return buildDefaultRooms();
  }

  return raw.map((room, index) => {
    const r = room as Record<string, unknown>;
    const name =
      typeof r.name === 'string' && r.name.trim() ? r.name.trim() : `Room ${index + 1}`;
    const overallCondition = asCondition(r.overallCondition);

    let items: RoomInspection['items'] = [];
    if (Array.isArray(r.items) && r.items.length > 0) {
      items = r.items.map((item, iIdx) => {
        const it = item as Record<string, unknown>;
        return {
          name: typeof it.name === 'string' ? it.name : `Item ${iIdx + 1}`,
          condition: asCondition(it.condition),
          notes: typeof it.notes === 'string' ? it.notes : '',
          photos: Array.isArray(it.photos)
            ? it.photos.filter((p): p is string => typeof p === 'string')
            : [],
        };
      });
    } else {
      items = (ROOM_ITEMS[name] || []).map((item) => ({
        name: item,
        condition: 'good' as RoomCondition,
        notes: '',
        photos: [],
      }));
    }

    return {
      name,
      items,
      overallCondition,
      notes: typeof r.notes === 'string' ? r.notes : '',
      photos: Array.isArray(r.photos)
        ? r.photos.filter((p): p is string => typeof p === 'string')
        : [],
    };
  });
}

const defaultKeys = (): KeyHandover => ({
  physicalKeys: 0,
  accessCards: 0,
  remoteControls: 0,
  accessCodes: [],
});

export function parseInspectionRoomsField(roomsField: unknown): InspectionRooms {
  if (!roomsField) {
    return { rooms: buildDefaultRooms(), keys: defaultKeys(), generalNotes: '' };
  }

  let parsed: unknown = roomsField;
  if (typeof roomsField === 'string') {
    try {
      parsed = JSON.parse(roomsField);
    } catch {
      return { rooms: buildDefaultRooms(), keys: defaultKeys(), generalNotes: '' };
    }
  }

  if (Array.isArray(parsed)) {
    return { rooms: normalizeRoomList(parsed), keys: defaultKeys(), generalNotes: '' };
  }

  const obj = parsed as Record<string, unknown>;
  const rawRooms = obj.rooms;
  const keysRaw = obj.keys as KeyHandover | undefined;

  return {
    rooms: normalizeRoomList(rawRooms),
    generalNotes: typeof obj.generalNotes === 'string' ? obj.generalNotes : '',
    keys: keysRaw
      ? {
          physicalKeys: Number(keysRaw.physicalKeys) || 0,
          accessCards: Number(keysRaw.accessCards) || 0,
          remoteControls: Number(keysRaw.remoteControls) || 0,
          accessCodes: Array.isArray(keysRaw.accessCodes)
            ? keysRaw.accessCodes.filter((c): c is string => typeof c === 'string')
            : [],
        }
      : defaultKeys(),
  };
}
