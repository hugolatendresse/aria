import { CapabilityCard } from "./card_registry"

export function formatCardsForPrompt(cards: CapabilityCard[]): string {
	const blocks: string[] = []

	for (const c of cards) {
		const block = `### Capability Card: ${c.title} (v${c.version})
${c.content}

_Sources_: ${c.sources?.join("; ") ?? "—"}`
		blocks.push(block)
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
