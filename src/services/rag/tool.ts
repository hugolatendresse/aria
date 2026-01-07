/**
 * RAG search tool for exposing actuarial document search to the AI
 */

import { Logger } from "@services/logging/Logger"
import { StateManager } from "@/core/storage/StateManager"
import { RagService } from "./RagService"
import { formatRagContext } from "./ragFormatter"

/**
 * Parameters for the RAG search tool
 */
export interface RagSearchToolParams {
	query: string
	topK?: number
	minScore?: number
}

/**
 * Execute a RAG search and return formatted results
 *
 * This function is designed to be called by the AI as a tool.
 * It searches the pre-indexed actuarial documents and returns
 * relevant context that can be used to answer the user's question.
 *
 * @param params The search parameters
 * @returns Formatted search results or an error message
 */
export async function executeRagSearchTool(params: RagSearchToolParams): Promise<string> {
	const { query, topK = 3, minScore = 0.6 } = params

	// Validate query
	if (!query || query.trim().length === 0) {
		return "Error: Query cannot be empty"
	}

	// Check if RAG service is ready
	const ragService = RagService.getInstance()
	if (!ragService.isReady()) {
		return "Error: RAG service is not ready. The actuarial document index may not be loaded."
	}

	// Get the Gemini API key from state
	const stateManager = StateManager.get()
	const apiConfig = await stateManager.getApiConfiguration()
	const geminiApiKey = apiConfig?.geminiApiKey

	if (!geminiApiKey) {
		return (
			"Error: No Gemini API key configured. Please add your Gemini API key in Aria settings. " +
			"The RAG system requires a Gemini API key to embed search queries."
		)
	}

	try {
		Logger.log(`[RAG Tool] Searching for: "${query.substring(0, 100)}..."`)

		// Perform the search
		const results = await ragService.search(query, geminiApiKey, {
			topK,
			minScore,
		})

		if (results.length === 0) {
			Logger.log("[RAG Tool] No relevant documents found")
			return `No relevant actuarial documents found for query: "${query}". Try rephrasing your search or using different keywords.`
		}

		Logger.log(`[RAG Tool] Found ${results.length} relevant document(s)`)

		// Format the results for display
		const formattedContext = formatRagContext(results, query)
		return formattedContext
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		Logger.log(`[RAG Tool] Search failed: ${errorMessage}`)
		return `Error performing RAG search: ${errorMessage}`
	}
}

/**
 * Get information about the RAG system's status
 */
export function getRagSystemStatus(): string {
	const ragService = RagService.getInstance()

	if (!ragService.isReady()) {
		return "RAG system is not ready. The actuarial document index may not be loaded."
	}

	const docCount = ragService.getDocumentCount()
	return `RAG system is ready. Index contains ${docCount} document chunks available for search.`
}
