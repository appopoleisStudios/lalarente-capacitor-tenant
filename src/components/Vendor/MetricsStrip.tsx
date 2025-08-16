'use client'

type Props = {
	activeJobs: number
	thisMonth: number
	earnings: number
	rating: number
	onAvailableJobs?: () => void
	onSchedule?: () => void
}

export default function MetricsStrip({ activeJobs, thisMonth, earnings, rating, onAvailableJobs, onSchedule }: Props) {
	return (
		<div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 text-white shadow">
			<h2 className="text-lg font-semibold mb-3">Job Overview</h2>
			<div className="grid grid-cols-2 gap-3 mb-4">
				<div>
					<p className="text-blue-100 text-sm">Active Jobs</p>
					<p className="text-2xl font-bold">{activeJobs}</p>
				</div>
				<div>
					<p className="text-blue-100 text-sm">This Month</p>
					<p className="text-2xl font-bold">{thisMonth}</p>
				</div>
				<div>
					<p className="text-blue-100 text-sm">Earnings</p>
					<p className="text-xl font-bold">R {earnings.toLocaleString()}</p>
				</div>
				<div>
					<p className="text-blue-100 text-sm">Rating</p>
					<p className="text-xl font-bold">{rating.toFixed(1)} ⭐</p>
				</div>
			</div>
			<div className="flex space-x-2">
				<button onClick={onAvailableJobs} className="flex-1 bg-white text-blue-600 py-2 px-4 rounded-lg font-medium text-sm">Available Jobs</button>
				<button onClick={onSchedule} className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium text-sm border border-blue-500">My Schedule</button>
			</div>
		</div>
	)
}



