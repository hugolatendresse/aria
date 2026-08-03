/**
 * Aria actuarial feature — public entrypoint for the VS Code host.
 *
 * Exposes a single factory that returns the `aria-actuarial` AgentExtension,
 * wired to the host's RAG service and Gemini credentials. Register it via
 * `config.extensions` in the session factory.
 */
import type { AgentExtension } from "@cline/shared"
import { StateManager } from "@/core/storage/StateManager"
import { HostProvider } from "@/hosts/host-provider"
import { Logger } from "@/shared/services/Logger"
import { createAriaActuarialPlugin } from "./actuarial-plugin"
import { RagService } from "./rag"

let ragInitStarted = false

/**
 * Lazily kick off RAG index loading exactly once (idempotent — RagService
 * guards against double init). Mirrors aria's old `common.ts` startup init.
 */
function ensureRagInitialized(): RagService {
	const rag = RagService.getInstance()
	if (!ragInitStarted) {
		ragInitStarted = true
		rag.initialize(HostProvider.get().extensionFsPath)
			.then(() => {
				Logger.log(`[aria-actuarial] RAG initialized with ${rag.getDocumentCount()} actuarial documents`)
			})
			.catch((error) => {
				Logger.log(
					`[aria-actuarial] RAG index unavailable (search will be disabled): ${
						error instanceof Error ? error.message : String(error)
					}`,
				)
			})
	}
	return rag
}

/**
 * Build the aria-actuarial extension for a VS Code session. Safe to call per
 * session; RAG initialization only runs once.
 */
export function createAriaActuarialExtension(): AgentExtension {
	const rag = ensureRagInitialized()
	return createAriaActuarialPlugin({
		rag,
		getGeminiApiKey: () => StateManager.get().getApiConfiguration()?.geminiApiKey,
	})
}

export { createAriaActuarialPlugin } from "./actuarial-plugin"
