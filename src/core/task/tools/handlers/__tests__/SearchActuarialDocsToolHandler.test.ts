/**
 * Unit tests for SearchActuarialDocsToolHandler
 *
 * These tests verify that the RAG search tool correctly:
 * - Extracts query parameters from tool use blocks
 * - Validates required parameters
 * - Executes RAG searches
 * - Handles errors appropriately
 */

import type { ToolUse } from "@core/assistant-message"
import * as ragModule from "@services/rag"
import { expect } from "chai"
import { afterEach, beforeEach, describe, it } from "mocha"
import * as sinon from "sinon"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolValidator } from "../../ToolValidator"
import type { TaskConfig } from "../../types/TaskConfig"
import { SearchActuarialDocsToolHandler } from "../SearchActuarialDocsToolHandler"

describe("SearchActuarialDocsToolHandler", () => {
	let handler: SearchActuarialDocsToolHandler
	let mockValidator: ToolValidator
	let mockConfig: TaskConfig
	let executeRagSearchToolStub: sinon.SinonStub

	beforeEach(() => {
		// Create mock validator (not used in current implementation, but required by constructor)
		mockValidator = {} as ToolValidator

		// Create handler instance
		handler = new SearchActuarialDocsToolHandler(mockValidator)

		// Create minimal mock TaskConfig
		mockConfig = {
			callbacks: {
				removeLastPartialMessageIfExistsWithType: sinon.stub(),
				say: sinon.stub(),
			},
			ulid: "test-ulid",
			api: {
				getModel: () => ({ id: "test-model" }),
			},
		} as unknown as TaskConfig

		// Stub the RAG service
		executeRagSearchToolStub = sinon.stub(ragModule, "executeRagSearchTool")
	})

	afterEach(() => {
		// Restore all stubs
		sinon.restore()
	})

	describe("Parameter Extraction", () => {
		it("should extract query parameter from ToolUse block", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "Bornhuetter-Ferguson technique",
				},
				partial: false,
			}

			// Mock successful RAG search
			executeRagSearchToolStub.resolves("Mock search results")

			await handler.execute(mockConfig, block)

			// Verify executeRagSearchTool was called with correct query
			expect(executeRagSearchToolStub.calledOnce).to.be.true
			expect(executeRagSearchToolStub.firstCall.args[0]).to.deep.equal({
				query: "Bornhuetter-Ferguson technique",
				topK: 3,
			})
		})

		it("should handle query parameter with special characters", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "loss reserving: IBNR & case reserves",
				},
				partial: false,
			}

			executeRagSearchToolStub.resolves("Mock results")

			await handler.execute(mockConfig, block)

			expect(executeRagSearchToolStub.firstCall.args[0]).to.deep.equal({
				query: "loss reserving: IBNR & case reserves",
				topK: 3,
			})
		})
	})

	describe("Validation", () => {
		it("should return error when query parameter is missing", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {}, // No query parameter
				partial: false,
			}

			const result = await handler.execute(mockConfig, block)

			expect(result).to.include("query parameter is required")
			expect(executeRagSearchToolStub.called).to.be.false
		})

		it("should return error when query is empty string", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "",
				},
				partial: false,
			}

			const result = await handler.execute(mockConfig, block)

			expect(result).to.include("query parameter is required")
			expect(executeRagSearchToolStub.called).to.be.false
		})

		it("should return error when query is whitespace only", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "   ",
				},
				partial: false,
			}

			const result = await handler.execute(mockConfig, block)

			expect(result).to.include("query parameter is required")
			expect(executeRagSearchToolStub.called).to.be.false
		})

		it("should return error when query is not a string", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: 123 as any, // Invalid type
				},
				partial: false,
			}

			const result = await handler.execute(mockConfig, block)

			expect(result).to.include("query parameter is required")
			expect(executeRagSearchToolStub.called).to.be.false
		})
	})

	describe("RAG Search Execution", () => {
		it("should execute RAG search with valid query", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "chain ladder method",
				},
				partial: false,
			}

			const mockResults = "Mock RAG results with citations"
			executeRagSearchToolStub.resolves(mockResults)

			const result = await handler.execute(mockConfig, block)

			expect(result).to.equal(mockResults)
			expect(executeRagSearchToolStub.firstCall.args[0]).to.deep.equal({
				query: "chain ladder method",
				topK: 3,
			})
		})

		it("should always use topK of 3", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "test query",
					top_k: "5", // Even if client tries to send top_k, it should use 3
				},
				partial: false,
			}

			executeRagSearchToolStub.resolves("Results")

			await handler.execute(mockConfig, block)

			expect(executeRagSearchToolStub.firstCall.args[0]).to.deep.equal({
				query: "test query",
				topK: 3, // Should always be 3
			})
		})
	})

	describe("Error Handling", () => {
		it("should handle RAG search errors gracefully", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "test query",
				},
				partial: false,
			}

			const errorMessage = "Error: RAG service not ready"
			executeRagSearchToolStub.resolves(errorMessage)

			const result = await handler.execute(mockConfig, block)

			expect(result).to.include("Error:")
		})

		it("should handle missing Gemini API key error", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "test query",
				},
				partial: false,
			}

			executeRagSearchToolStub.resolves("Error: No Gemini API key configured")

			const result = await handler.execute(mockConfig, block)

			expect(result).to.include("Gemini API key")
		})
	})

	describe("Tool Description", () => {
		it("should generate correct description for tool use", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "Bornhuetter-Ferguson technique when it works",
				},
				partial: false,
			}

			const description = handler.getDescription(block)

			expect(description).to.include("search_actuarial_docs")
			expect(description).to.include("Bornhuetter-Ferguson technique")
		})

		it("should truncate long queries in description", () => {
			const longQuery = "a".repeat(100)
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: longQuery,
				},
				partial: false,
			}

			const description = handler.getDescription(block)

			expect(description.length).to.be.lessThan(longQuery.length + 30)
			expect(description).to.include("...")
		})

		it("should handle missing query in description", () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {},
				partial: false,
			}

			const description = handler.getDescription(block)

			expect(description).to.include("unknown query")
		})
	})

	describe("UI Callbacks", () => {
		it("should call UI callbacks to show tool execution", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: ClineDefaultTool.RAG_SEARCH,
				params: {
					query: "test query",
				},
				partial: false,
			}

			executeRagSearchToolStub.resolves("Results")

			await handler.execute(mockConfig, block)

			// Should call removeLastPartialMessageIfExistsWithType
			const removeStub = mockConfig.callbacks.removeLastPartialMessageIfExistsWithType as sinon.SinonStub
			expect(removeStub.calledWith("say", "tool")).to.be.true

			// Should call say with tool result
			const sayStub = mockConfig.callbacks.say as sinon.SinonStub
			expect(sayStub.called).to.be.true
			const sayArgs = sayStub.firstCall.args
			expect(sayArgs[0]).to.equal("tool")
			expect(sayArgs[1]).to.include("ragSearch")
		})
	})
})
