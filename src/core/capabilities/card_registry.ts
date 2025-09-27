import { classicalLimitedFluctuationCredibilityCard, credibilityBayesianCard, credibilityBuhlmannCard } from "./cards/credibility"
import { triangleFirstChainladderCard } from "./cards/triangle-first-chainladder"
import { ultimateCapeCodCard } from "./cards/ultimate-capecod"
import { ultimateChainladderCard } from "./cards/ultimate-chainladder"

export type CapabilityCard = {
	id: string
	version: string
	title: string
	triggers: Array<
		{ kind: "keyword"; any: string[]; all?: string[]; none?: string[] } | { kind: "regex"; pattern: string; flags?: string }
	>
	importance?: number
	short: string
	long: string
	sources?: string[]
	safetyTags?: string[]
}

export const CARD_BUDGET_TOKENS = 800 // tune via config

export const cards: CapabilityCard[] = [
	triangleFirstChainladderCard,
	ultimateCapeCodCard,
	ultimateChainladderCard,
	classicalLimitedFluctuationCredibilityCard,
	credibilityBuhlmannCard,
	credibilityBayesianCard,
]
