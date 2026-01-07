/**
 * Vector math utilities for RAG similarity search
 */

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
	}

	let dotProduct = 0
	let normA = 0
	let normB = 0

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	const magnitude = Math.sqrt(normA) * Math.sqrt(normB)

	if (magnitude === 0) {
		return 0
	}

	return dotProduct / magnitude
}

/**
 * Compute dot product between two vectors
 */
export function dotProduct(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
	}

	let sum = 0
	for (let i = 0; i < a.length; i++) {
		sum += a[i] * b[i]
	}
	return sum
}

/**
 * Normalize a vector to unit length
 */
export function normalize(vector: number[]): number[] {
	const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))

	if (magnitude === 0) {
		return vector.slice()
	}

	return vector.map((val) => val / magnitude)
}

/**
 * Compute Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
	}

	let sum = 0
	for (let i = 0; i < a.length; i++) {
		const diff = a[i] - b[i]
		sum += diff * diff
	}
	return Math.sqrt(sum)
}
