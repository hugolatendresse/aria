import { getChainladderInstructions } from "./chainladder-dynamic"

export const ACTUARIAL_RULES_SECTION = `- **ACTUARIAL DATA PROCESSING RULE**: When users provide actuarial data (loss triangles, claims data, development patterns, or numerical datasets), you MUST use chainladder Triangle objects as the foundation for your implementation. Always create Triangle objects when executing solutions involving actuarial data.

${getChainladderInstructions()}`

export function getActuarialRulesSection(): string {
	return ACTUARIAL_RULES_SECTION
}
