/**
 * Formatter for RAG search results to be included in system prompts
 */

import type { RagSearchResult } from "./types"

/**
 * Format RAG search results as context for the system prompt
 *
 * @param results The search results to format
 * @param query The original query (for reference)
 * @returns Formatted context string
 */
export function formatRagContext(results: RagSearchResult[], _query?: string): string {
	if (results.length === 0) {
		return ""
	}

	const sections: string[] = []

	sections.push("ACTUARIAL REFERENCE CONTEXT")
	sections.push(
		"The following excerpts from actuarial literature (textbooks, ASOP, etc.) may be relevant to the user's question:",
	)
	sections.push("")

	for (let i = 0; i < results.length; i++) {
		const { parentChunk } = results[i]
		const sourceName = parentChunk.metadata.source_name || parentChunk.metadata.source || "Unknown Source"
		const page = parentChunk.metadata.page ? ` (Page ${parentChunk.metadata.page})` : ""

		sections.push(`--- Reference ${i + 1}: ${sourceName}${page} ---`)
		sections.push(parentChunk.content.trim())
		sections.push("")
	}

	sections.push("--- End of Actuarial Reference Context ---")
	sections.push("")
	sections.push(
		"Use the above context to inform your response when relevant. " +
			"Cite specific sources when referencing this information. " +
			"If the context is not relevant to the user's question, you may ignore it.",
	)

	return sections.join("\n")
}

/**
 * Check if a query is likely to benefit from actuarial RAG context
 *
 * This is a heuristic check to avoid unnecessary API calls for queries
 * that are clearly not actuarial-related.
 *
 * @param query The user's query
 * @returns True if the query might benefit from actuarial context
 */
export function mightBenefitFromActuarialContext(query: string): boolean {
	const lowerQuery = query.toLowerCase()

	// Actuarial keywords and phrases that suggest RAG would be helpful
	const actuarialKeywords = [
		// Methods and techniques
		"bornhuetter",
		"ferguson",
		"chain ladder",
		"development factor",
		"development triangle",
		"loss triangle",
		"cape cod",
		"expected loss",
		"ibnr",
		"incurred but not reported",
		"case reserves",
		"bulk reserves",

		// Specific book references
		"friedland",
		"werner",
		"modlin",
		"asop",

		// Lines of business
		"auto insurance",
		"automobile",
		"property",
		"casualty",
		"liability",
		"workers comp",
		"workers' comp",
		"homeowners",

		// Regulatory and standards
		"naic",
		"statutory",
		"gaap",
		"ifrs",
		"solvency",
	]

	return actuarialKeywords.some((keyword) => lowerQuery.includes(keyword))
}
