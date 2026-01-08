/**
 * RAG (Retrieval-Augmented Generation) Service for Aria
 *
 * This service provides semantic search over actuarial documents using
 * pre-computed embeddings with a parent-child chunk hierarchy:
 * - Child chunks (small, ~400 chars) are embedded and used for semantic search
 * - Parent chunks (large, ~2000 chars) contain the actual context returned to the LLM
 *
 * It loads a pre-built index at extension activation and uses the user's
 * Gemini API key for query embeddings at runtime.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { Logger } from "@services/logging/Logger"
import type { RagChildChunk, RagIndex, RagParentChunk, RagSearchResult, RagServiceConfig } from "./types"
import { cosineSimilarity } from "./vectorMath"

// Gemini embedding model - must match the one used in Python export_index.py
const GEMINI_EMBEDDING_MODEL = "text-embedding-004"
const GEMINI_EMBEDDING_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

/**
 * Default configuration for RAG searches
 */
const DEFAULT_CONFIG: Required<RagServiceConfig> = {
	topK: 5,
	minScore: 0.5,
}

/**
 * RAG Service singleton for actuarial document search
 *
 * Uses parent-child chunk hierarchy for better search precision:
 * 1. Query is embedded using Gemini API
 * 2. Query embedding is compared against child chunk embeddings
 * 3. Matching child chunks' parent chunks are returned for context
 */
export class RagService {
	private static instance: RagService | null = null

	private index: RagIndex | null = null
	private parentChunkMap: Map<string, RagParentChunk> = new Map()
	private isLoading = false
	private loadError: Error | null = null
	private config: Required<RagServiceConfig>

