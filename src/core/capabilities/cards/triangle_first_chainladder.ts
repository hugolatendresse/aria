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
	content: `**Capability Card: Triangle‑First (Chainladder) v1.1**

**Trigger:** Any actuarial task (loss dev/reserving/pricing/AY vs PY/triangles/IBNR/BF/Mack/etc.)

**Required Steps (no exceptions):**

1. **Normalize data to tidy long form**
   - Columns: origin (Period), development or valuation (Timestamp/Period), metric columns (paid, reported, etc.).
   - **Wide triangles with integer ages:** Melt to long format using \`df.melt(id_vars=['Accident Year'], var_name='age', value_name='paid')\`, then convert ages to valuation dates in step 2.

2. **Date handling and Triangle setup:**
   
   **Date Inference:** Origin/development can be column name (str) or list: \`origin='Acc Year'\` or \`development=['Cal Year', 'Cal Month']\`. Uses \`pd.to_datetime()\` for inference. Force with \`origin_format='%Y/%m/%d'\` if needed. If origin is accident years, development should be valuation years. If integers (age), convert: origin=2000 + age=1 → development=2001.
   
   **If you have numeric ages: derive valuation:**
   \`\`\`python
   # For annual origins with monthly ages (e.g., ages 12, 24, 36)
   # Convert to int first to handle float years (2000.0 → 2000)
   df['origin_period'] = pd.PeriodIndex(df['Accident Year'].astype(int).astype(str), freq='Y')
   df['valuation'] = (df['origin_period'] + (df['age'].astype(int) // 12) - 1).dt.to_timestamp(how='end')
   
   # For monthly origins with monthly ages
   df['origin_period'] = pd.PeriodIndex(df['origin'].astype(int).astype(str) + '-01', freq='M')
   df['valuation'] = (df['origin_period'] + df['age'].astype(int) - 1).dt.to_timestamp(how='end')
   \`\`\`
   **CRITICAL:** Always convert numeric columns to int before string conversion to avoid "2000.0" float formatting errors. Development age is calculated from the earliest date of the origin period. Age 12 means "12 months from start of origin", but valuation should be end of that development period. For annual origins with monthly ages, divide by 12 to convert to years. Example: origin 2000 + age 12 → valuation 2000-12-31.

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
