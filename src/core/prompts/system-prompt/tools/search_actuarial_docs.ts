import { isRagEnabled } from "@services/rag"
import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.RAG_SEARCH

const generic: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "search_actuarial_docs",
	description:
		"Search pre-indexed actuarial textbooks (including Friedland, Werner & Modlin), ASOP, and other actuarial literature for relevant passages. Returns verbatim text excerpts with source citations. Example: to find information about Bornhuetter-Ferguson, you would use: <search_actuarial_docs><query>Bornhuetter-Ferguson technique</query></search_actuarial_docs>. DO NOT FORGET to fill the query parameter",
	contextRequirements: () => isRagEnabled(),
	parameters: [
		{
			name: "query",
			required: true,
			instruction:
				"The search terms to find in the actuarial literature. Include specific concepts, techniques, or phrases you want to look up. This parameter is REQUIRED and must contain your search text.",
			usage: "Bornhuetter-Ferguson technique when it works",
		},
	],
}

export const search_actuarial_docs_variants = [generic]
