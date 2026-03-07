/**
 * Type definitions for the RAG service
 *
 * The RAG system uses a parent-child hierarchy:
 * - Child chunks (small, ~400 chars) are embedded and used for semantic search
 * - Parent chunks (large, ~2000 chars) contain the actual context returned to the LLM
 * - Each child chunk has a parent_id linking to its parent chunk
 */

/**
 * A parent document chunk - large context chunks without embeddings
 */
export interface RagParentChunk {
	id: string
	content: string
	metadata: {
		source?: string
		source_name?: string
		page?: number
		[key: string]: unknown
	}
}

/**
 * A child chunk with its embedding - small chunks for semantic search
 */
export interface RagChildChunk {
	id: string
	text: string
	parent_id: string
	metadata: {
		source_name?: string
		page?: number
		[key: string]: unknown
	}
	/** float32 array (v2) or base64-encoded uint8 array (v3) */
	embedding: number[] | string
}

/**
 * Quantization parameters for scalar quantization (float32 → uint8)
 */
export interface RagQuantizationParams {
	/** Global minimum value across all embeddings */
	min: number
	/** Scale factor: (max - min) / 255 */
	scale: number
}

/**
 * The pre-built RAG index file format (version 2 or 3 with parent-child hierarchy)
 * Version 3 adds scalar quantization of embeddings (base64-encoded uint8 arrays)
 */
export interface RagIndex {
	version: number
	embedding_model: string
	chunking_strategy: string
	parent_chunks: RagParentChunk[]
	child_chunks: RagChildChunk[]
	/** Present in version 3 (quantized) indexes */
	quantization?: RagQuantizationParams
}

/**
 * A search result with similarity score, returning the parent chunk content
 */
export interface RagSearchResult {
	/** The parent chunk containing the full context */
	parentChunk: RagParentChunk
	/** The child chunk that matched the query */
	matchedChildChunk: RagChildChunk
	/** Cosine similarity score between query and child chunk */
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
