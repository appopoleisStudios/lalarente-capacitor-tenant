import { CATEGORY_INFO, ThreadCategory } from '../types';

describe('messagesApi', () => {
  describe('CATEGORY_INFO', () => {
    it('should have info for all thread categories', () => {
      const categories: ThreadCategory[] = [
        'general',
        'maintenance',
        'lease',
        'payment',
        'emergency',
      ];

      categories.forEach((category) => {
        expect(CATEGORY_INFO[category]).toBeDefined();
        expect(CATEGORY_INFO[category].label).toBeTruthy();
        expect(CATEGORY_INFO[category].icon).toBeTruthy();
        expect(CATEGORY_INFO[category].color).toBeTruthy();
      });
    });

    it('should have distinct colors for each category', () => {
      const colors = Object.values(CATEGORY_INFO).map((info) => info.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('should have appropriate labels for categories', () => {
      expect(CATEGORY_INFO.general.label).toBe('General');
      expect(CATEGORY_INFO.maintenance.label).toBe('Maintenance');
      expect(CATEGORY_INFO.lease.label).toBe('Lease');
      expect(CATEGORY_INFO.payment.label).toBe('Payment');
    });

    it('should have valid icon names', () => {
      Object.values(CATEGORY_INFO).forEach((info) => {
        expect(typeof info.icon).toBe('string');
        expect(info.icon.length).toBeGreaterThan(0);
      });
    });

    it('should have valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      Object.values(CATEGORY_INFO).forEach((info) => {
        expect(info.color).toMatch(hexColorRegex);
      });
    });
  });
});
