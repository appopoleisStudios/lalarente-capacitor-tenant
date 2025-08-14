'use client'

type Action = { key: string; label: string; emoji: string; onClick: () => void }

export default function QuickActions({ actions }: { actions: Action[] }) {
	return (
		<div className="bg-white p-4 rounded-lg shadow">
			<h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
			<div className="grid grid-cols-3 gap-3">
				{actions.map(a => (
					<button key={a.key} onClick={a.onClick} className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
						<span className="text-xl mb-1">{a.emoji}</span>
						<span className="text-xs font-medium text-gray-700">{a.label}</span>
					</button>
				))}
			</div>
		</div>
	)
}


