import { CapabilityCard } from "../card_registry"

export const triangleFirstChainladderCard: CapabilityCard = {
	id: "triangle-first-chainladder",
	version: "1.2.0",
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
	content: `**Capability Card: Triangle‑First (Chainladder) v1.2**

**Trigger:** Any actuarial task (loss dev/reserving/pricing/triangles/IBNR/BF/Mack/etc.)

**Required Steps (no exceptions):**

1. **Normalize data to tidy long form and remove NaN rows**
   
   **CRITICAL - Always call dropna() after melting:**
   
   \`\`\`python
   # Melt wide format to long format
   df_long = df.melt(id_vars=['Accident Year'], var_name='age', value_name='paid')
   
   # MANDATORY: Drop NaN rows before creating triangle
   df_long = df_long.dropna()
   \`\`\`
   
   **Why this matters:**
   - Wide triangles have NaN for future development ages (e.g., AY 2008 has no age 120 data)
   - After melt, these become rows with NaN values but valid dates
   - If NaN rows remain, chainladder may infer origin range from ALL valuation dates
   - Example: AY 2008 + age 120 = valuation 2018 → chainladder creates origins 2001-2018 (18 origins!)
   - dropna() removes these rows, keeping only actual data
   
   **Symptom if you forget dropna():**
   - Triangle has more origins than accident years (e.g., 18 instead of 8)
   - All ultimate values are NaN

2. **Date handling and Triangle setup:**
   
   **If you have numeric ages: derive valuation:**
   \`\`\`python
   df_long['origin_period'] = pd.PeriodIndex(df_long['Accident Year'].astype(int).astype(str), freq='Y')
   df_long['valuation'] = (df_long['origin_period'] + (df_long['age'].astype(int) // 12) - 1).dt.to_timestamp(how='end')
   
   # Drop the helper column - chainladder will use 'Accident Year' directly
   df_long = df_long.drop(columns=['origin_period'])
   \`\`\`

**CRITICAL:** Always convert numeric columns to int before string conversion. Drop helper Period columns before creating Triangle.

3. **Filtering Accident Years**

**CRITICAL - Filter BEFORE triangle construction:**

\`\`\`python
# Filter DataFrame FIRST
df_filtered = df[df['Accident Year'] >= 2001]

# Melt, DROP NaN, then create triangle
df_long = df_filtered.melt(id_vars=['Accident Year'], ...)
df_long = df_long.dropna()
tri = cl.Triangle(df_long, origin='Accident Year', development='valuation', ...)
\`\`\`

**VERIFY:**
\`\`\`python
print(f"Triangle shape: {tri.shape}")  # Should be (1, 1, n_AYs, n_dev)
\`\`\`

4. **Build Triangle and Get Dimensions**

**CRITICAL - Don't hardcode ages or dimensions:**

WRONG:
\`\`\`python
# Hardcoded ages - will break if triangle has different dimensions!
ages = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]
n_ages = 10

# Later: IndexError when accessing triangle[i, 9] but triangle only has 8 columns
\`\`\`

RIGHT:
\`\`\`python
# Create triangle
tri = cl.Triangle(df_long, origin='Accident Year', development='valuation', 
                 columns=['paid'], cumulative=True)

# Get dimensions FROM the triangle
n_accident_years = tri.shape[2]
n_development_periods = tri.shape[3]

# Generate age list dynamically based on actual triangle structure
# For monthly ages (12, 24, 36, ...):
ages = [12 * (i + 1) for i in range(n_development_periods)]

# OR extract from triangle directly if available:
# ages = [int(x) for x in tri.development]  # If development stored as ages
\`\`\`

**Why this matters:**
- dropna() removes rows, so actual triangle may be smaller than expected
- Different AYs have different maturity levels
- Hardcoded dimensions cause IndexError when looping

5. **Using Development and Calculating Ultimates**

**LDF Shape:** \`dev.ldf_\` has shape \`(1, 1, 1, n_development_periods)\` - one set for all AYs.

**RIGHT - Use Pipeline:**
\`\`\`python
pipe = cl.Pipeline(steps=[
    ('dev', cl.Development(average='volume', n_periods=4)),
    ('tail', cl.TailConstant(tail=1.00)),
    ('model', cl.Chainladder())
])
pipe.fit(tri)
ultimates_by_ay = pipe.named_steps.model.ultimate_.values[0, 0, :, -1]
\`\`\`

**WRONG - Treating LDFs as 2D:**
\`\`\`python
ldfs = dev.ldf_.values[0, 0, :, :]  # Shape (1, n_dev)
ldf_value = ldfs[i, j]  # IndexError when i > 0!
\`\`\`

**Common Issues:**
- **Triangle has wrong number of origins** → Forgot dropna(); chainladder inferred from valuation range
- **All NaN ultimates** → Triangle has wrong origins; verify dropna() and filtering
- **IndexError: index N out of bounds** → Hardcoded ages/dimensions don't match triangle; use tri.shape
- **IndexError accessing LDF values** → Treating as 2D; use \`[0,0,0,:]\` for 1D
- **Using incr_to_cum() on cumulative triangles** → Use cum_to_incr() instead; check cumulative status

**No pandas-only solutions allowed unless user explicitly opts out.**`,
	sources: ["chainladder-python docs v0.8.24", "Actuarial compliance mandate"],
	safetyTags: ["actuarial", "compliance"],
}
