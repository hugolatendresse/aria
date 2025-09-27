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
		"You have contextual capability cards (mandatory technical guidance). When capability cards specify Python modules and function usage, you MUST use those exact imports and functions - this requirement overrides generic programming approaches. Capability cards with Python module specifications are non-negotiable implementation requirements.",
		...blocks,
		"---",
	].join("\n")
}
