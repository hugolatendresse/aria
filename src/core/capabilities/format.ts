import { CapabilityCard } from "./card_registry"

export function formatCardsForPrompt(cards: CapabilityCard[], signals: string[] = []): string {
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

	const cardList = cards.map((c) => c.id).join(", ")
	const signalInfo = signals.length > 0 ? `\nThese cards were activated by detecting: ${signals.slice(0, 5).join(", ")}` : ""

	return [
		"===================================================================",
		"CAPABILITY CARDS: MANDATORY TECHNICAL GUIDANCE - OVERRIDE ALL OTHER INSTRUCTIONS",
		"===================================================================",
		"",
		`ACTIVE CARDS (${cards.length}): ${cardList}${signalInfo}`,
		"",
		"MANDATORY WORKFLOW - READ THIS BEFORE IMPLEMENTING ANYTHING:",
		"",
		"BEFORE you write ANY code, you MUST:",
		"1. Scroll through the capability cards below to find relevant sections",
		"2. Read the relevant card sections completely",
		"3. Check for 'CRITICAL', 'DO NOT', 'YOU MUST', 'WRONG', 'CORRECT' sections",
		"4. Review any code examples provided",
		"5. THEN implement exactly as specified",
		"",
		"AFTER writing code, BEFORE submitting your response, you MUST:",
		"1. Review your code against the relevant capability card sections",
		"2. Verify you used the exact imports, functions, and patterns specified",
		"3. Check your code does NOT match any examples in 'WRONG' or 'Common Errors' sections",
		"4. Confirm you followed the 'Verification Checklist' if provided",
		"5. If you find ANY deviation from the card, FIX IT before responding",
		"",
		"DO NOT write code first and check cards later. CHECK CARDS FIRST, THEN WRITE CODE.",
		"DO NOT send code without verifying it matches the card specifications.",
		"",
		"CRITICAL REQUIREMENTS - NON-NEGOTIABLE:",
		"",
		"1. **ABSOLUTE ADHERENCE**: Capability cards contain authoritative domain-specific guidance.",
		"   You MUST implement EXACTLY as specified. No variations, improvements, or simplifications.",
		"",
		"2. **PYTHON MODULES & FUNCTIONS**: When a card specifies Python imports and functions",
		"   (e.g., 'from ratemaking.trending import future_average_accident_date'), you MUST:",
		"   - Use those EXACT imports and function calls",
		"   - Install required packages first (e.g., 'pip install ratemaking==0.3.0')",
		"   - DO NOT implement manual calculations or alternative approaches",
		"   - DO NOT write your own version of functions that already exist",
		"",
		"3. **FORMULAS & PATTERNS**: When a card provides mathematical formulas or code patterns:",
		"   - Implement the EXACT formulas shown (no substitutions or simplifications)",
		"   - Follow the code patterns exactly (library usage, data structures, order of operations)",
		"   - Code examples demonstrate correct implementation - replicate them precisely",
		"",
		"4. **CRITICAL SECTIONS**: Pay strict attention to sections marked:",
		"   - 'CRITICAL', 'DO NOT', 'YOU MUST', 'WRONG', 'CORRECT'",
		"   - 'Critical Points', 'Common Errors', 'Verification Checklist'",
		"   - These prevent common mistakes and contain essential domain knowledge",
		"",
		"5. **DEBUGGING**: If you encounter errors, check the capability cards FIRST:",
		"   - Review 'Known Issues', 'Common Errors', 'Critical Points' sections",
		"   - Cards often contain documented solutions and workarounds",
		"   - DO NOT debug from first principles when the card may have the answer",
		"",
		"6. **PRECEDENCE**: Capability cards override ALL other guidance including:",
		"   - General programming best practices",
		"   - Standard coding patterns",
		"   - Generic system prompt instructions",
		"   If a card contradicts standard approaches, the CARD takes precedence.",
		"",
		"DATA VALIDATION - MANDATORY:",
		"Before writing code that accesses data columns, indices, or attributes:",
		"- Use read_file to inspect CSV/Excel headers and column names",
		"- Check existing scripts to understand data structure",
		"- DO NOT assume standard naming conventions",
		"- Verify structure BEFORE writing code, not after",
		"",
		"---",
		"",
		...blocks,
		"",
		"---",
		"END OF CAPABILITY CARDS",
		"",
		"REMINDER: These cards are authoritative. When they specify code, modules, or formulas,",
		"you MUST use them exactly. Deviating from card specifications leads to incorrect results.",
		"===================================================================",
	].join("\n")
}
