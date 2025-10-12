import { cards as CARD_REGISTRY } from "./card_registry"
import { detectCards } from "./detect"
import { formatCardsForPrompt } from "./format"

export interface CapabilityCardResult {
	cardsFound: boolean
	cardIds: string[]
	signals: string[]
	cardsBlock: string
}

/**
 * Main API: Check user messages and return relevant capability cards
 */
export function getRelevantCapabilityCards(userMessages: string[], tokenBudget?: number): CapabilityCardResult {
	const detections = detectCards(userMessages, CARD_REGISTRY)
	const selected = detections.map((d) => d.card)
	const cardsBlock = formatCardsForPrompt(selected, tokenBudget)

	return {
		cardsFound: selected.length > 0,
		cardIds: selected.map((c) => c.id),
		signals: detections.flatMap((d) => d.signals),
		cardsBlock,
	}
}

/**
 * Helper: Get cards for a single user message
 */
export function getCapabilityCardsForMessage(message: string, tokenBudget?: number): CapabilityCardResult {
	return getRelevantCapabilityCards([message], tokenBudget)
}

export { cards } from "./card_registry"
export { detectCards } from "./detect"
export { formatCardsForPrompt } from "./format"
