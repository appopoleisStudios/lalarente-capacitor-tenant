import type React from 'react'
import { Document } from '@/utils/documentUtils'

interface Props {
  docs: Document[]
  onOpen: (name: string) => void
  onSeeAll: () => void
}
const DocumentsCenter: React.FC<Props> = ({ docs, onOpen, onSeeAll }) => (
  <section className="mb-6" aria-labelledby="documents-heading">
    <div className="flex items-center mb-2 justify-between">
      <h3 id="documents-heading" className="text-base font-semibold text-gray-800">My Documents</h3>
      <button 
        onClick={onSeeAll} 
        aria-label="View all documents"
        className="text-sm text-blue-700 font-medium hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-2 py-1 transition-colors"
      >
        See All
      </button>
    </div>
    <div className="grid grid-cols-3 gap-3" role="grid" aria-label="Document grid">
      {docs.map((doc) => (
        <button
          key={doc.id}
          aria-label={`Open ${doc.name} document from ${doc.date}`}
          className="bg-white rounded-lg border border-gray-100 p-3 flex flex-col items-center shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all"
          onClick={() => onOpen(doc.name)}
        >
          <i className={`${doc.icon} text-xl text-emerald-600 mb-1`} aria-hidden="true"></i>
          <span className="text-sm font-medium text-gray-700 truncate w-full text-center">{doc.name}</span>
          <span className="text-xs text-gray-400">{doc.date}</span>
        </button>
      ))}
    </div>
  </section>
)
export default DocumentsCenter
