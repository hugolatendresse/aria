import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.RAG_SEARCH

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "search_actuarial_docs",
	description:
		"Search pre-indexed actuarial textbooks and documents for relevant information. Use this tool when the user asks about actuarial concepts, methods, or wants specific information from textbooks like Friedland, Werner & Modlin, or other actuarial references. The tool performs semantic search to find the most relevant passages.",
	parameters: [
		{
			name: "query",
			required: true,
			instruction:
				"The search query describing what actuarial information you're looking for. Be specific and include relevant terms (e.g., 'Bornhuetter-Ferguson technique', 'chain ladder method', 'loss reserving').",
			usage: "Your search query here",
		},
		{
			name: "top_k",
			required: false,
			instruction: "Maximum number of results to return (default: 3, max: 10).",
			usage: "3",
		},
	],
}

export const search_actuarial_docs_variants = [generic]
