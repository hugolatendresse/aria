/**
 * RAG (Retrieval-Augmented Generation) Service for Aria
 *
 * This service provides semantic search over actuarial documents using
 * pre-computed embeddings. It loads a pre-built index at extension activation
 * and uses the user's Gemini API key for query embeddings at runtime.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { Logger } from "@services/logging/Logger"
import type { RagIndex, RagSearchResult, RagServiceConfig } from "./types"
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
 */
export class RagService {
	private static instance: RagService | null = null

	private index: RagIndex | null = null
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
			const indexPath = path.join(extensionPath, "actuarial-index.json")

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
			Logger.log(
				`[RagService] Loaded ${index.documents.length} documents in ${loadTime}ms ` +
					`(embedding model: ${index.embedding_model})`,
			)

			// Validate the index
			if (!index.documents || index.documents.length === 0) {
				throw new Error("RAG index is empty")
			}

			// Check embedding dimensions are consistent
			const embeddingDim = index.documents[0].embedding.length
			const inconsistent = index.documents.filter((d) => d.embedding.length !== embeddingDim)
			if (inconsistent.length > 0) {
				Logger.log(`[RagService] Warning: ${inconsistent.length} documents have inconsistent embedding dimensions`)
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
	 * Search for relevant documents using semantic similarity
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

			// Compute similarity scores for all documents
			const results: RagSearchResult[] = []

			for (const doc of this.index.documents) {
				const score = cosineSimilarity(queryEmbedding, doc.embedding)

				if (score >= searchConfig.minScore) {
					results.push({ document: doc, score })
				}
			}

			// Sort by score descending and take top K
			results.sort((a, b) => b.score - a.score)
			return results.slice(0, searchConfig.topK)
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

		const data = await response.json()

		if (!data.embedding?.values) {
			throw new Error("Invalid response from Gemini embedding API: missing embedding values")
		}

		return data.embedding.values
	}

	/**
	 * Get the number of documents in the index
	 */
	public getDocumentCount(): number {
		return this.index?.documents.length ?? 0
	}

	/**
	 * Get metadata about the loaded index
	 */
	public getIndexMetadata(): { version: number; embeddingModel: string; chunkingStrategy: string } | null {
		if (!this.index) {
			return null
		}
		return {
			version: this.index.version,
			embeddingModel: this.index.embedding_model,
			chunkingStrategy: this.index.chunking_strategy,
		}
	}

	/**
	 * Reset the singleton instance (mainly for testing)
	 */
	public static reset(): void {
		RagService.instance = null
	}
}
