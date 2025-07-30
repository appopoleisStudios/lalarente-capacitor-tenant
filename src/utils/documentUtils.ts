/**
 * Document utilities for managing document data and IDs
 */

export interface Document {
  id: string
  name: string
  date: string
  icon: string
  type?: string
  url?: string
  size?: number
}

/**
 * Generate a stable ID for a document based on its name and date
 * @param name - Document name
 * @param date - Document date
 * @returns Stable ID string
 */
export function generateDocumentId(name: string, date: string): string {
  // Create a URL-friendly ID from the name
  const nameSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
  
  // Add date as suffix for uniqueness
  const dateSlug = date
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim()
  
  return `${nameSlug}-${dateSlug}`
}

/**
 * Ensure all documents have stable IDs
 * @param documents - Array of documents that may or may not have IDs
 * @returns Array of documents with guaranteed stable IDs
 */
export function ensureDocumentIds(documents: Partial<Document>[]): Document[] {
  return documents.map((doc, index) => ({
    id: doc.id || generateDocumentId(doc.name || `document-${index}`, doc.date || 'unknown'),
    name: doc.name || `Document ${index + 1}`,
    date: doc.date || 'Unknown',
    icon: doc.icon || 'fas fa-file',
    type: doc.type,
    url: doc.url,
    size: doc.size
  }))
}

/**
 * Create a document object with all required fields
 * @param name - Document name
 * @param date - Document date
 * @param icon - Document icon
 * @param options - Additional document properties
 * @returns Complete document object
 */
export function createDocument(
  name: string,
  date: string,
  icon: string,
  options: Partial<Document> = {}
): Document {
  return {
    id: options.id || generateDocumentId(name, date),
    name,
    date,
    icon,
    type: options.type,
    url: options.url,
    size: options.size
  }
}

/**
 * Validate document data
 * @param document - Document to validate
 * @returns Validation result
 */
export function validateDocument(document: Partial<Document>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!document.name || document.name.trim() === '') {
    errors.push('Document name is required')
  }
  
  if (!document.date || document.date.trim() === '') {
    errors.push('Document date is required')
  }
  
  if (!document.icon || document.icon.trim() === '') {
    errors.push('Document icon is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Sort documents by date (newest first)
 * @param documents - Array of documents to sort
 * @returns Sorted array of documents
 */
export function sortDocumentsByDate(documents: Document[]): Document[] {
  return [...documents].sort((a, b) => {
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)
    return dateB.getTime() - dateA.getTime()
  })
}

/**
 * Filter documents by type
 * @param documents - Array of documents to filter
 * @param type - Document type to filter by
 * @returns Filtered array of documents
 */
export function filterDocumentsByType(documents: Document[], type: string): Document[] {
  return documents.filter(doc => doc.type === type)
}

/**
 * Search documents by name
 * @param documents - Array of documents to search
 * @param query - Search query
 * @returns Filtered array of documents matching the query
 */
export function searchDocuments(documents: Document[], query: string): Document[] {
  const lowerQuery = query.toLowerCase()
  return documents.filter(doc => 
    doc.name.toLowerCase().includes(lowerQuery) ||
    doc.date.toLowerCase().includes(lowerQuery)
  )
} 