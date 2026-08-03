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

**CRITICAL: This template is for FINAL DATA PREPARATION ONLY, not for LDF calculation!**

When calculating Loss Development Factors (LDFs), you MUST use ALL available historical years. Only use this filtering function when you need to prepare data for non-development purposes (e.g., trend analysis after ultimates are calculated).

**For LDF/development factor calculation:**
- Load ALL available years from the CSV without filtering
- Calculate development factors using the full triangle
- Extract specific years' ultimates AFTER fitting the model

**For wide CSV triangles with STANDARD monthly ages (12, 24, 36, 48, 60...):**

\`\`\`python
def load_triangle_from_csv(file_path, target_accident_years=None):
    """
    TESTED PATTERN - Creates chainladder Triangle from wide CSV
    
    IMPORTANT: Use this ONLY for standard 12-month ages (12, 24, 36, 48...).
    For non-standard ages (15, 27, 39...), use load_triangle_from_csv_nonstandard_ages().
    
    WARNING: For LDF calculation, pass target_accident_years=None to use ALL years.
    Only filter when extracting specific years AFTER development factors are fit.
    """
    # Step 1: Load CSV
    df = pd.read_csv(file_path, thousands=',')
    
    # Step 2: Filter to target accident years ONLY if specified
    # CRITICAL: For LDF calculation, skip filtering (pass None)
    if target_accident_years is not None:
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

# CORRECT Usage for LDF calculation:
# Load ALL available years (no filtering)
tri = load_triangle_from_csv('path/to/file.csv', target_accident_years=None)

# Fit development model using all available data
pipe = cl.Pipeline(steps=[
    ('dev', cl.Development(average='simple')),
    ('tail', cl.TailConstant(tail=1.0)),
    ('model', cl.Chainladder())
])
pipe.fit(tri)

# Extract ultimates for ALL years
all_ultimates = pipe.named_steps.model.ultimate_.values[0, 0, :, 0]

# THEN filter to specific years if needed for your analysis
target_years = [2011, 2012, 2013, 2014, 2015]
origin_years = [int(str(origin).split('-')[0]) for origin in tri.origin]
target_indices = [i for i, year in enumerate(origin_years) if year in target_years]
ultimates_for_analysis = all_ultimates[target_indices]
\`\`\`

**CRITICAL: Check Your Development Ages Before Loading!**

Before loading any triangle, **inspect the CSV column headers** to determine which loading function to use:

\\\`\\\`\\\`python
# Always check the CSV columns first!
df = pd.read_csv('triangle.csv')
print(df.columns.tolist())
# Output: ['Accident Year', '15 Months', '27 Months', '39 Months', ...]
\\\`\\\`\\\`

**If ages are standard 12-month increments (12, 24, 36, 48...):**
- Use the standard load_triangle_from_csv() function below

**If ages are non-standard (15, 27, 39, 51, 63, 75, 87...):**
- Use the load_triangle_from_csv_nonstandard_ages() function (see below)
- CRITICAL: Non-standard ages require relativedelta and subtracting 1 day

---

**SPECIAL CASE: Non-standard development ages (15, 27, 39, 51, 63 months):**

When your CSV has development ages that don't align with 12-month increments (e.g., 15, 27, 39 months instead of 12, 24, 36), chainladder will misalign the data during grain inference. Fix this by setting the valuation date to the END of the development period (subtract 1 day):

\\\`\\\`\\\`python
from dateutil.relativedelta import relativedelta

def load_triangle_from_csv_nonstandard_ages(file_path):
    """
    Use this variant when CSV has ages like 15, 27, 39, 51, 63 months
    """
    df = pd.read_csv(file_path, thousands=',')
    
    df_long = df.melt(id_vars=['Accident Year'], var_name='age', value_name='value')
    df_long = df_long.dropna()
    df_long['age'] = df_long['age'].str.extract(r'(\\d+)').astype(int)
    
    # CRITICAL: Use relativedelta and subtract 1 day for proper alignment
    df_long['origin'] = pd.to_datetime(df_long['Accident Year'].astype(str) + '-01-01')
    df_long['valuation'] = df_long.apply(
        lambda row: row['origin'] + relativedelta(months=int(row['age'])) - pd.Timedelta(days=1), 
        axis=1
    )
    
    tri = cl.Triangle(
        df_long,
        origin='origin',
        development='valuation',
        columns=['value'],
        cumulative=True
    )
    
    return tri

# With this approach, development periods will correctly show as 15, 27, 39, 51, 63
# instead of being misaligned to 27, 39, 51, 63, 75
\\\`\\\`\\\`

**Why subtract 1 day?**
- Adding exactly N months (e.g., 15) gives valuation at start of month N+15
- Chainladder infers this belongs to the next development bucket
- Subtracting 1 day puts it at end of month N+14, correctly aligning with the N-month bucket
- Example: AY 2015 + 15 months = 2016-04-01 (chainladder thinks 27 months)
- Example: AY 2015 + 15 months - 1 day = 2016-03-31 (chainladder correctly recognizes 15 months)

---

### Critical Rules

**DO - For development parameter:**
- Use development='valuation' (the datetime column you created)
- Valuation column must be datetime64[ns] dtype
- Create valuation from origin + age before calling Triangle()

**DON'T - Common mistakes:**
- DON'T use development='age' (age is numeric, not date-like)
- DON'T forget to create valuation column
- DON'T use helper column name that was dropped
- DON'T create origin column and use origin='origin'

**DO - For origin parameter:**
- Use origin='Accident Year' (the original CSV column name)
- This column should be integers (2001, 2002, ...)
- Keep the original column, don't replace it

**DON'T:**
- DON'T create new origin column and use that
- DON'T use Period columns as origin
- DON'T use typos in column name ('accident year' vs 'Accident Year')

**DO - Filtering:**
- **FOR LDF CALCULATION: Do NOT filter - use ALL available years**
- Filter/extract specific years AFTER fitting the development model
- Call .dropna() after melting (always required)
- Only pre-filter when NOT calculating development factors (rare)

**DON'T:**
- **NEVER filter triangle data before calculating LDFs - this gives wrong results!**
- DON'T filter after Triangle() construction (too late)
- DON'T assume filtering happened elsewhere
- DON'T forget dropna() after melt
- DON'T define hardcoded target years for development factor calculation

---

### Verification Checklist

After creating triangle, verify:
\\\`\\\`\\\`python
print(f"Triangle shape: {tri.shape}")  # (1, 1, n_AYs, n_dev)
print(f"Origins: {len(tri.origin)} (expected: {len(target_years)})")
assert len(tri.origin) == len(target_years), "Wrong number of origins!"
\\\`\\\`\\\`

---

### Common Errors and Fixes

**Error: "Development lags could not be determined"**
- Cause: development='age' instead of development='valuation'
- Fix: Use the datetime valuation column, not numeric age

**Error: IndexError with LDFs**
- Cause: Treating LDFs as 2D: ldfs[i, j]
- Fix: Extract as 1D: ldfs = dev.ldf_.values[0, 0, 0, :]

**Error: Triangle has 18 origins instead of 8**
- Cause: Forgot dropna(); chainladder inferred from valuation range (2001-2018)
- Fix: Call dropna() after melting

**Error: All NaN ultimates**
- Cause: Triangle has wrong origins (did not filter properly)
- Fix: Filter DataFrame before melting; check tri.shape

**Error: IndexError: list index out of range**
- Cause: Helper function filtered years but analysis expects different years
- Fix: For LDF calculation, do NOT filter - use all available years

**Error: Wrong ultimate losses / LDF values don't match expected**
- Cause 1: Triangle was filtered before calculating development factors
- Fix: Load ALL available years, calculate LDFs on full data, THEN extract specific years' ultimates
- Cause 2: Used standard loading function for non-standard ages (or vice versa)
- Fix: Check CSV column headers - use correct loading function for your age pattern (12/24/36 vs 15/27/39)

**Error: Triangle has wrong development ages (shows 12, 24, 36 when data has 15, 27, 39)**
- Cause: Used standard loading function for non-standard age data
- Fix: Use load_triangle_from_csv_nonstandard_ages() with relativedelta and subtract 1 day
- Verify: Check tri.development.values matches your CSV column ages

**Error: Using incr_to_cum() on cumulative triangle**
- Cause: Wrong conversion direction
- Fix: Use cum_to_incr() for cumulative to incremental

**No pandas-only solutions allowed unless user explicitly opts out.**`,
	sources: ["chainladder-python docs v0.8.24", "Actuarial compliance mandate"],
	safetyTags: ["actuarial", "compliance"],
}
