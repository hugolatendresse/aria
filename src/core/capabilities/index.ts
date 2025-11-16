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
export function getRelevantCapabilityCards(userMessages: string[]): CapabilityCardResult {
	const detections = detectCards(userMessages, CARD_REGISTRY)
	const selected = detections.map((d) => d.card)
	const signals = detections.flatMap((d) => d.signals)
	const cardsBlock = formatCardsForPrompt(selected, signals)

	return {
		cardsFound: selected.length > 0,
		cardIds: selected.map((c) => c.id),
		signals,
		cardsBlock,
	}
}

/**
 * Helper: Get cards for a single user message
 */
export function getCapabilityCardsForMessage(message: string): CapabilityCardResult {
	return getRelevantCapabilityCards([message])
}

export { cards } from "./card_registry"
export { detectCards } from "./detect"
export { formatCardsForPrompt } from "./format"
