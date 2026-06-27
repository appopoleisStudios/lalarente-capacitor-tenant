/** Centralised query keys — avoid collisions, enable predictable invalidation */
export const queryKeys = {
  maintenance: {
    all: ['maintenance'] as const,
    requests: (userId?: string, role?: string) =>
      ['maintenance', 'requests', userId, role] as const,
    detail: (requestId?: string) =>
      ['maintenance', 'detail', requestId] as const,
    quotes: (requestId?: string) =>
      ['maintenance', 'quotes', requestId] as const,
  },
  properties: {
    all: ['properties'] as const,
    list: (ownerId?: string) =>
      ['properties', 'list', ownerId] as const,
    detail: (propertyId?: string) =>
      ['properties', 'detail', propertyId] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (userId?: string, role?: string) =>
      ['payments', 'list', userId, role] as const,
    detail: (paymentId?: string) =>
      ['payments', 'detail', paymentId] as const,
  },
  leases: {
    all: ['leases'] as const,
    list: (userId?: string, role?: string) =>
      ['leases', 'list', userId, role] as const,
    detail: (leaseId?: string) =>
      ['leases', 'detail', leaseId] as const,
  },
  messages: {
    all: ['messages'] as const,
    threads: (userId?: string) =>
      ['messages', 'threads', userId] as const,
    detail: (threadId?: string) =>
      ['messages', 'detail', threadId] as const,
  },
} as const;
