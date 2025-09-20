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

	// Fallback if JSON file not found
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

	const triangleCard = info.cards[0] // Should be Triangle

	let instructions = `## Chainladder-Python Triangle Creation

**IMMEDIATE ACTION REQUIRED**: When users provide actuarial data, create Triangle objects first before any other analysis.

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

	instructions += `### Standard Implementation Pattern
\`\`\`python
# Step 1: Create DataFrame from user's data
df = pd.DataFrame(data)

# Step 2: Convert origin to datetime (adjust format as needed)
df['origin'] = pd.to_datetime(df['origin'], format='%Y')

# Step 3: Create Triangle object
triangle = cl.Triangle(df, origin='origin', development='dev', 
                      columns=['value'], cumulative=True)

# Step 4: Verify and display
print(f"Triangle created successfully!")
print(f"Shape: {triangle.shape}")
print(f"Origin periods: {triangle.origin}")
print(f"Development periods: {triangle.development}")
print()
print("Triangle data:")
print(triangle.to_frame())
\`\`\`

### Complete Error-Handled Implementation
\`\`\`python
def create_triangle_from_data(data):
    """
    Convert user's actuarial data into a chainladder Triangle object.
    This is the standard pattern to follow for all actuarial data.
    """
    try:
        import chainladder as cl
        import pandas as pd
        
        # Create DataFrame
        df = pd.DataFrame(data)
        print(f"Data loaded: {df.shape[0]} rows, {df.shape[1]} columns")
        print(f"Columns: {list(df.columns)}")
        
        # Validate required columns exist
        required_cols = ['origin', 'dev', 'value'] 
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")
        
        # Convert origin to datetime
        df['origin'] = pd.to_datetime(df['origin'], format='%Y')
        
        # Create Triangle
        triangle = cl.Triangle(df, origin='origin', development='dev', 
                              columns=['value'], cumulative=True)
        
        # Validate triangle was created successfully
        if triangle.shape[0] == 0:
            raise ValueError("Empty triangle created - check your data format")
        
        print(f"SUCCESS: Triangle created with shape {triangle.shape}")
        return triangle
        
    except ImportError:
        print("ERROR: chainladder not installed. Run: pip install chainladder")
        return None
    except Exception as e:
        print(f"ERROR creating triangle: {str(e)}")
        print("Check that your data has columns: origin, dev, value")
        return None

# Use this function for any actuarial data
triangle = create_triangle_from_data(your_data)
if triangle is not None:
    print(triangle.to_frame())
\`\`\`

**MANDATORY DIRECTIVE: Always use this Triangle creation pattern when users provide actuarial data. Do not skip this step or suggest alternative approaches without first creating the Triangle object.**`

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
