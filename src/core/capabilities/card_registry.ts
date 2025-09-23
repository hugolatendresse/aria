export type CapabilityCard = {
	id: string
	version: string
	title: string
	triggers: Array<
		{ kind: "keyword"; any: string[]; all?: string[]; none?: string[] } | { kind: "regex"; pattern: string; flags?: string }
	>
	importance?: number // 1..5, used for ranking
	short: string // <= 80 words
	long: string // <= 300 words
	sources?: string[] // human-readable refs
	safetyTags?: string[] // e.g., ['financial_advice', 'medical']
}

export const CARD_BUDGET_TOKENS = 800 // tune via config

export const cards: CapabilityCard[] = [
	{
		id: "triangle-data-creation",
		version: "1.0.0",
		title: "Triangle Data Creation (chainladder-python)",
		triggers: [
			{ kind: "keyword", any: ["triangle", "loss data", "claims data", "development", "chainladder"] },
			{ kind: "keyword", any: ["actuarial", "reserves"], all: ["data"] },
			{ kind: "regex", pattern: "\\b(tidy|long).*(triangle|actuarial)", flags: "i" },
		],
		importance: 5,
		short: `Creates chainladder Triangle from tidy data. If only numeric ages/lags provided, converts to valuation dates using PeriodIndex so development is date-like.`,
		long: `**Usage Pattern:**
\`\`\`python
import pandas as pd, chainladder as cl
df['origin'] = pd.PeriodIndex(df['origin'], freq='Q') 
df['valuation'] = (df['origin'] + df['age']).to_timestamp()
tri = cl.Triangle(df, origin='origin', development='valuation', columns=['paid'], cumulative=True)
\`\`\`

**Key Requirements:** Data must be long/tidy form. Origin and development must be date-like. If you have numeric ages, derive valuation dates first.

**Common Issues:** 
- Error "Development lags could not be determined" → Your development is numeric lag, not date-like
- Grain mismatch (origin quarterly, age in months) produces incorrect valuations`,
		sources: ["chainladder-python docs v0.8.24", "Triangle user guide"],
		safetyTags: ["actuarial"],
	},
]
