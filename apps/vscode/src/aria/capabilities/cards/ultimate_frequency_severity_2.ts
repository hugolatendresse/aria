import { CapabilityCard } from "../card_registry"

export const ultimateFreqSev2Card: CapabilityCard = {
	id: "ultimate-freqsev-2",
	version: "1.5.0",
	title: "Ultimates: Frequency–Severity (Approach 2 – Exposure-Based for Recent AYs)",
	triggers: [
		{
			kind: "regex",
			pattern:
				"(?:^|[.!?]\\s+)[^.!?]*\\b(?:freq(?:uency)?[\\s-]?sev(?:erity)?|frequency\\s+and\\s+severity)[^.!?]*\\b(?:ultimate|develop|ibnr|reserve)s?\\b[^.!?]*(?:[.!?]|$)",
			flags: "i",
		},
		{
			kind: "regex",
			pattern:
				"(?:^|[.!?]\\s+)[^.!?]*\\b(?:ultimate|develop|ibnr|reserve)s?\\b[^.!?]*\\b(?:freq(?:uency)?[\\s-]?sev(?:erity)?|frequency\\s+and\\s+severity)[^.!?]*(?:[.!?]|$)",
			flags: "i",
		},
	],
	content: `**Capability Card: Frequency–Severity 2 v1.5**

**Key Difference from FS Method #1:**  
Instead of developing counts and severities for ALL accident years, FS #2 uses **exposure-based frequency projections** only for the **latest N years** (typically 2) where development factors are highly leveraged and unstable. Older years use standard development.

**Core Approach:**
1. Project ultimate **counts** for latest N AYs: \`Ultimate Count = Selected Frequency × Exposure\`
2. Project ultimate **severity** for latest N AYs by selecting from trended historical severities
3. Combine: \`Ultimate = Projected Count × Selected Severity\`

**CRITICAL: Exposure Measure Selection**

Frequency is a rate: **claims per unit of exposure**. The exposure measure depends on available data:

- **Preferred**: Use actual exposure data (e.g., earned car-years, policy count, insured units)
  - Formula: \`Frequency = Claims / Exposure\`
  - Ultimate: \`Count = Frequency × Exposure\`

- **Common Proxy**: Use on-level earned premium when exposure data unavailable
  - Formula: \`Frequency = Claims / (On-Level Premium / 1000)\` (per $1000)
  - Ultimate: \`Count = Frequency × (Earned Premium / 1000)\`
  - **Must put premium on-level** using rate changes to remove price effects
  
- **Other Proxies**: May use other measures specified by the user (payroll, sales, etc.)

**Pay attention to the units and apply any adjustments specified by the user.**

---

### Triangle Construction

**CRITICAL:** Follow the Triangle construction rules in the **Triangle-First (Chainladder)** capability card. Most importantly: **always use the original integer accident year column name** (e.g., \`'Accident Year'\`) as the \`origin\` parameter, NOT a PeriodIndex column.

---

### Full Workflow

**FREQUENCY SIDE:**

1. **Prepare exposure measure**
   - If using actual exposure: Use as-is (may apply trend or other adjustments per instructions)
   - If using premium proxy: Calculate on-level premiums using rate changes
     - Build cumulative rate factors from historical rate changes
     - Apply on-level factors to bring all premiums to target year rate level
   
2. **Develop counts to ultimate** using chainladder on reported claim count triangle
   - **Construct triangle properly** (follow Triangle-First card - use original integer year column)
   - Apply specified development method (e.g., volume-weighted, simple average)

3. **Calculate frequency from stable years** 
   - With exposure: \`Frequency = (Trended Ultimate Count) / Exposure\`
   - With premium: \`Frequency = (Trended Ultimate Count) / (On-Level Premium / 1000)\`
   - Units matter: verify dimensionality (claims per unit)
   
4. **Select frequency** (e.g., average of stable years)

5. **Calculate unadjusted frequency for each AY** by reversing adjustments
   - **CRITICAL: We need to BACK OUT the trend AND on-level adjustments to get the unadjusted frequency.**
   - **Reverse trend adjustment**: divide by trend factor
   - **On level and other adjustments**: DIVIDE by on-level factor and any other adjustments
   - If using premium: reverse on-level adjustment by multiplying by on-level factor
   - Formula: \`Unadj_Freq = (Selected_Freq [× OnLevel_Factor if premium]) / Trend_Factor\`

6. **Project counts** using unadjusted frequency and appropriate exposure
   - With exposure: \`Projected_Count = Unadj_Freq × Exposure\`
   - With premium: \`Projected_Count = Unadj_Freq × (Earned_Premium / 1000)\` (use actual, not on-level)

**SEVERITY SIDE:**

1. **Develop severities to ultimate** using unadjusted reported data (claims ÷ counts)
   - **Construct triangle properly** (follow Triangle-First card - use original integer year column)
   - Apply specified development method

2. **Adjust developed severities** for HISTORICAL years only
   - Apply trend to bring to target year level
   - Apply special factors (tort reform, etc.) to bring to current basis
   - Create a list containing ONLY adjusted historical year severities
   - **DO NOT** add projection year severities to this list

3. **Select severity** from adjusted historical severities (e.g., middle 3 of latest 5)

4. **De-trend selected severity** to each projection AY's level
   - Only apply trend de-adjustment, NOT special factors
   - Formula: \`AY_Severity = Selected_Sev / ((1 + trend)^(target_year - ay))\`

**COMBINE:**

\`Ultimate[AY] = Projected_Count[AY] × AY_Severity[AY]\`

### Handling Special Adjustments (Tort Reform, Claims Changes)

When claims environment changes affect comparability (tort reform, regulatory changes, etc.), apply special factors to adjust developed historical severities. See the **Special Adjustments: Tort Reform** capability card for complete logic, factor direction, and implementation patterns. Key points: (1) Apply factors to developed ultimate severities, not raw triangles; (2) Adjust ONLY historical years used for selection, NOT projection years; (3) Factor direction depends on whether change increased or decreased losses.

---

### Complete Code Example (Using Premium as Exposure Proxy)

\`\`\`python
import chainladder as cl
import pandas as pd
import numpy as np

# Configuration
latest_projection_years = [...]  # Years to project with FS #2
stable_years = [...]  # Years for frequency selection
all_accident_years = [...]  # All years in analysis
target_year = ...  # Year to trend everything to
count_trend = ...  # e.g., -0.015
sev_trend = ...    # e.g., 0.05

# === LOAD AND PREPARE TRIANGLES ===

# Load triangles (follow Triangle-First card for construction)
reported_count_tri = load_triangle_from_csv('reported_count_triangle.csv')
reported_claims_tri = load_triangle_from_csv('reported_claims_triangle.csv')

# === FREQUENCY SIDE ===

# Step 1: Prepare exposure measure (using premium as proxy)
premium_df = pd.read_csv('earned_premium_and_rate_changes.csv', thousands=',')
premium_df['rate_factor'] = 1 + premium_df['rate_change_pct']
premium_df['cumulative_rate_factor'] = premium_df['rate_factor'].cumprod()
target_cumulative = premium_df.loc[premium_df['AY'] == target_year, 'cumulative_rate_factor'].values[0]
premium_df['onlevel_factor'] = target_cumulative / premium_df['cumulative_rate_factor']
premium_df['onlevel_premium'] = premium_df['earned_premium'] * premium_df['onlevel_factor']

# Step 2: Develop counts to ultimate
count_pipe = cl.Pipeline([
    ('dev', cl.Development(average='volume', n_periods=...)),
    ('tail', cl.TailConstant(tail=...)),
    ('model', cl.Chainladder())
])
count_pipe.fit(reported_count_tri)
count_ult_by_ay = count_pipe.named_steps.model.ultimate_.values[0, 0, :, -1]

# Step 3: Calculate frequency from stable years
frequencies = {}
for year in stable_years:
    idx = all_accident_years.index(year)
    trended_count = count_ult_by_ay[idx] * (1 + count_trend)**(target_year - year)
    onlevel_prem = premium_df.loc[premium_df['AY'] == year, 'onlevel_premium'].values[0]
    frequencies[year] = trended_count / (onlevel_prem / 1000)  # Claims per $1000

# Step 4: Select frequency
selected_freq = np.mean(list(frequencies.values()))

# Step 5: Calculate unadjusted frequency for each AY (reverse adjustments)
unadjusted_freqs = []
for year in all_accident_years:
    onlevel_factor = premium_df.loc[premium_df['AY'] == year, 'onlevel_factor'].values[0]
    trend_factor = (1 + count_trend)**(target_year - year)
    unadj_freq = (selected_freq * onlevel_factor) / trend_factor
    unadjusted_freqs.append(unadj_freq)

# Step 6: Project counts using ACTUAL earned premium (not on-level)
projected_counts = []
for i, year in enumerate(all_accident_years):
    earned_prem = premium_df.loc[premium_df['AY'] == year, 'earned_premium'].values[0]
    proj_count = unadjusted_freqs[i] * (earned_prem / 1000)
    projected_counts.append(proj_count)

# === SEVERITY SIDE ===

# Step 1: Develop severity to ultimate (no adjustments!)
severity_tri = reported_claims_tri / reported_count_tri
severity_pipe = cl.Pipeline([
    ('dev', cl.Development(average='simple', n_periods=...)),
    ('tail', cl.TailConstant(tail=...)),
    ('model', cl.Chainladder())
])
severity_pipe.fit(severity_tri)
sev_ult_by_ay = severity_pipe.named_steps.model.ultimate_.values[0, 0, :, -1]

# Step 2: Adjust developed severities (HISTORICAL YEARS ONLY)
adjusted_historical_sevs = []
for i, year in enumerate(all_accident_years):
    if year < latest_projection_years[0]:  # Only historical years
        trend_factor = (1 + sev_trend) ** (target_year - year)
        special_factor = calculate_special_factor(year)  # Tort reform, etc.
        adjusted_historical_sevs.append(sev_ult_by_ay[i] * trend_factor * special_factor)
    # Projection years are NOT added to this list

# Step 3: Select severity from adjusted historical severities
latest_k_adjusted = adjusted_historical_sevs[-k:]  # Last k from HISTORICAL list
selected_sev = apply_selection_method(latest_k_adjusted)  # e.g., mean of middle 3 of 5

# Step 4: Calculate ultimates for projection years
ultimates = {}
for year in latest_projection_years:
    year_idx = all_accident_years.index(year)
    
    # De-trend severity to this AY's level (no special factors!)
    ay_severity = selected_sev / ((1 + sev_trend) ** (target_year - year))
    
    # Ultimate = Projected Count × AY Severity
    ultimates[year] = projected_counts[year_idx] * ay_severity

total_ultimate = sum(ultimates.values())

# IBNR calculation
latest_reported = {}
for year in latest_projection_years:
    idx = all_accident_years.index(year)
    latest_reported[year] = reported_claims_tri.latest_diagonal.values[0, 0, idx, 0]

total_ibnr = total_ultimate - sum(latest_reported.values())
\`\`\`

---

**When to use:**  
Latest N AYs have high LDF leverage making development unstable; you have credible exposure measure by AY (actual exposure or premium proxy).

**Critical pitfalls:**  
- **Wrong triangle construction**: Not following Triangle-First card rules (WRONG! Use original integer year column as origin)
- **Wrong ultimate formula**: Computing \`frequency × severity\` directly without exposure measure (WRONG!)
- **Using wrong exposure type**: Mixing on-level and actual premium incorrectly (on-level for frequency calc, actual for projection)
- **Missing on-level calculation when using premium**: Using raw earned premium to calculate frequency without adjusting for rate changes (WRONG! Must put premium on-level first)
- **Dimensional analysis failure**: Not tracking units (claims per unit vs claims per $1000) leading to wrong calculations
- **Adjusting triangle before developing** (WRONG! Always develop first, then adjust developed ultimates)
- **Including projection years in adjusted severities collection** (WRONG! Only store adjusted historical years)
- **Wrong array boundaries**: Selecting "latest K" from wrong list or wrong indices
- **Applying special factors to projection years** (WRONG! They're already at target level)
- **Wrong factor direction**: If costs decreased by X%, multiply historical years by (1-X) to bring down, not projection years
- **Reversing adjustments incorrectly**: When de-trending, must reverse adjustments in correct order

**When NOT to use:**  
No reliable exposure measure by AY; exposure measures are unstable; latest years undergoing structural shifts.

`,
	sources: [
		"Friedland — Chapter 11, Frequency–Severity Techniques (Approach #2).",
		"Friedland — Exhibit IV (on-level premium as exposure proxy).",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
