'use client'

import { useMemo, useState } from 'react'

interface DebugAboutProps {
  position?: 'bottom-right' | 'bottom-left'
}

export default function DebugAbout({ position = 'bottom-right' }: DebugAboutProps) {
  const [open, setOpen] = useState(false)

  const featureTag = process.env.NEXT_PUBLIC_FEATURE_TAG || 'general'
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA || 'dev'
  const gitBranch = process.env.NEXT_PUBLIC_GIT_BRANCH || 'local'
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()
  const featuresRaw = process.env.NEXT_PUBLIC_FEATURES || ''

  const features = useMemo(() => {
    return featuresRaw
      .split(/\r?\n|\|/)
      .map(s => s.trim())
      .filter(Boolean)
  }, [featuresRaw])

  const buttonPosition = position === 'bottom-right'
    ? 'right-4 bottom-20'
    : 'left-4 bottom-20'

  return (
    <div className="fixed z-[1000]">
      <button
        type="button"
        aria-label="About this build"
        onClick={() => setOpen(true)}
        className={`fixed ${buttonPosition} rounded-full bg-emerald-600 text-white shadow-lg px-3 py-2 text-xs font-medium hover:bg-emerald-700`}
      >
        About
      </button>

      {open && (
        <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:w-[480px] max-h-[80vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white text-gray-900 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Debug Build Info</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-gray-600">Feature Tag</div>
                <div className="col-span-2 font-medium">{featureTag}</div>
                <div className="text-gray-600">Git Branch</div>
                <div className="col-span-2 font-mono">{gitBranch}</div>
                <div className="text-gray-600">Git SHA</div>
                <div className="col-span-2 font-mono">{gitSha}</div>
                <div className="text-gray-600">Build Time</div>
                <div className="col-span-2">{buildTime}</div>
              </div>

              <div>
                <div className="text-gray-600 mb-1">Included Features</div>
                {features.length === 0 ? (
                  <div className="text-gray-500 italic">No features provided. Set NEXT_PUBLIC_FEATURES.</div>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {features.map((f, i) => (
                      <li key={`${f}-${i}`}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






