/**
 * Actuarial RAG system prompt component
 *
 * This component retrieves relevant actuarial context from pre-indexed
 * textbooks and injects it into the system prompt when the user's query
 * appears to be actuarial-related.
 */

import { Logger } from "@services/logging/Logger"
import { formatRagContext, mightBenefitFromActuarialContext, RagService } from "@services/rag"
import { StateManager } from "@/core/storage/StateManager"
import { SystemPromptSection } from "../templates/placeholders"
import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const ACTUARIAL_RAG_TEMPLATE = `{{RAG_CONTEXT}}`

/**
 * Extended context that includes the user's current query for RAG search
 */
export interface ActuarialRagContext extends SystemPromptContext {
	userQuery?: string
}

/**
 * Get the actuarial RAG section for the system prompt
 *
 * This function:
 * 1. Checks if the user's query might benefit from actuarial context
 * 2. If so, performs a semantic search against the actuarial index
 * 3. Formats the results as context for the system prompt
 *
 * @param variant The prompt variant
 * @param context The system prompt context (should include userQuery)
 * @returns The formatted RAG context, or undefined if not applicable
 */
export async function getActuarialRagSection(variant: PromptVariant, context: ActuarialRagContext): Promise<string | undefined> {
	// Need a query to search
	if (!context.userQuery) {
		return undefined
	}

	// Quick heuristic check - avoid API calls for clearly non-actuarial queries
	if (!mightBenefitFromActuarialContext(context.userQuery)) {
		return undefined
	}

	// Check if RAG service is initialized
	const ragService = RagService.getInstance()
	if (!ragService.isReady()) {
		Logger.log("[ActuarialRag] RAG service not ready, skipping context retrieval")
		return undefined
	}

	// Get the Gemini API key from state
	const stateManager = StateManager.get()
	const apiConfig = await stateManager.getApiConfiguration()
	const geminiApiKey = apiConfig?.geminiApiKey

	if (!geminiApiKey) {
		Logger.log("[ActuarialRag] No Gemini API key available, skipping RAG search")
		return undefined
	}

	try {
		// Perform semantic search
		const results = await ragService.search(context.userQuery, geminiApiKey, {
			topK: 3, // Limit to 3 most relevant chunks to avoid overwhelming context
			minScore: 0.6, // Higher threshold for relevance
		})

		if (results.length === 0) {
			Logger.log("[ActuarialRag] No relevant actuarial context found")
			return undefined
		}

		Logger.log(`[ActuarialRag] Found ${results.length} relevant document(s) for query`)

		// Format the results
		const ragContext = formatRagContext(results, context.userQuery)

		if (!ragContext) {
			return undefined
		}

		// Use template engine for any overrides
		const template = variant.componentOverrides?.[SystemPromptSection.ACTUARIAL_RAG]?.template || ACTUARIAL_RAG_TEMPLATE

		return new TemplateEngine().resolve(template, context, {
			RAG_CONTEXT: ragContext,
		})
	} catch (error) {
		Logger.log(`[ActuarialRag] Error during RAG search: ${error instanceof Error ? error.message : String(error)}`)
		return undefined
	}
}
