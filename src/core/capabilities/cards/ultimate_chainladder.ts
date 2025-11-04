import { CapabilityCard } from "../card_registry"

export const ultimateChainladderCard: CapabilityCard = {
	id: "ultimate-chainladder",
	version: "1.0.0",
	title: "Ultimates: Chain Ladder (LDF / link-ratio)",
	triggers: [
		{
			kind: "keyword",
			any: ["chain ladder", "chainladder", "chain-ladder", "link ratio", "link-ratio", "ldf", "cdf", "ultimate", "develop"],
		},
		{ kind: "regex", pattern: "\\b(chain[\\s-]?ladder|link[\\s-]?ratio|ldf|cdf|mack)\\b", flags: "i" },
	],
	content: `**Capability Card: Chain Ladder (Link-Ratio) v1.0**

**What it does:**
Fits age-to-age link ratios (LDFs), derives CDFs and an optional tail factor, then projects ultimate losses by origin. Optionally applies Mack's distribution-free variance model to get standard errors on reserves.

**When to use:**
- You have a cumulative loss Triangle (paid or reported) with credible development history
- You need a transparent baseline reserving method and/or Mack variability

**Canonical Implementation:**
\`\`\`python
import chainladder as cl

# X: cumulative loss Triangle (paid or reported)
# CRITICAL: Load ALL available years, even if you only need some for final analysis
X = loss_tri

# Pipeline approach - chains development, tail, and model together
pipe = cl.Pipeline(steps=[
    ('dev', cl.Development(average='volume')),
    ('tail', cl.TailCurve(curve='exponential')),  # or cl.TailConstant(tail=1.05)
    ('model', cl.Chainladder())
])

pipe.fit(X)

# Access results via named_steps
ult  = pipe.named_steps.model.ultimate_   # Triangle of ultimates for ALL origins
ibnr = pipe.named_steps.model.ibnr_       # Triangle of IBNR
ldf  = pipe.named_steps.model.ldf_        # selected age-to-age factors
cdf  = pipe.named_steps.model.cdf_        # cumulative-to-ultimate factors

# Extract values
total_ult = ult.sum().sum()               # Total across all origins (may need double .sum())
ult_df = ult.to_frame()                   # Convert to DataFrame
ult_array = ult.values                    # Get numpy array (shape: 1,1,n_origins,1)

# If you only need specific years (e.g., 2011-2015), filter AFTER fitting:
target_years = [2011, 2012, 2013, 2014, 2015]
origin_years = [int(str(origin).split('-')[0]) for origin in X.origin]
target_indices = [i for i, year in enumerate(origin_years) if year in target_years]
ultimates_for_target_years = ult_array[0, 0, target_indices, 0]
\`\`\`

**Averaging methods (Development.average):**
- \`'volume'\` — **Volume-weighted mean** of link ratios (i.e., weighted regression through the origin with weights proportional to the denominator). This reproduces the traditional dollar-weighted chain ladder factors.
- \`'simple'\` — **Arithmetic mean** of link ratios across origins (each origin contributes equally regardless of size).
- \`'regression'\` — **OLS through the origin** \(Y = mX + 0\) using equal weights; the slope \(m\) is the selected factor for that age.

Additional controls & patterns:
- **Per-age selections:** Pass a list the same length as the number of age-to-age periods to mix methods by age (e.g., early ages volume-weighted, later ages simple).
- **Latest-N origins:** \`n_periods=k\` uses only the latest \(k\) origin periods for factor selection (default \`-1\` = all).
- **Exclusions:** Use \`drop\` (cell indices), \`drop_high\` / \`drop_low\` (booleans or counts by age), \`drop_valuation\` (exclude valuation diagonals), and \`drop_above\` / \`drop_below\` (threshold filters) to omit outlier link ratios before averaging.
  - **SIMPLE BOOLEAN**: \`drop_high=True\` excludes the highest value from EACH age-to-age period uniformly
  - **LIST OF BOOLEANS**: \`drop_high=[True, True, False, False]\` gives per-age control (must match number of age-to-age transitions)
  - **DEFAULT**: Use simple boolean unless you need different exclusions at different ages
- **Grouping:** \`groupby='LOB'\` (or any axis label) fits patterns at an aggregate grain and applies them back to detailed triangles—useful inside a \`Pipeline\`.

Examples:
\`\`\`python
tri = cl.load_sample('genins')

# Compare standard selections
ldf_vol = cl.Development(average='volume').fit(tri).ldf_
ldf_sim = cl.Development(average='simple').fit(tri).ldf_
ldf_reg = cl.Development(average='regression').fit(tri).ldf_

# MOST COMMON: Simple boolean excludes high/low uniformly across all ages
ldf_excl = cl.Development(
    average='simple',
    drop_high=True,  # Exclude highest value from each age-to-age period
    drop_low=True    # Exclude lowest value from each age-to-age period
).fit(tri).ldf_

# Mix methods by age: volume, simple, regression, then repeat
ldf_mixed = cl.Development(
    average=['volume','simple','regression'] * 3
).fit(tri).ldf_

# ADVANCED: Per-age control of exclusions (rarely needed)
# Only use list format if you need different exclusions at different ages
ldf_latest5 = cl.Development(
    average='volume',
    n_periods=5,
    drop_high=[True, True, False, False, False, False, False, False, False],
    drop_low=[True, False, False, False, False, False, False, False, False],
).fit(tri).ldf_

# Group patterns by LOB, then apply back to company-level triangle
ldf_lob = cl.Development(groupby='LOB', average='volume').fit_transform(
    cl.load_sample('clrd')['CumPaidLoss']
).ldf_
\`\`\`

**Input/Output:**
- **Input:** X: cl.Triangle (cumulative loss), options for averaging (volume/simple/regression), tail selection, exclusions
- **Output:** ultimate_, ibnr_, ldf_, cdf_; with Mack: std_ultimate_ / std_reserve_

**Critical Points:**
- **CRITICAL: DO NOT FILTER TRIANGLE DATA BEFORE CALCULATING LDFs!** When you need ultimates for specific years (e.g., 2011-2015 for your analysis), you MUST load the FULL triangle with ALL available historical years (e.g., 2009-2015) to calculate stable development factors. Filter/extract specific years' ultimates AFTER the model is fit, NOT before. Pre-filtering reduces the number of origins and produces different/less stable LDFs, giving materially wrong results.
- DO NOT define hardcoded target years - simply use the available years in the triangle data
- Supply **cumulative** data; if you have incremental, cumulate first and validate triangles for structural zeros/outliers.
- **Use Pipeline:** Chains estimators into single object for reproducibility. Steps are named ('dev', 'tail', 'model') for easy access via \`pipe.named_steps.model.ultimate_\`.
- **Value extraction:** \`triangle.sum()\` may return a Triangle (not scalar) when multiple indices/columns exist. Use \`triangle.sum().sum()\` for total scalar, \`triangle.to_frame()\` for origin-level DataFrame, or \`triangle.values\` for raw numpy array.
- Apply any calendar-year adjustments (e.g., on-leveling, mix shifts) **before** fitting if they materially affect link ratios (parallelogram on-level technique for premium/exposure adjustment is documented in CAS *Basic Ratemaking*).
- **Tail options:** Use \`TailConstant(tail=1.05)\` for fixed tail factor, \`TailCurve\` for fitted curves. TailConstant supports \`decay\` parameter for exponential decay over projection periods.
- Choose averaging (volume vs. simple vs. regression) consistently across ages; consider excluding erratic early/late ages and select a defensible tail.
- Keep grain consistent (AY/PY, annual vs. quarterly) and align indexes; watch for sparse latest diagonals.
- Specify the tail attachment age if provided! E.g. cl.TailConstant(tail=1.05, attachment_age=120)

**KNOWN ISSUE: NaN Ultimates for Fully Developed Origins**

**Problem:** In some cases, \`model.ultimate_\` produces NaN values for origin periods that have reached the terminal development age of the triangle. This occurs because chainladder's \`latest_diagonal\` property incorrectly returns NaN for these mature origins, even though they have valid observed values.

**Symptoms:**
- Some origin years show NaN in \`pipe.named_steps.model.ultimate_.values\`
- These are typically the oldest origin periods that have data at or near the final development age
- The triangle itself shows valid data for these origins at their latest development period
- Total ultimate losses become NaN due to summing with NaN values

**Diagnosis:**
\`\`\`python
# Check if latest_diagonal shows NaN for origins with valid data
print(loss_tri.latest_diagonal)  # May show NaN for mature origins
print(loss_tri)                   # Shows valid data at terminal ages
\`\`\`

**Workaround:** Manually extract ultimate losses by applying CDFs to each origin's last observed value:
\`\`\`python
import numpy as np

pipe = cl.Pipeline(steps=[
    ('dev', cl.Development(average='volume')),
    ('tail', cl.TailConstant(tail=1.0)),
    ('model', cl.Chainladder())
])
pipe.fit(loss_tri)

# Manual extraction to avoid NaN issues
dev_obj = pipe.named_steps.dev
cdf_values = dev_obj.cdf_.values[0, 0, 0, :]
ultimates = []

for i, origin in enumerate(loss_tri.origin):
    # Get the row of triangle data for this origin
    row_data = loss_tri.values[0, 0, i, :]
    
    # Find last non-NaN value
    last_non_nan_idx = np.where(~np.isnan(row_data))[0][-1]
    last_value = row_data[last_non_nan_idx]
    
    # Handle case where CDF array may be shorter than triangle
    # (happens when using drop_high/drop_low or other exclusions)
    if last_non_nan_idx >= len(cdf_values):
        # Origin is at terminal age, no further development needed
        cdf_at_period = 1.0
    else:
        cdf_at_period = cdf_values[last_non_nan_idx]
    
    # Calculate ultimate = last_observed * CDF
    ultimate = last_value * cdf_at_period
    ultimates.append(ultimate)

# Now ultimates is a list with valid values for ALL origins (no NaN)
step_5_ultimate_losses = np.array(ultimates)
total_ultimate = step_5_ultimate_losses.sum()  # Valid total, no NaN
\`\`\`

**Why the CDF length check is critical:**
When using exclusions like \`drop_high\` or \`drop_low\`, chainladder may reduce the number of development factors it produces. For example:
- Triangle with 5 development ages creates 4 age-to-age transitions
- The CDF array has 4 elements (one for each transition age)
- If your triangle has a terminal age (index 4), there's no CDF[4] because no further development is possible
- Trying to access \`cdf_.values[0, 0, 0, 4]\` raises IndexError
- Solution: Check if \`last_non_nan_idx >= len(cdf_values)\` and use CDF=1.0 for terminal ages

**When to use workaround:**
- Always check for NaN values in \`model.ultimate_\` output
- If any NaN values exist despite valid triangle data, use manual extraction
- REQUIRED when using \`drop_high\`/\`drop_low\` or other exclusions that reduce CDF array size
- Particularly important when working with triangles where some origins have reached terminal development

**APPLYING CDFs TO DATA AT DIFFERENT MATURITY LEVELS**

**Critical:** When applying CDFs calculated from one triangle (e.g., countrywide) to losses from another source (e.g., state data), each accident year is at a different maturity level and requires a different CDF index. **NEVER apply the same CDF to all accident years.**

**How to determine correct CDF indices:**

1. **Know your triangle's development ages** - Check \`triangle.development.values\` (e.g., \`[15, 27, 39, 51, 63]\`)
2. **Calculate each loss's current age** - Valuation date minus accident year = months of maturity (AY 2011 at 12/31/2015 = 60 months)
3. **Find the next development age ≥ current age** - AY 2011 at 60 months → next age is 63 months
4. **Use the CDF at that age's position in the array** - If 63 is at position 5 → use CDF[5]

**Key mistake:** Don't assume CDF indices match age/12. Always match to the actual position in the development array.

\`\`\`python
# Calculate CDFs from source triangle
pipe.fit(countrywide_tri)
cdf_values = pipe.named_steps.model.cdf_.values[0, 0, 0, :]

# Verify what each CDF represents
print("Development ages:", countrywide_tri.development.values)
# Output: [15, 27, 39, 51, 63, ...]
# CDF[0] = 15 months to ultimate
# CDF[1] = 27 months to ultimate
# CDF[2] = 39 months to ultimate
# CDF[3] = 51 months to ultimate
# CDF[4] = 63 months to ultimate, etc.

# State losses at valuation date 12/31/2015 are at different ages:
# AY 2011 at 60 months → next age is 63 (position 4) → CDF[4]
# AY 2012 at 48 months → next age is 51 (position 3) → CDF[3]
# AY 2013 at 36 months → next age is 39 (position 2) → CDF[2]
# AY 2014 at 24 months → next age is 27 (position 1) → CDF[1]
# AY 2015 at 12 months → next age is 15 (position 0) → CDF[0]

cdf_indices = [4, 3, 2, 1, 0]  # For AY 2011-2015
state_ultimate_losses = state_reported_losses * cdf_values[cdf_indices]
\`\`\`

**Common mistake:** Using \`cdf_values[0]\` for all accident years assumes all losses are at the same maturity, which is incorrect.

**Version:** Tested with chainladder 0.8.x. API: cl.Pipeline(steps=[...]).fit(X) → pipe.named_steps.model.ultimate_/ibnr_/ldf_/cdf_; use MackChainladder() for std_ultimate_ / std_reserve_ diagnostics.`,
	sources: [
		"chainladder-python docs v0.8.x",
		"Mack (1993)",
		"CAS Basic Ratemaking (parallelogram on-level)",
		"https://chainladder-python.readthedocs.io/en/latest/user_guide/workflow.html",
		"https://chainladder-python.readthedocs.io/en/latest/library/generated/chainladder.Development.html",
		"https://chainladder-python.readthedocs.io/en/stable/getting_started/tutorials/development-tutorial.html",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
