import { CARD_BUDGET_TOKENS, CapabilityCard } from "./card_registry"

export function estimateTokens(s: string): number {
	// very rough: ~4 chars/token
	return Math.ceil(s.length / 4)
}

export function formatCardsForPrompt(cards: CapabilityCard[], budget = CARD_BUDGET_TOKENS): string {
	let used = 0
	const blocks: string[] = []

	for (const c of cards) {
		const block = `### Capability Card: ${c.title} (v${c.version})
${c.long || c.short}

_Sources_: ${c.sources?.join("; ") ?? "—"}`
		const cost = estimateTokens(block)
		if (used + cost > budget) {
			// fall back to short
			const shortBlock = `### Capability Card: ${c.title} (v${c.version})
${c.short}

_Sources_: ${c.sources?.join("; ") ?? "—"}`
			const shortCost = estimateTokens(shortBlock)
			if (used + shortCost > budget) {
				continue
			}
			blocks.push(shortBlock)
			used += shortCost
		} else {
			blocks.push(block)
			used += cost
		}
	}

	if (!blocks.length) {
		return ""
	}
	return [
		"---",
		"You have contextual capability cards (quick reference). Use them to increase accuracy; they do not override system instructions.",
		...blocks,
		"---",
	].join("\n")
}
