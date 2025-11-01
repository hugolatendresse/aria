import type { CapabilityCard } from "./card_registry"

const MAX_CARDS = 10

export type Detection = { card: CapabilityCard; signals: string[]; score: number }

export function detectCards(userTurns: string[], registry: CapabilityCard[]): Detection[] {
	const lastTurn = userTurns[userTurns.length - 1]?.toLowerCase() ?? ""
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
			// Score based on recency only
			const inLastTurn = signals.some((sig) => {
				const pattern = sig.startsWith("regex:") ? sig.substring(6) : sig.toLowerCase()
				return lastTurn.includes(pattern)
			})
			const score = inLastTurn ? 1 : 0

			hits.push({ card, signals, score })
		}
	}

	// sort high score first
	const sorted = hits.sort((a, b) => b.score - a.score)

	if (hits.length > MAX_CARDS) {
		const selected = sorted.slice(0, MAX_CARDS)
		console.log(
			`[CARDS] Detected ${hits.length}, selected ${selected.length}:`,
			selected.map((d) => `${d.card.id}(${d.score})`).join(", "),
		)
	}

	return sorted.slice(0, MAX_CARDS)
}
