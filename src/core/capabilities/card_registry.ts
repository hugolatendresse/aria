import { classicalLimitedFluctuationCredibilityCard, credibilityBayesianCard, credibilityBuhlmannCard } from "./cards/credibility"
import { currentLevelPremiumCard } from "./cards/current_level_premium"
import { firstDollarComplementsUmbrellaCard } from "./cards/first_dollar_complements"
import { firstDollarTrendedPresentRatesCard } from "./cards/first_dollar_trended_present_rates"
import { lossTrendingFrequencySeverityCard } from "./cards/loss_adjustments"
import { lossRatioIndicationCard } from "./cards/loss_ratio_indication"
import { premiumOnLevelingCard, premiumTrendingCard } from "./cards/premium_adjustments"
import { specialAdjustmentsTortReformCard } from "./cards/special_adjustments_tort_reform"
import { triangleFirstChainladderCard } from "./cards/triangle_first_chainladder"
import { ultimateBornhuetterFergusonCard } from "./cards/ultimate_bornhuetter_ferguson"
import { ultimateCapeCodCard } from "./cards/ultimate_capecod"
import { ultimateChainladderCard } from "./cards/ultimate_chainladder"
import { ultimateFreqSev1Card } from "./cards/ultimate_frequency_severity_1"
import { ultimateFreqSev2Card } from "./cards/ultimate_frequency_severity_2"
import { ultimateFreqSev3Card } from "./cards/ultimate_frequency_severity_3"

export type CapabilityCard = {
	id: string
	version: string
	title: string
	triggers: Array<
		{ kind: "keyword"; any: string[]; all?: string[]; none?: string[] } | { kind: "regex"; pattern: string; flags?: string }
	>
	content: string
	sources?: string[]
	safetyTags?: string[]
}

export const cards: CapabilityCard[] = [
	triangleFirstChainladderCard,
	ultimateBornhuetterFergusonCard,
	ultimateCapeCodCard,
	ultimateChainladderCard,
	ultimateFreqSev1Card,
	ultimateFreqSev2Card,
	ultimateFreqSev3Card,
	specialAdjustmentsTortReformCard,
	currentLevelPremiumCard,
	classicalLimitedFluctuationCredibilityCard,
	credibilityBuhlmannCard,
	credibilityBayesianCard,
	firstDollarComplementsUmbrellaCard,
	firstDollarTrendedPresentRatesCard,
	premiumOnLevelingCard,
	premiumTrendingCard,
	lossTrendingFrequencySeverityCard,
	lossRatioIndicationCard,
]
