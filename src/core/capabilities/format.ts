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
		"",
		"ASSUMPTIONS HANDLING: When the user provides assumptions for actuarial analyses (e.g., trend rates, tail factors, selection periods, target years, special adjustment factors), and you are creating a script from scratch (NOT working from an existing script), you MUST:",
		"1. Create a CONFIG section at the top of your working script storing all key assumptions as named variables",
		"2. Reference these config variables throughout the code (not hardcoded values)",
		"3. Validate your implementation against what the user specified - assumptions are critically important and errors here cascade through the entire analysis",
		...blocks,
		"---",
	].join("\n")
}
