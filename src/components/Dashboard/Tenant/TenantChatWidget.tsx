import { useState } from 'react'
const TenantChatWidget = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="fixed bottom-24 right-4 bg-emerald-600 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50"
        onClick={() => setOpen(true)}
        aria-label="Open chat"
      >
        <i className="fas fa-comments text-white text-2xl"></i>
      </button>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-80 max-w-xs bg-white rounded-xl shadow-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-emerald-700">Chat with Manager</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
              <i className="fas fa-times"></i>
            </button>
          </div>
          {/* Real chat UI would go here */}
          <div className="h-32 bg-gray-50 rounded mb-2 p-2 text-xs text-gray-500 overflow-y-auto">
            <div><b>You:</b> My kitchen tap needs repair</div>
            <div className="mt-2"><b>Manager:</b> Technician coming tomorrow, 10-12AM.</div>
          </div>
          <input className="w-full border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Type a message..." />
          <button className="w-full mt-2 bg-emerald-600 text-white py-1 rounded text-xs font-semibold">Send</button>
        </div>
      )}
    </>
  )
}
export default TenantChatWidget
