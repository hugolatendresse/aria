import type { CapabilityCard } from "./card_registry"

export type Detection = { card: CapabilityCard; signals: string[]; score: number }

export function detectCards(userTurns: string[], registry: CapabilityCard[]): Detection[] {
	const text = userTurns.slice(-3).join("\n").toLowerCase() // last N turns
	const hits: Detection[] = []

	for (const card of registry) {
		let matched = false
		const signals: string[] = []

		for (const trig of card.triggers) {
			if (trig.kind === "keyword") {
				const anyHit = trig.any?.some((k) => text.includes(k.toLowerCase()))
				const allHit = (trig.all ?? []).every((k) => text.includes(k.toLowerCase()))
				const noneHit = (trig.none ?? []).some((k) => text.includes(k.toLowerCase()))
				if (anyHit && allHit && !noneHit) {
					matched = true
					signals.push(...(trig.any ?? []).filter((k) => text.includes(k.toLowerCase())))
				}
			} else if (trig.kind === "regex") {
				const re = new RegExp(trig.pattern, trig.flags)
				if (re.test(text)) {
					matched = true
					signals.push(`regex:${trig.pattern}`)
				}
			}
		}

		if (matched) {
			const score = (card.importance ?? 3) + Math.min(2, signals.length)
			hits.push({ card, signals, score })
		}
	}

	// sort high score first
	return hits.sort((a, b) => b.score - a.score)
}
