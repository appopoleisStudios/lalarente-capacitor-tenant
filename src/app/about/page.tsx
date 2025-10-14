'use client'

import { useMemo } from 'react'

export default function AboutPage() {
  const featureTag = process.env.NEXT_PUBLIC_FEATURE_TAG || 'general'
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA || 'dev'
  const gitBranch = process.env.NEXT_PUBLIC_GIT_BRANCH || 'local'
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()
  const featuresRaw = process.env.NEXT_PUBLIC_FEATURES || ''
  const historyRaw = process.env.NEXT_PUBLIC_FEATURES_HISTORY || ''

  const features = useMemo(() => (
    featuresRaw
      .split(/\r?\n|\|/)
      .map(s => s.trim())
      .filter(Boolean)
  ), [featuresRaw])

  const history = useMemo(() => (
    historyRaw
      .split(/\r?\n/) // expect multi-line entries like "[2025-09-26] Feature..."
      .map(s => s.trim())
      .filter(Boolean)
  ), [historyRaw])

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-3">About This Debug Build</h1>

      <div className="rounded-lg border border-gray-200 p-4 mb-4 bg-white">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-gray-600">Feature Tag</div>
          <div className="col-span-2 font-medium">{featureTag}</div>
          <div className="text-gray-600">Git Branch</div>
          <div className="col-span-2 font-mono">{gitBranch}</div>
          <div className="text-gray-600">Git SHA</div>
          <div className="col-span-2 font-mono">{gitSha}</div>
          <div className="text-gray-600">Build Time</div>
          <div className="col-span-2">{buildTime}</div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 mb-4 bg-white">
        <h2 className="text-base font-semibold mb-2">Features in this Build</h2>
        {features.length === 0 ? (
          <div className="text-sm text-gray-500">No features listed. Set NEXT_PUBLIC_FEATURES to populate.</div>
        ) : (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {features.map((f, i) => (
              <li key={`${f}-${i}`}>{f}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 p-4 bg-white">
        <h2 className="text-base font-semibold mb-2">Previously Added Features</h2>
        {history.length === 0 ? (
          <div className="text-sm text-gray-500">No history provided. Set NEXT_PUBLIC_FEATURES_HISTORY.</div>
        ) : (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={`${h}-${i}`}>{h}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}






