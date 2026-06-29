/**
 * Centralised query keys for TanStack Query.
 *
 * Design rationale:
 * - Hierarchical key structure enables precise invalidation:
 *   e.g. `queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.requests(userId, role) })`
 *       invalidates only that user's requests, while
 *       `queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all })`
 *       invalidates ALL maintenance queries across users.
 * - Dynamic segments (userId, role, requestId) are placed after static segments
 *   so pattern matching works correctly with prefix queries.
 * - `as const` ensures each key tuple is a literal type (not string[]),
 *   giving us type-safe cache access throughout the app.
 */
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
