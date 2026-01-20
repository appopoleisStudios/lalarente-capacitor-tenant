import { DEFAULT_ROOMS, ROOM_ITEMS } from '../types';

describe('inspectionsApi', () => {
  describe('DEFAULT_ROOMS', () => {
    it('should contain essential rooms for South African properties', () => {
      const essentialRooms = [
        'Living Room',
        'Kitchen',
        'Main Bedroom',
        'Bathroom 1',
      ];

      essentialRooms.forEach((room) => {
        expect(DEFAULT_ROOMS).toContain(room);
      });
    });

    it('should include outdoor and utility areas', () => {
      expect(DEFAULT_ROOMS).toContain('Garage');
      expect(DEFAULT_ROOMS).toContain('Garden/Yard');
    });

    it('should have a reasonable number of rooms', () => {
      expect(DEFAULT_ROOMS.length).toBeGreaterThanOrEqual(8);
      expect(DEFAULT_ROOMS.length).toBeLessThanOrEqual(15);
    });

    it('should include entrance area', () => {
      expect(DEFAULT_ROOMS).toContain('Entrance/Hallway');
    });
  });

  describe('ROOM_ITEMS', () => {
    it('should have items for all default rooms', () => {
      DEFAULT_ROOMS.forEach((room) => {
        expect(ROOM_ITEMS[room]).toBeDefined();
        expect(Array.isArray(ROOM_ITEMS[room])).toBe(true);
        expect(ROOM_ITEMS[room].length).toBeGreaterThan(0);
      });
    });

    it('should include basic structural items in living areas', () => {
      const livingRoom = ROOM_ITEMS['Living Room'];
      expect(livingRoom).toContain('Walls');
      expect(livingRoom).toContain('Ceiling');
      expect(livingRoom).toContain('Windows');
      expect(livingRoom).toContain('Doors');
    });

    it('should include specific items for kitchen', () => {
      const kitchen = ROOM_ITEMS['Kitchen'];
      expect(kitchen).toContain('Countertops');
      expect(kitchen).toContain('Cabinets');
      expect(kitchen).toContain('Sink');
      expect(kitchen).toContain('Stove/Oven');
    });

    it('should include specific items for bathroom', () => {
      const bathroom = ROOM_ITEMS['Bathroom 1'];
      expect(bathroom).toContain('Toilet');
      expect(bathroom).toContain('Basin');
      expect(bathroom).toContain('Shower/Bath');
      expect(bathroom).toContain('Taps');
    });

    it('should include electrical items in living spaces', () => {
      const bedroom = ROOM_ITEMS['Main Bedroom'];
      expect(bedroom).toContain('Light Fixtures');
      expect(bedroom).toContain('Electrical Outlets');
    });

    it('should include security items in entrance', () => {
      const entrance = ROOM_ITEMS['Entrance/Hallway'];
      expect(entrance).toContain('Front Door');
      expect(entrance).toContain('Security Gate');
    });

    it('should include outdoor items for garden', () => {
      const garden = ROOM_ITEMS['Garden/Yard'];
      expect(garden).toContain('Lawn');
      expect(garden).toContain('Fencing');
      expect(garden).toContain('Gate');
    });
  });
});
