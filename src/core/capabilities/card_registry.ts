import { classicalLimitedFluctuationCredibilityCard, credibilityBayesianCard, credibilityBuhlmannCard } from "./cards/credibility"
import { firstDollarComplementsUmbrellaCard } from "./cards/first_dollar_complements"
import { firstDollarTrendedPresentRatesCard } from "./cards/first_dollar_trended_present_rates"
import { triangleFirstChainladderCard } from "./cards/triangle_first_chainladder"
import { ultimateBornhuetterFergusonCard } from "./cards/ultimate_bornhuetter_ferguson"
import { ultimateCapeCodCard } from "./cards/ultimate_capecod"
import { ultimateChainladderCard } from "./cards/ultimate_chainladder"

export type CapabilityCard = {
	id: string
	version: string
	title: string
	triggers: Array<
		{ kind: "keyword"; any: string[]; all?: string[]; none?: string[] } | { kind: "regex"; pattern: string; flags?: string }
	>
	importance?: number
	content: string
	sources?: string[]
	safetyTags?: string[]
}

export const cards: CapabilityCard[] = [
	triangleFirstChainladderCard,
	ultimateBornhuetterFergusonCard,
	ultimateCapeCodCard,
	ultimateChainladderCard,
	classicalLimitedFluctuationCredibilityCard,
	credibilityBuhlmannCard,
	credibilityBayesianCard,
	firstDollarComplementsUmbrellaCard,
	firstDollarTrendedPresentRatesCard,
]
