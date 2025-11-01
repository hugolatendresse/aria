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
		"**CAPABILITY CARDS: MANDATORY TECHNICAL GUIDANCE**",
		"",
		"The following capability cards contain authoritative technical guidance that you MUST adhere to precisely. These cards are non-negotiable implementation requirements:",
		"",
		"1. **FORMULAS**: When a capability card specifies mathematical formulas, you MUST implement those exact formulas. Do NOT substitute alternative approaches or simplify the mathematics.",
		"",
		"2. **CODE PATTERNS**: When a capability card provides implementation patterns or example code, you MUST follow those patterns exactly. The code examples demonstrate correct usage of libraries, proper data structures, and critical implementation details.",
		"",
		"3. **PYTHON MODULES**: When capability cards specify Python modules and function usage (e.g., 'from ratemaking.credibility import classical_full_credibility_frequency'), you MUST use those exact imports and functions rather than implementing manual calculations. Install required packages first (e.g., 'pip install ratemaking==0.3.0').",
		"",
		"4. **GUIDANCE AND WARNINGS**: Pay strict attention to 'Critical Points', 'Common Pitfalls', 'When to use', and 'When NOT to use' sections. These contain essential domain knowledge that prevents errors.",
		"",
		"5. **PRECEDENCE**: Capability card specifications override generic programming approaches and general best practices. If a capability card contradicts standard coding patterns, the capability card takes precedence.",
		"",
		"ASSUMPTIONS HANDLING: When the user provides assumptions for actuarial analyses (e.g., trend rates, tail factors, selection periods, target years, special adjustment factors), and you are creating a script from scratch (NOT working from an existing script), you MUST:",
		"1. Create a CONFIG section at the top of your working script storing all key assumptions as named variables",
		"2. Reference these config variables throughout the code (not hardcoded values)",
		"3. Validate your implementation against what the user specified - assumptions are critically important and errors here cascade through the entire analysis",
		"",
		...blocks,
		"---",
	].join("\n")
}
