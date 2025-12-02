/**
 * Maintenance API Barrel Export
 * Main entry point for all maintenance-related APIs
 */

// ============================================
// TYPE EXPORTS
// ============================================
export * from './types';

// ============================================
// MAINTENANCE REQUESTS
// ============================================
export * from './requests/maintenanceFilters.api';
export * from './requests/maintenanceRequests.api';
export * from './requests/maintenanceWorkflow.api';

// Export subscription functions with specific names to avoid conflicts
export {
  subscribeToMaintenanceRequests,
  unsubscribe as unsubscribeFromMaintenanceRequests
} from './requests/maintenanceSubscriptions.api';

// ============================================
// VENDORS
// ============================================
export * from './vendors/vendorDiscovery.api';
export * from './vendors/vendorQuoteRequests.api';
export * from './vendors/vendorRouting.api';

// Export vendor maintenance functions with vendor prefix to avoid conflicts
export {
  declineQuoteRequest as declineVendorQuoteRequest, getAvailableRequests as getVendorAvailableRequests, getMyJobs as getVendorMyJobs, getRequestById as getVendorRequestById, submitQuote as submitVendorQuote, updateJobStatus as updateVendorJobStatus
} from './vendors/vendorMaintenance.api';

// ============================================
// WORK EXECUTION
// ============================================
export * from './work/workClosure.api';
export * from './work/workExecution.api';
export * from './work/workProgress.api';

// ============================================
// QUOTES
// ============================================
export * from './quotes/quoteActions.api';
export * from './quotes/quoteRevisions.api';
export * from './quotes/quotes.api';

// Export quote subscription functions with specific names
export {
  subscribeToQuotes,
  unsubscribe as unsubscribeFromQuotes
} from './quotes/quoteSubscriptions.api';

// ============================================
// PURCHASE ORDERS
// ============================================
export * from './purchase-orders/poActions.api';
export * from './purchase-orders/poAudit.api';
export * from './purchase-orders/poRevisions.api';
export * from './purchase-orders/purchaseOrders.api';

// ============================================
// MESSAGES
// ============================================
export * from './messages/messages.api';

// Export message subscription functions with specific names
export {
  subscribeToMessages,
  unsubscribe as unsubscribeFromMessages
} from './messages/messageSubscriptions.api';

// ============================================
// BACKWARD COMPATIBILITY
// Re-export old API objects for gradual migration
// ============================================
import * as MaintenanceFiltersAPI from './requests/maintenanceFilters.api';
import * as MaintenanceRequestsAPI from './requests/maintenanceRequests.api';
import * as MaintenanceSubscriptionsAPI from './requests/maintenanceSubscriptions.api';
import * as MaintenanceWorkflowAPI from './requests/maintenanceWorkflow.api';
import * as VendorDiscoveryAPI from './vendors/vendorDiscovery.api';
import * as VendorRoutingAPI from './vendors/vendorRouting.api';
import * as WorkClosureAPI from './work/workClosure.api';
import * as WorkExecutionAPI from './work/workExecution.api';

/**
 * @deprecated Use named imports instead
 * This object is provided for backward compatibility only
 * 
 * @example
 * // Old way (deprecated):
 * import { maintenanceApi } from '@/features/maintenance/api';
 * maintenanceApi.getMaintenanceRequests(userId, role);
 * 
 * // New way (recommended):
 * import { getMaintenanceRequests } from '@/features/maintenance/api';
 * getMaintenanceRequests(userId, role);
 */
export const maintenanceApi = {
  // Maintenance Requests
  getMaintenanceRequests: MaintenanceRequestsAPI.getMaintenanceRequests,
  getMaintenanceRequestById: MaintenanceRequestsAPI.getMaintenanceRequestById,
  createMaintenanceRequest: MaintenanceRequestsAPI.createMaintenanceRequest,
  updateMaintenanceRequest: MaintenanceRequestsAPI.updateMaintenanceRequest,
  deleteMaintenanceRequest: MaintenanceRequestsAPI.deleteMaintenanceRequest,
  getOwnerProperties: MaintenanceRequestsAPI.getOwnerProperties,
  getPropertyOwner: MaintenanceRequestsAPI.getPropertyOwner,
  
  // Filters
  filterByStatus: MaintenanceFiltersAPI.filterByStatus,
  filterByPriority: MaintenanceFiltersAPI.filterByPriority,
  getServiceCategories: MaintenanceFiltersAPI.getServiceCategories,
  
  // Workflow
  updateStatus: MaintenanceWorkflowAPI.updateStatus,
  updateMmsStatus: MaintenanceWorkflowAPI.updateMmsStatus,
  updatePriority: MaintenanceWorkflowAPI.updatePriority,
  acknowledgeRequest: MaintenanceWorkflowAPI.acknowledgeRequest,
  closeRequest: MaintenanceWorkflowAPI.closeRequest,
  
  // Subscriptions
  subscribeToMaintenanceRequests: MaintenanceSubscriptionsAPI.subscribeToMaintenanceRequests,
  unsubscribe: MaintenanceSubscriptionsAPI.unsubscribe as any,
  
  // Vendor Discovery
  getVendorsByCategory: VendorDiscoveryAPI.getVendorsByCategory,
  getDedicatedVendors: VendorDiscoveryAPI.getDedicatedVendors,
  getVendorsForRequest: VendorDiscoveryAPI.getVendorsForRequest,
  searchVendorByEmail: VendorDiscoveryAPI.searchVendorByEmail,
  getVendorCategories: VendorDiscoveryAPI.getVendorCategories,
  
  // Vendor Routing
  pushToOpenMarket: VendorRoutingAPI.pushToOpenMarket,
  pushToDedicatedVendors: VendorRoutingAPI.pushToDedicatedVendors,
  pushToSelectedVendors: VendorRoutingAPI.pushToSelectedVendors,
  inviteVendorByEmail: VendorRoutingAPI.inviteVendorByEmail,
  
  // Work Execution
  startWork: WorkExecutionAPI.startWork,
  submitProgressUpdate: WorkExecutionAPI.submitProgressUpdate,
  getProgressUpdates: WorkExecutionAPI.getProgressUpdates,
  
  // Work Closure
  requestClosure: WorkClosureAPI.requestClosure,
  getClosureReport: WorkClosureAPI.getClosureReport,
};

