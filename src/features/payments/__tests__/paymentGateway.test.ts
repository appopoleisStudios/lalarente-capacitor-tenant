import type {
  PaymentStatus,
  PaymentType,
  PaymentMethod,
  PaymentGateway,
} from '../types';

describe('Payment Types', () => {
  describe('PaymentStatus', () => {
    it('should support all expected payment statuses', () => {
      const statuses: PaymentStatus[] = [
        'pending',
        'processing',
        'completed',
        'failed',
        'refunded',
      ];

      // Type check passes if this compiles
      statuses.forEach((status) => {
        expect(typeof status).toBe('string');
      });
    });
  });

  describe('PaymentType', () => {
    it('should support all expected payment types', () => {
      const types: PaymentType[] = [
        'rent',
        'deposit',
        'application_fee',
        'late_fee',
        'utility',
        'other',
      ];

      // Verify all types are valid
      types.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });

    it('should have rent as a primary payment type', () => {
      const rentType: PaymentType = 'rent';
      expect(rentType).toBe('rent');
    });
  });

  describe('PaymentMethod', () => {
    it('should support South African payment methods', () => {
      const methods: PaymentMethod[] = [
        'bank_transfer',
        'card',
        'cash',
        'eft',
        'debit_order',
      ];

      methods.forEach((method) => {
        expect(typeof method).toBe('string');
      });
    });

    it('should include EFT which is common in SA', () => {
      const eftMethod: PaymentMethod = 'eft';
      expect(eftMethod).toBe('eft');
    });
  });

  describe('PaymentGateway', () => {
    it('should support SA payment gateways', () => {
      const gateways: PaymentGateway[] = [
        'payfast',
        'yoco',
        'manual',
      ];

      gateways.forEach((gateway) => {
        expect(typeof gateway).toBe('string');
      });
    });

    it('should include PayFast for SA payments', () => {
      const payfastGateway: PaymentGateway = 'payfast';
      expect(payfastGateway).toBe('payfast');
    });

    it('should include Yoco for SA payments', () => {
      const yocoGateway: PaymentGateway = 'yoco';
      expect(yocoGateway).toBe('yoco');
    });
  });
});

describe('Payment Amount Formatting', () => {
  // Helper function that would exist in the gateway
  const formatZAR = (amount: number): string => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const convertToCents = (amount: number): number => {
    return Math.round(amount * 100);
  };

  describe('formatZAR', () => {
    it('should format amounts in South African Rand', () => {
      const formatted = formatZAR(1500);
      expect(formatted).toContain('R');
      expect(formatted).toContain('1');
      expect(formatted).toContain('500');
    });

    it('should handle decimal amounts', () => {
      const formatted = formatZAR(1500.50);
      expect(formatted).toContain('50');
    });
  });

  describe('convertToCents', () => {
    it('should convert rand to cents', () => {
      expect(convertToCents(15.00)).toBe(1500);
      expect(convertToCents(1500.99)).toBe(150099);
      expect(convertToCents(0.01)).toBe(1);
    });

    it('should handle whole numbers', () => {
      expect(convertToCents(100)).toBe(10000);
      expect(convertToCents(1)).toBe(100);
    });

    it('should handle zero', () => {
      expect(convertToCents(0)).toBe(0);
    });
  });
});
