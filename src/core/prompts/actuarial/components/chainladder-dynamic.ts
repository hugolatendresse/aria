import * as fs from "fs"
import * as path from "path"

interface ChainladderCard {
	name: string
	module: string
	full_name: string
	signature?: string
	doc: string
	fitted_attributes: string[]
	key_methods: string[]
}

interface ChainladderInfo {
	chainladder_version: string
	extraction_date: string
	cards: ChainladderCard[]
}

function loadChainladderInfo(): ChainladderInfo {
	// Try multiple possible locations for the JSON file
	const possiblePaths = [
		path.join(__dirname, "../../../../../chainladder_cards.json"), // Development path
		path.join(process.cwd(), "chainladder_cards.json"), // Runtime path
		path.join(__dirname, "chainladder_cards.json"), // Direct path
	]

	for (const jsonPath of possiblePaths) {
		try {
			const jsonContent = fs.readFileSync(jsonPath, "utf8")
			return JSON.parse(jsonContent)
		} catch {}
	}

	console.warn("chainladder_cards.json not found in any expected location")
	return {
		chainladder_version: "0.8.x",
		extraction_date: "fallback",
		cards: [],
	}
}

function generateClassInstructions(card: ChainladderCard): string {
	const signature = card.signature ? `cl.${card.name}${card.signature}` : `cl.${card.name}()`

	let instructions = `**${card.name}**: ${card.doc}\n`
	instructions += `\`\`\`python\n${signature}\n\`\`\``

	if (card.fitted_attributes.length > 0) {
		instructions += `\nFitted attributes: ${card.fitted_attributes.map((attr) => `\`${attr}\``).join(", ")}`
	}

	return instructions
}

export function generateChainladderInstructions(): string {
	const info = loadChainladderInfo()

	if (info.cards.length === 0) {
		return `## Chainladder-Python Triangle Creation

### Installation & Import
\`\`\`python
# Install: pip install chainladder
import chainladder as cl
import pandas as pd
\`\`\`

### Basic Triangle Creation
\`\`\`python
df = pd.DataFrame(data)
df['origin'] = pd.to_datetime(df['origin'], format='%Y')
triangle = cl.Triangle(df, origin='origin', development='dev', 
                      columns=['value'], cumulative=True)
\`\`\`

**CRITICAL: When users provide actuarial data, you MUST create chainladder Triangle objects as your first action.**`
	}
	const triangleCard = info.cards[0]
	let instructions = `## Chainladder-Python Triangle Creation
**IMMEDIATE ACTION REQUIRED**: When users provide actuarial data, create Triangle objects first before any other analysis.

**MANDATORY: NO DEVIATION FROM CHAINLADDER TRIANGLE USAGE**
- You CANNOT deviate from using chainladder Triangle even if you think pandas or other approaches would be more straightforward
- You MUST use chainladder Triangle for ALL actuarial data processing, regardless of perceived complexity
- Do NOT suggest alternative implementations using pure pandas, numpy, or other libraries
- If you encounter age/lag data instead of dates, follow the contract below to derive proper development periods - do NOT abandon Triangle creation

Dynamic instructions from chainladder v${info.chainladder_version}

### Installation & Import
\`\`\`python
# Install: pip install chainladder
import chainladder as cl
import pandas as pd
\`\`\`

### Triangle Class
`
	instructions += generateClassInstructions(triangleCard) + "\n\n"
	instructions += `### Triangle input contract (strict)
1. Data must be long/tidy: one row per (index…, origin, development, measure) combination—not a wide triangle.
2. origin and development must be date‑like (parsable by pandas.to_datetime or a PeriodIndex).
Examples: origin = ['AccidentYear'] or ['AccidentYear','AccidentQuarter']; development = ['ValuationYear'] or ['ValuationYear','ValuationMonth'].
3. If the user supplies age/lag (e.g., months 12, 24, 36) instead of a valuation date, derive a date‑like development by adding the age to origin using the declared grain (Y/Q/M).
Grain must be consistent: if origin is quarterly, development must be quarterly; if monthly, monthly, etc.
4. When constructing the triangle, call:
\`\`\`python
cl.Triangle(
  df,
  origin=<origin_col or [cols]>,
  development=<valuation_col or [cols]>,
  columns=<measure cols>,
  index=<optional index cols>,
  origin_format=<optional strftime mask>,
  development_format=<optional strftime mask>,
  cumulative=<True/False>
)
\`\`\`

5. Validate before build:
Check pd.to_datetime (or PeriodIndex) succeeds for both axes.
Ensure no duplicate (origin, development) keys, and development increases within each origin.
If any step fails, return a clear message: "Provide date‑like origin and valuation‑period development (or an age plus a grain so I can derive it)."`

	return instructions
}

export const CHAINLADDER_INSTRUCTIONS = generateChainladderInstructions()

export function getChainladderInstructions(): string {
	// Always regenerate to ensure we get the latest data
	return generateChainladderInstructions()
}

export function regenerateInstructions(): string {
	return generateChainladderInstructions()
}
