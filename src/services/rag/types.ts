/**
 * Type definitions for the RAG service
 */

/**
 * A document chunk with its embedding, as stored in the pre-built index
 */
export interface RagDocument {
	id: string
	content: string
	metadata: {
		source?: string
		source_name?: string
		page?: number
		[key: string]: unknown
	}
	embedding: number[]
}

/**
 * The pre-built RAG index file format
 */
export interface RagIndex {
	version: number
	embedding_model: string
	chunking_strategy: string
	documents: RagDocument[]
}

/**
 * A search result with similarity score
 */
export interface RagSearchResult {
	document: RagDocument
	score: number
}

/**
 * Configuration options for the RAG service
 */
export interface RagServiceConfig {
	/**
	 * Maximum number of results to return from a search
	 * @default 5
	 */
	topK?: number

	/**
	 * Minimum similarity score threshold (0-1)
	 * @default 0.5
	 */
	minScore?: number
}
