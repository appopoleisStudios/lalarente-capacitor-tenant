export function getByPath(source: Record<string, unknown>, path: string): unknown {
	const segments = path.split('.')
	let current: unknown = source
	for (const seg of segments) {
		if (current && typeof current === 'object' && seg in (current as Record<string, unknown>)) {
			current = (current as Record<string, unknown>)[seg]
		} else {
			return ''
		}
	}
	return current ?? ''
}

export function compileTemplate(content: string, context: Record<string, unknown>): string {
	return content.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, p1) => {
		const key = String(p1).trim()
		const value = getByPath(context, key)
		return value === undefined || value === null ? '' : String(value)
	})
}


