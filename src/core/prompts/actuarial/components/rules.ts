export const ACTUARIAL_RULES_SECTION = `- **ACTUARIAL ANALYSIS REQUIREMENT**: When ANY user request contains actuarial terminology, insurance concepts, loss reserving, risk assessment, or mentions actuarial methods/standards, you MUST IMMEDIATELY use the RAG MCP tools before responding. This is MANDATORY - no exceptions. Use the "Actuarial-RAG" server with tools: search_friedland_paper, search_werner_modlin_paper, or search_both_papers to cross-reference the academic literature first.`

export function getActuarialRulesSection(): string {
	return ACTUARIAL_RULES_SECTION
}
