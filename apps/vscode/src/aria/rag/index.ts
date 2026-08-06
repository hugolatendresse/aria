/**
 * Aria RAG (Retrieval-Augmented Generation) service for actuarial documents.
 *
 * Ported to the monorepo/SDK architecture (Stage 2). The old vscode-coupled
 * `tool.ts` wrapper is intentionally dropped — tool registration and per-request
 * context injection now live in the `aria-actuarial` AgentExtension plugin.
 */
export { RagService } from "./RagService"
export { formatRagContext, mightBenefitFromActuarialContext } from "./ragFormatter"
export type { RagChildChunk, RagIndex, RagParentChunk, RagSearchResult, RagServiceConfig } from "./types"
export { cosineSimilarity, dotProduct, euclideanDistance, normalize } from "./vectorMath"
