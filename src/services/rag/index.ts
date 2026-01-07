/**
 * RAG Service module exports
 */

export { RagService } from "./RagService"
export { formatRagContext, mightBenefitFromActuarialContext } from "./ragFormatter"
export type { RagDocument, RagIndex, RagSearchResult, RagServiceConfig } from "./types"
export { cosineSimilarity, dotProduct, euclideanDistance, normalize } from "./vectorMath"
