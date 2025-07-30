import { useState } from 'react'

interface AutoPayToggleProps {
  enabled?: boolean
  onToggle?: (enabled: boolean) => void
}

export default function AutoPayToggle({ enabled: initialEnabled = false, onToggle }: AutoPayToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled)

  const handleToggle = () => {
    const newEnabled = !enabled
    setEnabled(newEnabled)
    onToggle?.(newEnabled)
  }

  return (
    <div className="flex items-center justify-between my-5 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div>
        <div className="font-semibold text-gray-800 text-sm mb-1">Auto-Pay</div>
        <div className="text-xs text-gray-500">
          {enabled ? (
            <span className="text-emerald-700">
              Your rent is set to auto-pay each month.
            </span>
          ) : (
            'Enable auto-pay for hassle-free rent payments.'
          )}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        tabIndex={0}
        type="button"
        className={`relative w-12 h-7 transition-colors duration-300 rounded-full 
          ${enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
        onClick={handleToggle}
      >
        <span
          className={`absolute left-1 top-1 transition-transform duration-300 rounded-full bg-white shadow-md h-5 w-5 border 
            ${enabled ? 'translate-x-5 border-emerald-500' : 'border-gray-300'}`}
          style={{
            transition: 'transform 0.2s cubic-bezier(.4,0,.2,1), box-shadow 0.2s'
          }}
        />
      </button>
    </div>
  )
}
