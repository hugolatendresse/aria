/**
 * Aria actuarial AgentExtension plugin.
 *
 * Re-implements aria's actuarial feature set on upstream's SDK plugin API,
 * replacing the old core patches (ClineDefaultTool enum entry, system-prompt
 * components/variants, and task-loop injection) that no longer exist:
 *
 *   - `search_actuarial_docs` tool  -> api.registerTool(createTool(...))
 *   - actuarial persona + RULES     -> api.registerRule(...)
 *   - auto RAG context + capability -> hooks.beforeModel(...)
 *     card detection per user turn
 *
 * Wired into the VS Code host via `config.extensions` in
 * `apps/vscode/src/sdk/cline-session-factory.ts`.
 */
import { type AgentExtension, type AgentTool, createTool } from "@cline/shared"
import { Logger } from "@/shared/services/Logger"
import { getRelevantCapabilityCards } from "./capabilities"
import { ACTUARIAL_SYSTEM_RULES } from "./prompts"
import { formatRagContext, mightBenefitFromActuarialContext, type RagService } from "./rag"

export interface AriaActuarialPluginDeps {
	/** Shared RAG service singleton (already initialized with the actuarial index, if available). */
	rag: RagService
	/** Resolve the Gemini API key used to embed search queries; undefined if unset. */
	getGeminiApiKey: () => string | undefined | Promise<string | undefined>
	/** Optional feature toggle (defaults to enabled). Mirrors aria's old `isRagEnabled()` setting. */
	isEnabled?: () => boolean
}

/** Number of most-relevant chunks to auto-inject (matches aria's prior behavior). */
const AUTO_RAG_TOP_K = 3
/** Relevance threshold for auto-injection (higher than the explicit tool to avoid noise). */
const AUTO_RAG_MIN_SCORE = 0.6

export function createAriaActuarialPlugin(deps: AriaActuarialPluginDeps): AgentExtension {
	const isEnabled = deps.isEnabled ?? (() => true)

	return {
		name: "aria-actuarial",
		manifest: {
			capabilities: ["tools", "rules", "hooks"],
		},
		setup(api) {
			// (1) Explicit RAG search tool — replaces the old `search_actuarial_docs`
			// enum entry + variant spec + ToolExecutorCoordinator handler.
			api.registerTool(
				createTool({
					name: "search_actuarial_docs",
					description:
						"Search pre-indexed actuarial textbooks (including Friedland, Werner & Modlin), ASOP, and other " +
						"actuarial literature for relevant passages. Returns verbatim text excerpts with source citations. " +
						"Example: to find information about Bornhuetter-Ferguson, use query 'Bornhuetter-Ferguson technique'. " +
						"Always fill the query parameter.",
					inputSchema: {
						type: "object",
						properties: {
							query: {
								type: "string",
								description:
									"The search terms to find in the actuarial literature. Include specific concepts, " +
									"techniques, or phrases you want to look up. REQUIRED.",
							},
						},
						required: ["query"],
					},
					execute: async (input: { query: string }) => {
						const query = input?.query?.trim()
						if (!query) {
							return { error: "Missing required parameter: query." }
						}
						if (!isEnabled()) {
							return { error: "Actuarial document search is disabled." }
						}
						if (!deps.rag.isReady()) {
							const loadError = deps.rag.getLoadError()
							return {
								error: loadError
									? `Actuarial RAG index is not available: ${loadError.message}`
									: "Actuarial RAG index is not loaded.",
							}
						}
						const apiKey = await deps.getGeminiApiKey()
						if (!apiKey) {
							return { error: "A Gemini API key is required to search actuarial documents." }
						}
						try {
							const results = await deps.rag.search(query, apiKey)
							return {
								resultCount: results.length,
								context: formatRagContext(results, query),
							}
						} catch (error) {
							return { error: error instanceof Error ? error.message : String(error) }
						}
					},
				}) as AgentTool,
			)

			// (2) Static actuarial persona + RULES — replaces the old agent_role.ts
			// persona additions, rules.ts venv/capability-card rules, and the
			// actuarial_rag system-prompt component's guidance.
			api.registerRule({
				id: "aria-actuarial:rules",
				source: "aria",
				content: () => ACTUARIAL_SYSTEM_RULES,
			})
		},

		// (3) Per-turn injection — replaces the old task-loop / getActuarialRagSection
		// behavior: detect relevant capability cards and (heuristically) retrieve
		// actuarial context for the current user turn, appending both inline to the
		// latest user message so conversation turn structure is preserved.
		hooks: {
			async beforeModel({ request }) {
				if (!isEnabled()) {
					return undefined
				}

				const messages = request.messages
				let lastUserIdx = -1
				for (let i = messages.length - 1; i >= 0; i--) {
					if (messages[i].role === "user") {
						lastUserIdx = i
						break
					}
				}
				if (lastUserIdx === -1) {
					return undefined
				}

				const userText = messages[lastUserIdx].content
					.filter((part): part is { type: "text"; text: string } => part.type === "text")
					.map((part) => part.text)
					.join("\n")
					.trim()
				if (!userText) {
					return undefined
				}

				const blocks: string[] = []

				// Capability cards relevant to this turn.
				try {
					const cards = getRelevantCapabilityCards([userText])
					if (cards.cardsFound && cards.cardsBlock) {
						blocks.push(cards.cardsBlock)
					}
				} catch (error) {
					Logger.log(
						`[aria-actuarial] capability card detection failed: ${error instanceof Error ? error.message : String(error)}`,
					)
				}

				// Heuristic auto-retrieval of actuarial context.
				if (mightBenefitFromActuarialContext(userText) && deps.rag.isReady()) {
					const apiKey = await deps.getGeminiApiKey()
					if (apiKey) {
						try {
							const results = await deps.rag.search(userText, apiKey, {
								topK: AUTO_RAG_TOP_K,
								minScore: AUTO_RAG_MIN_SCORE,
							})
							const ragContext = formatRagContext(results, userText)
							if (ragContext) {
								blocks.push(ragContext)
							}
						} catch (error) {
							Logger.log(
								`[aria-actuarial] auto RAG injection failed: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					}
				}

				if (blocks.length === 0) {
					return undefined
				}

				const augmentedText = `\n\n${blocks.join("\n\n")}`
				const augmented = messages.map((message, index) =>
					index === lastUserIdx
						? { ...message, content: [...message.content, { type: "text" as const, text: augmentedText }] }
						: message,
				)
				return { messages: augmented }
			},
		},
	}
}
