export async function generateStaticParams() {
	// For static export, we need to pre-render specific contract IDs.
	// These are actual contract IDs from your database.
	return [
		{ id: '52a5081e-bcd5-4101-b097-d4c153b735ec' },
		{ id: 'd49b42d5-db52-4bdb-82bf-da1454269301' },
		{ id: '331623c5-b7b7-438d-9741-4e5045a02cdd' },
		{ id: 'b632cab0-9be2-48ef-9295-6168def7e33c' }
	]
}

export default function IdSegmentLayout({ children }: { children: React.ReactNode }) {
	return children
}


