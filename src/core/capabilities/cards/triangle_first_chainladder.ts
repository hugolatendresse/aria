import { CapabilityCard } from "../card_registry"

export const triangleFirstChainladderCard: CapabilityCard = {
	id: "triangle-first-chainladder",
	version: "1.3.0",
	title: "Triangle‑First (Chainladder)",
	triggers: [
		{
			kind: "keyword",
			any: ["triangle", "loss dev", "reserving", "pricing", "IBNR", "AY", "PY", "BF", "Mack", "chainladder"],
		},
		{ kind: "keyword", any: ["actuarial", "claims", "premium", "exposure"], all: ["data"] },
		{ kind: "regex", pattern: "\\b(development|ultimate|reserve|factor)", flags: "i" },
	],
	content: `**Capability Card: Triangle‑First (Chainladder) v1.3**

**Trigger:** Any actuarial task (loss dev/reserving/pricing/triangles/IBNR/BF/Mack/etc.)

---

### FOOLPROOF TEMPLATE - Copy This Exactly

**For wide CSV triangles with monthly ages (12, 24, 36...):**

\`\`\`python
def load_triangle_from_csv(file_path, target_accident_years):
    """TESTED PATTERN - Creates chainladder Triangle from wide CSV"""
    # Step 1: Load CSV
    df = pd.read_csv(file_path, thousands=',')
    
    # Step 2: Filter to target accident years FIRST (before melting)
    df = df[df['Accident Year'].isin(target_accident_years)]
    
    # Step 3: Melt wide format to long format
    df_long = df.melt(id_vars=['Accident Year'], var_name='age', value_name='value')
    
    # Step 4: Drop NaN rows (MANDATORY - prevents wrong origin inference)
    df_long = df_long.dropna()
    
    # Step 5: Convert age column to integer
    df_long['age'] = df_long['age'].astype(int)
    
    # Step 6: Create valuation date from accident year + age
    df_long['origin_period'] = pd.PeriodIndex(
        df_long['Accident Year'].astype(int).astype(str), freq='Y'
    )
    df_long['valuation'] = (
        df_long['origin_period'] + (df_long['age'].astype(int) // 12) - 1
    ).dt.to_timestamp(how='end')
    
    # Step 7: Drop helper column (keep: Accident Year, age, value, valuation)
    df_long = df_long.drop(columns=['origin_period'])
    
    # Step 8: Create Triangle
    # CRITICAL: Use exact column names - 'Accident Year' and 'valuation'
    tri = cl.Triangle(
        df_long,
        origin='Accident Year',  # Original CSV column (integer years)
        development='valuation',  # Datetime column we created
        columns=['value'],
        cumulative=True
    )
    
    return tri

# Usage:
target_years = list(range(2001, 2009))
tri = load_triangle_from_csv('path/to/file.csv', target_years)
\`\`\`

---

### Critical Rules

**DO - For development parameter:**
- ✓ Use \`development='valuation'\` (the datetime column you created)
- ✓ Valuation column must be datetime64[ns] dtype
- ✓ Create valuation from origin + age before calling Triangle()

**DON'T - Common mistakes:**
- ✗ \`development='age'\` (age is numeric, not date-like)
- ✗ Forgetting to create valuation column
- ✗ Using helper column name that was dropped
- ✗ Creating \`origin\` column and using \`origin='origin'\`

**DO - For origin parameter:**
- ✓ Use \`origin='Accident Year'\` (the original CSV column name)
- ✓ This column should be integers (2001, 2002, ...)
- ✓ Keep the original column, don't replace it

**DON'T:**
- ✗ Creating new origin column and using that
- ✗ Using Period columns as origin
- ✗ Typos in column name ('accident year' vs 'Accident Year')

**DO - Filtering:**
- ✓ Filter DataFrame BEFORE melting
- ✓ Include filtering IN helper functions
- ✓ Use \`.isin(target_years)\` or \`.between(start, end)\`
- ✓ Call \`.dropna()\` after melting

**DON'T:**
- ✗ Filter after Triangle() construction
- ✗ Assume filtering happened elsewhere
- ✗ Forget dropna() after melt

---

### Verification Checklist

After creating triangle, verify:
\`\`\`python
print(f"Triangle shape: {tri.shape}")  # (1, 1, n_AYs, n_dev)
print(f"Origins: {len(tri.origin)} (expected: {len(target_years)})")
assert len(tri.origin) == len(target_years), "Wrong number of origins!"
\`\`\`

---

### Common Errors and Fixes

**Error: "Development lags could not be determined"**
- Cause: \`development='age'\` instead of \`development='valuation'\`
- Fix: Use the datetime valuation column, not numeric age

**Error: IndexError with LDFs**
- Cause: Treating LDFs as 2D: \`ldfs[i, j]\`  
- Fix: Extract as 1D: \`ldfs = dev.ldf_.values[0, 0, 0, :]\`

**Error: Triangle has 18 origins instead of 8**
- Cause: Forgot dropna(); chainladder inferred from valuation range (2001-2018)
- Fix: Call dropna() after melting

**Error: All NaN ultimates**
- Cause: Triangle has wrong origins (didn't filter properly)
- Fix: Filter DataFrame before melting; check tri.shape

**Error: IndexError: list index out of range**
- Cause: Helper function loaded all years; dimension mismatch
- Fix: Include filtering in helper function

**Error: Using incr_to_cum() on cumulative triangle**
- Cause: Wrong conversion direction
- Fix: Use cum_to_incr() for cumulative→incremental

**No pandas-only solutions allowed unless user explicitly opts out.**`,
	sources: ["chainladder-python docs v0.8.24", "Actuarial compliance mandate"],
	safetyTags: ["actuarial", "compliance"],
}
