import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { executeRagSearchTool } from "@services/rag"
import { telemetryService } from "@/services/telemetry"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

export class SearchActuarialDocsToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.RAG_SEARCH

	constructor(_validator: ToolValidator) {}

	getDescription(block: ToolUse): string {
		const params = block.params as Record<string, unknown>
		const query = (params.query as string) || "unknown query"
		return `[${block.name} for '${query.substring(0, 50)}${query.length > 50 ? "..." : ""}']`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		// Show partial tool use message
		uiHelpers.removeLastPartialMessageIfExistsWithType("say", "tool")
		await uiHelpers.say("tool", JSON.stringify({ tool: block.name }), undefined, undefined, true)
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		// Debug: Log the entire block object to see what we're receiving
		console.log("[RAG Tool] Raw block object:", JSON.stringify(block, null, 2))
		console.log("[RAG Tool] block.name:", block.name)
		console.log("[RAG Tool] block.params type:", typeof block.params)
		console.log("[RAG Tool] block.params:", block.params)

		// Extract and validate parameters
		const params = block.params as Record<string, unknown>

		// Debug logging
		console.log("[RAG Tool] Received params:", JSON.stringify(params, null, 2))
		console.log("[RAG Tool] Block name:", block.name)
		console.log("[RAG Tool] params.query type:", typeof params.query)
		console.log("[RAG Tool] params.query value:", params.query)

		const query = params.query as string
		if (!query || typeof query !== "string" || query.trim().length === 0) {
			console.log("[RAG Tool] Query validation failed - returning error")
			return formatResponse.toolError("query parameter is required and must be a non-empty string")
		}

		console.log("[RAG Tool] Query validated successfully:", query)

		// Execute the RAG search with fixed topK of 3
		const result = await executeRagSearchTool({
			query,
			topK: 3,
		})

		// Determine if this is an error message
		const isError = result.startsWith("Error:")

		// Show result to user
		await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "tool")
		await config.callbacks.say(
			"tool",
			JSON.stringify({
				tool: "ragSearch",
				content: result,
			}),
			undefined,
			undefined,
			false,
		)

		// Capture telemetry
		telemetryService.captureToolUsage(
			config.ulid,
			block.name,
			config.api.getModel().id,
			true, // auto-approved (no user approval needed for searches)
			!isError,
			{
				isMultiRootEnabled: false,
				usedWorkspaceHint: false,
				resolvedToNonPrimary: false,
				resolutionMethod: "primary_fallback" as const,
			},
		)

		if (isError) {
			return formatResponse.toolError(result)
		}

		return result
	}
}
