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
	const jsonPath = path.join(__dirname, "../../../../chainladder_cards.json")
	try {
		const jsonContent = fs.readFileSync(jsonPath, "utf8")
		return JSON.parse(jsonContent)
	} catch {
		// Fallback if JSON file not found
		return {
			chainladder_version: "0.8.x",
			extraction_date: "fallback",
			cards: [],
		}
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

**When users provide actuarial data, help them create chainladder Triangle objects.**`
	}

	const triangleCard = info.cards[0] // Should be Triangle

	let instructions = `## Chainladder-Python Triangle Creation

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

	instructions += `### Basic Usage
\`\`\`python
# Create DataFrame
df = pd.DataFrame(data)
df['origin'] = pd.to_datetime(df['origin'], format='%Y')

# Create Triangle
triangle = cl.Triangle(df, origin='origin', development='dev', 
                      columns=['value'], cumulative=True)

print(f"Triangle shape: {triangle.shape}")
print(triangle.to_frame())
\`\`\`

### Error Handling
\`\`\`python
try:
    import chainladder as cl
    
    # Validate required columns
    required_cols = ['origin', 'dev', 'value'] 
    if not all(col in df.columns for col in required_cols):
        raise ValueError(f"Missing columns: {required_cols}")
    
    triangle = cl.Triangle(df, origin='origin', development='dev', 
                          columns=['value'], cumulative=True)
    
    if triangle.shape[0] == 0:
        raise ValueError("Empty triangle created")
        
except ImportError:
    print("Install chainladder: pip install chainladder")
except Exception as e:
    print(f"Error: {str(e)}")
\`\`\`

**When users provide actuarial data, help them create chainladder Triangle objects using this pattern.**`

	return instructions
}

export const CHAINLADDER_INSTRUCTIONS = generateChainladderInstructions()

export function getChainladderInstructions(): string {
	return CHAINLADDER_INSTRUCTIONS
}

export function regenerateInstructions(): string {
	return generateChainladderInstructions()
}