	private constructor(config: RagServiceConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config }
	}

	/**
	 * Get the singleton instance of RagService
	 */
	public static getInstance(config?: RagServiceConfig): RagService {
		if (!RagService.instance) {
			RagService.instance = new RagService(config)
		}
		return RagService.instance
	}

	/**
	 * Initialize the RAG service by loading the pre-built index.
	 * This should be called during extension activation.
	 *
	 * @param extensionPath The path to the extension's installation directory
	 */
	public async initialize(extensionPath: string): Promise<void> {
		if (this.index) {
			Logger.log("[RagService] Index already loaded, skipping initialization")
			return
		}

		if (this.isLoading) {
			Logger.log("[RagService] Index is already being loaded, waiting...")
			// Wait for the current load to complete
			while (this.isLoading) {
				await new Promise((resolve) => setTimeout(resolve, 100))
			}
			return
		}

		this.isLoading = true
		this.loadError = null

		try {
			// In development mode, extensionPath is the workspace root
			// In production, it's the installed extension directory
			// Try dist/ first (dev), then root (production)
			let indexPath = path.join(extensionPath, "dist", "actuarial-index.json")
			if (!fs.existsSync(indexPath)) {
				indexPath = path.join(extensionPath, "actuarial-index.json")
			}

			if (!fs.existsSync(indexPath)) {
				throw new Error(
					`RAG index not found at ${indexPath}. ` +
						"The actuarial-index.json file should be bundled with the extension.",
				)
			}

			Logger.log(`[RagService] Loading RAG index from ${indexPath}...`)

			const startTime = Date.now()
			const indexContent = await fs.promises.readFile(indexPath, "utf-8")
			const index = JSON.parse(indexContent) as RagIndex

			const loadTime = Date.now() - startTime

			// Validate the index version
			if (index.version !== 2) {
				throw new Error(`Unsupported RAG index version: ${index.version}. Expected version 2 (parent-child hierarchy).`)
			}

			// Validate the index content
			if (!index.parent_chunks || index.parent_chunks.length === 0) {
				throw new Error("RAG index has no parent chunks")
			}
			if (!index.child_chunks || index.child_chunks.length === 0) {
				throw new Error("RAG index has no child chunks")
			}

			Logger.log(
				`[RagService] Loaded ${index.parent_chunks.length} parent chunks and ${index.child_chunks.length} child chunks in ${loadTime}ms ` +
					`(embedding model: ${index.embedding_model})`,
			)

			// Build parent chunk lookup map for fast access
			this.parentChunkMap = new Map()
			for (const parent of index.parent_chunks) {
				this.parentChunkMap.set(parent.id, parent)
			}

			// Validate parent-child relationships
			let orphanCount = 0
			for (const child of index.child_chunks) {
				if (!this.parentChunkMap.has(child.parent_id)) {
					orphanCount++
				}
			}
			if (orphanCount > 0) {
				Logger.log(`[RagService] Warning: ${orphanCount} child chunks have missing parent chunks`)
			}

			// Check embedding dimensions are consistent
			const embeddingDim = index.child_chunks[0].embedding.length
			const inconsistent = index.child_chunks.filter((c) => c.embedding.length !== embeddingDim)
			if (inconsistent.length > 0) {
				Logger.log(`[RagService] Warning: ${inconsistent.length} child chunks have inconsistent embedding dimensions`)
			}

			this.index = index
		} catch (error) {
			this.loadError = error instanceof Error ? error : new Error(String(error))
			Logger.log(`[RagService] Failed to load index: ${this.loadError.message}`)
			throw this.loadError
		} finally {
			this.isLoading = false
		}
	}

	/**
	 * Check if the RAG service is initialized and ready
	 */
	public isReady(): boolean {
		return this.index !== null && !this.isLoading
	}

	/**
	 * Get the initialization error, if any
	 */
	public getLoadError(): Error | null {
		return this.loadError
	}

	/**
	 * Search for relevant documents using semantic similarity.
	 *
	 * The search process:
	 * 1. Embed the query using Gemini API
	 * 2. Compare query embedding against all child chunk embeddings
	 * 3. For matching children, retrieve their parent chunks
	 * 4. Deduplicate results (multiple children may point to same parent)
	 * 5. Return parent chunks sorted by best matching child score
	 *
	 * @param query The search query
	 * @param geminiApiKey The user's Gemini API key for embedding the query
	 * @param config Optional override for search configuration
	 * @returns Array of search results sorted by relevance
	 */
	public async search(query: string, geminiApiKey: string, config?: Partial<RagServiceConfig>): Promise<RagSearchResult[]> {
		if (!this.index) {
			throw new Error("RAG index not loaded. Call initialize() first.")
		}

		if (!geminiApiKey) {
			throw new Error("Gemini API key is required for RAG search")
		}

		const searchConfig = { ...this.config, ...config }

		try {
			// Get embedding for the query using Gemini API
			const queryEmbedding = await this.embedQuery(query, geminiApiKey)

			// Compute similarity scores for all child chunks
			const childMatches: Array<{ child: RagChildChunk; score: number }> = []

			for (const child of this.index.child_chunks) {
				const score = cosineSimilarity(queryEmbedding, child.embedding)

				if (score >= searchConfig.minScore) {
					childMatches.push({ child, score })
				}
			}

			// Sort by score descending
			childMatches.sort((a, b) => b.score - a.score)

			// Deduplicate by parent_id, keeping the best score for each parent
			const seenParents = new Set<string>()
			const results: RagSearchResult[] = []

			for (const match of childMatches) {
				if (seenParents.has(match.child.parent_id)) {
					continue // Already have a result for this parent
				}

				const parentChunk = this.parentChunkMap.get(match.child.parent_id)
				if (!parentChunk) {
					Logger.log(`[RagService] Warning: Child chunk ${match.child.id} has missing parent ${match.child.parent_id}`)
					continue
				}

				seenParents.add(match.child.parent_id)
				results.push({
					parentChunk,
					matchedChildChunk: match.child,
					score: match.score,
				})

				// Stop once we have enough unique parents
				if (results.length >= searchConfig.topK) {
					break
				}
			}

			return results
		} catch (error) {
			Logger.log(`[RagService] Search failed: ${error}`)
			throw error
		}
	}

	/**
	 * Embed a query using the Gemini embedding API
	 */
	private async embedQuery(query: string, apiKey: string): Promise<number[]> {
		const url = `${GEMINI_EMBEDDING_API_URL}/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: `models/${GEMINI_EMBEDDING_MODEL}`,
				content: {
					parts: [{ text: query }],
				},
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Gemini embedding API error (${response.status}): ${errorText}`)
		}

		const data = (await response.json()) as { embedding?: { values?: number[] } }

		if (!data.embedding?.values) {
			throw new Error("Invalid response from Gemini embedding API: missing embedding values")
		}

		return data.embedding.values
	}

	/**
	 * Get the number of parent documents in the index
	 */
	public getDocumentCount(): number {
		return this.index?.parent_chunks.length ?? 0
	}

	/**
	 * Get the number of child chunks in the index
	 */
	public getChildChunkCount(): number {
		return this.index?.child_chunks.length ?? 0
	}

	/**
	 * Get metadata about the loaded index
	 */
	public getIndexMetadata(): {
		version: number
		embeddingModel: string
		chunkingStrategy: string
		parentCount: number
		childCount: number
	} | null {
		if (!this.index) {
			return null
		}
		return {
			version: this.index.version,
			embeddingModel: this.index.embedding_model,
			chunkingStrategy: this.index.chunking_strategy,
			parentCount: this.index.parent_chunks.length,
			childCount: this.index.child_chunks.length,
		}
	}

	/**
	 * Reset the singleton instance (mainly for testing)
	 */
	public static reset(): void {
		RagService.instance = null
	}
}
