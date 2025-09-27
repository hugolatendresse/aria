import { CapabilityCard } from "../card_registry"

export const triangleFirstChainladderCard: CapabilityCard = {
	id: "triangle-first-chainladder",
	version: "1.1.0",
	title: "Triangle‑First (Chainladder)",
	triggers: [
		{
			kind: "keyword",
			any: ["triangle", "loss dev", "reserving", "pricing", "IBNR", "AY", "PY", "BF", "Mack", "chainladder"],
		},
		{ kind: "keyword", any: ["actuarial", "claims", "premium", "exposure"], all: ["data"] },
		{ kind: "regex", pattern: "\\b(development|ultimate|reserve|factor)", flags: "i" },
	],
	importance: 5,
	short: `Triangle‑First approach: Any actuarial task requires tidy data normalization, then cl.Triangle construction. No exceptions.`,
	long: `**Capability Card: Triangle‑First (Chainladder) v1.1**

**Trigger:** Any actuarial task (loss dev/reserving/pricing/AY vs PY/triangles/IBNR/BF/Mack/etc.)

**Required Steps (no exceptions):**

1. **Normalize data to tidy long form**
   - Columns: origin (Period), development or valuation (Timestamp/Period), metric columns (paid, reported, etc.).

2. **If you have numeric ages: derive valuation:**
   \`\`\`python
   # For monthly development ages - age calculated from earliest date of origin
   df['origin_period'] = pd.PeriodIndex(df['origin'].astype(str) + '-01', freq='M')
   df['valuation'] = (df['origin_period'] + df['age'] - 1).dt.to_timestamp(how='end')
   \`\`\`
   **CRITICAL:** Development age is calculated from the earliest date of the origin period. Age 12 means "12 months from start of origin", but valuation should be end of that development period. Use Period arithmetic as shown above. Do NOT use \`origin.to_timestamp() + DateOffset(months=dev_period)\` which gives beginning of next period. Example: origin 2015 + dev age 12 = 2015-12-31, not 2016-01-01.

3. **Build Triangle**
   \`\`\`python
   tri = cl.Triangle(df, origin='origin', development='valuation', 
                     columns=['paid'], cumulative=True)
   \`\`\`

**Common Issues:**
- Error "Development lags could not be determined" → Your development is numeric lag, not date-like. Fix by deriving valuation dates first.
- Grain mismatch (origin quarterly, age in months) produces incorrect valuations. Convert age to same grain as origin before adding.
- Wide triangles (matrix form) must be melted to tidy/long before Triangle().
- If cumulative status unknown, set \`cumulative\` explicitly to avoid downstream issues.

**No pandas-only solutions allowed unless user explicitly opts out.**`,
	sources: ["chainladder-python docs v0.8.24", "Actuarial compliance mandate"],
	safetyTags: ["actuarial", "compliance"],
}