// Export vendor maintenance API separately for backward compatibility
import * as VendorMaintenanceAPI from './vendors/vendorMaintenance.api';

/**
 * @deprecated Use named imports instead
 * This object is provided for backward compatibility only
 */
export const vendorMaintenanceApi = {
  getAvailableRequests: VendorMaintenanceAPI.getAvailableRequests,
  getRequestById: VendorMaintenanceAPI.getRequestById,
  getMyJobs: VendorMaintenanceAPI.getMyJobs,
  updateJobStatus: VendorMaintenanceAPI.updateJobStatus,
  submitQuote: VendorMaintenanceAPI.submitQuote,
  declineQuoteRequest: VendorMaintenanceAPI.declineQuoteRequest,
};

// Export quotes API for backward compatibility
import * as QuoteActionsAPI from './quotes/quoteActions.api';
import * as QuoteRevisionsAPI from './quotes/quoteRevisions.api';
import * as QuotesAPI from './quotes/quotes.api';
import * as QuoteSubscriptionsAPI from './quotes/quoteSubscriptions.api';

/**
 * @deprecated Use named imports instead
 * This object is provided for backward compatibility only
 */
export const quotesApi = {
  getQuotesByRequest: QuotesAPI.getQuotesByRequest,
  getQuoteById: QuotesAPI.getQuoteById,
  getApprovedQuote: QuotesAPI.getApprovedQuote,
  submitQuote: QuotesAPI.submitQuote,
  updateQuote: QuotesAPI.updateQuote,
  acceptQuote: QuoteActionsAPI.acceptQuote,
  rejectQuote: QuoteActionsAPI.rejectQuote,
  requestQuoteRevision: QuoteActionsAPI.requestQuoteRevision,
  generatePOFromQuote: QuoteActionsAPI.generatePOFromQuote,
  getQuoteRevisions: QuoteRevisionsAPI.getQuoteRevisions,
  subscribeToQuotes: QuoteSubscriptionsAPI.subscribeToQuotes,
  unsubscribe: QuoteSubscriptionsAPI.unsubscribe as any,
};

// Export purchase orders API for backward compatibility
import * as POActionsAPI from './purchase-orders/poActions.api';
import * as POAuditAPI from './purchase-orders/poAudit.api';
import * as PORevisionsAPI from './purchase-orders/poRevisions.api';
import * as PurchaseOrdersAPI from './purchase-orders/purchaseOrders.api';

/**
 * @deprecated Use named imports instead
 * This object is provided for backward compatibility only
 */
export const purchaseOrdersApi = {
  getPOById: PurchaseOrdersAPI.getPOById,
  getPOByRequestId: PurchaseOrdersAPI.getPOByRequestId,
  getPOWithDetails: PurchaseOrdersAPI.getPOWithDetails,
  updatePO: PurchaseOrdersAPI.updatePO,
  updatePOStatus: POActionsAPI.updatePOStatus,
  sendPOToVendor: POActionsAPI.sendPOToVendor,
  getPORevisions: PORevisionsAPI.getPORevisions,
  getDisputeAuditTrail: POAuditAPI.getDisputeAuditTrail,
};

// Export messages API for backward compatibility
import * as MessagesAPI from './messages/messages.api';
import * as MessageSubscriptionsAPI from './messages/messageSubscriptions.api';

/**
 * @deprecated Use named imports instead
 * This object is provided for backward compatibility only
 */
export const messagesApi = {
  getMessages: MessagesAPI.getMessages,
  sendMessage: MessagesAPI.sendMessage,
  markAsRead: MessagesAPI.markAsRead,
  getUnreadCount: MessagesAPI.getUnreadCount,
  subscribeToMessages: MessageSubscriptionsAPI.subscribeToMessages,
  unsubscribe: MessageSubscriptionsAPI.unsubscribe as any,
};
