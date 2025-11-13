import { CapabilityCard } from "../card_registry"

export const ultimateFreqSev3Card: CapabilityCard = {
	id: "ultimate-freqsev-3",
	version: "1.1.0",
	title: "Ultimates: Frequency–Severity (Approach 3 – Disposal Rate Method)",
	triggers: [
		{
			kind: "regex",
			pattern:
				"(?:^|[.!?]\\s+)[^.!?]*\\b(?:freq(?:uency)?[\\s-]?sev(?:erity)?|frequency\\s+and\\s+severity|disposal\\s+rates?)[^.!?]*\\b(?:ultimate|develop|ibnr|reserve)s?\\b[^.!?]*(?:[.!?]|$)",
			flags: "i",
		},
		{
			kind: "regex",
			pattern:
				"(?:^|[.!?]\\s+)[^.!?]*\\b(?:ultimate|develop|ibnr|reserve)s?\\b[^.!?]*\\b(?:freq(?:uency)?[\\s-]?sev(?:erity)?|frequency\\s+and\\s+severity|disposal\\s+rates?)[^.!?]*(?:[.!?]|$)",
			flags: "i",
		},
	],
	content: `**Capability Card: Frequency–Severity 3 (Disposal Rate Method) v1.1**

**Key Concept:**  
Projects **incremental closed claim counts** using disposal rates (% of ultimate claims closed by each age), then multiplies by **incremental paid severities** to get ultimates.

**Core Formula:**  
\`Ultimate[AY] = Σ(Incremental_Count[age] × Unadjusted_Severity[AY, age])\`

---

### KEY DIFFERENCE from FS Method #2

**FS #2**: Adjusts ONLY historical years  
**FS #3**: Adjusts ALL years including projection years

Do NOT exclude projection years from adjustment or selection.

---

### Critical Steps

**STEP 1. Develop Reported Count to Ultimate**

\`\`\`python
# CRITICAL: Use n_periods parameter to specify latest N periods for LDF calculation
reported_pipe = cl.Pipeline(steps=[
    ('dev', cl.Development(average='volume', n_periods=4)),  # Specify n_periods!
    ('tail', cl.TailConstant(tail=1.00)),
    ('model', cl.Chainladder())
])
reported_pipe.fit(reported_count_tri)
reported_ultimate = reported_pipe.named_steps.model.ultimate_
\`\`\`

**WITHOUT n_periods**: Uses all available periods (may cause instability)
**WITH n_periods=4**: Uses only latest 4 periods (more stable)

**STEP 2. Build and Select Disposal Rates**

**CRITICAL - Disposal Rate Denominator:**

\`\`\`python
# RIGHT - Divide by ULTIMATE reported:
disposal_rate_tri = cwp_count_tri / reported_count_ultimate

# WRONG - Do NOT divide by current reported triangle:
# disposal_rate_tri = cwp_count_tri / reported_count_tri  # ← WRONG!
\`\`\`

**Why ultimate?** Disposal rates represent cumulative % of ULTIMATE claims that are closed, not % of current reported.

Then select:

\`\`\`python
selected_rates = []
for j in range(disposal_triangle.shape[3]):  # For each age column
    col_values = disposal_triangle.values[0, 0, :, j]
    valid = col_values[~np.isnan(col_values)]
    selected_rates.append(np.mean(valid[-n:]))  # Simple average of latest N

# CRITICAL: Append 1.00 for ultimate
selected_rates.append(1.00)

# MANDATORY VERIFICATION - Disposal rates must always increase
for i in range(len(selected_rates)-1):
    if selected_rates[i] > selected_rates[i+1]:
        raise ValueError(f"Disposal rates must increase! " + 
                        f"Rate[{i}]={selected_rates[i]:.3f} > Rate[{i+1}]={selected_rates[i+1]:.3f}")

# Should see: [0.24, 0.58, 0.71, 0.82, 0.91, 0.95, 0.98, 0.99, 1.00] ← increasing
# NOT: [0.24, 0.36, 0.20, 0.15...] ← decreasing = WRONG!
\`\`\`

**If verification fails**: You're selecting from wrong values. Disposal rates are CUMULATIVE percentages from disposal rate triangle, not incremental rates.

**STEP 3. Project Incremental Closed Claim Counts**

**CRITICAL - Preserve Historical Data:**

\`\`\`python
# Get historical incremental and cumulative data
cwp_incremental_array = cwp_count_tri.cum_to_incr().values[0, 0, :, :]
cwp_cumulative_array = cwp_count_tri.values[0, 0, :, :]
latest_cwp_by_ay = cwp_count_tri.latest_diagonal.values[0, 0, :, 0]

projected_incremental_cwp = np.zeros((n_origins, n_dev))

for i in range(n_origins):
    # Find last observed age for this AY
    last_observed_age_idx = 0
    for j in range(cwp_cumulative_array.shape[1]):
        if not np.isnan(cwp_cumulative_array[i, j]):
            last_observed_age_idx = j
    
    # Calculate base for projections
    unclosed_count = ultimate_reported_by_ay[i] - latest_cwp_by_ay[i]
    base_disposal_rate = selected_disposal_rates[last_observed_age_idx]
    base = unclosed_count / (1 - base_disposal_rate)
    
    for j in range(n_dev):
        # CHECK if historical data exists FIRST
        if j < cwp_incremental_array.shape[1] and not np.isnan(cwp_incremental_array[i, j]):
            # Use ACTUAL historical value
            projected_incremental_cwp[i, j] = cwp_incremental_array[i, j]
        else:
            # Project future/missing cells only
            if j == 0:
                disposal_rate_diff = selected_disposal_rates[j]
            else:
                disposal_rate_diff = selected_disposal_rates[j] - selected_disposal_rates[j-1]
            
            projected_incremental_cwp[i, j] = base * disposal_rate_diff
\`\`\`

**DO NOT** project all cells with simple multiplication - this throws away actual historical data!

**STEP 4. Calculate Incremental Paid Severity**

\`Incremental_Severity = Δ Paid / Δ Closed_Count\`

**STEP 5. Determine Trend Base Year**

**CRITICAL - Base Year Selection:**

The base year should be the LATEST evaluation year in your data (typically the diagonal year), NOT a future year.

\`\`\`python
# Example: If data is valued at 12/31/2008
base_year = 2008  # Use evaluation year

# WRONG - Do not use future years:
# base_year = 2009  # ← This inflates all severities by extra year!
\`\`\`

**STEP 6. Adjust and Select Main Severities**

Adjust ALL years (including projection years), select from ALL years.

\`\`\`python
# Trend to base_year (not base_year + 1!)
for i in range(n_origins):
    ay = 2001 + i
    years_to_trend = base_year - ay  # NOT (base_year + 1) - ay
    trend_factor = (1 + trend_rate) ** years_to_trend
    # ... apply adjustments
\`\`\`

**STEP 7. Calculate Tail Severities - AGGREGATE FROM RAW TRIANGLES**

**CRITICAL - DO NOT average from adjusted_severity triangle:**

WRONG:
\`\`\`python
tail_72 = np.mean(adjusted_severity[:, age_72_plus])  # ~30% too high
\`\`\`

RIGHT - Aggregate from raw paid/count triangles:
\`\`\`python
total_paid_72 = 0
total_count_72 = 0

for i in range(n_AYs):
    for j in range(n_ages):
        if age[j] >= 72:
            paid_incr = incremental_paid.values[0, 0, i, j]
            count_incr = incremental_closed.values[0, 0, i, j]
            
            if not np.isnan(paid_incr) and not np.isnan(count_incr):
                adjusted_paid = paid_incr * trend[i] * tort[i]
                total_paid_72 += adjusted_paid
                total_count_72 += count_incr

tail_72 = total_paid_72 / total_count_72
\`\`\`

**STEP 8. Combine Severities**

Length must match n_dev from disposal rates.

**STEP 9. Project Unadjusted Severity - USE HISTORICAL WHERE IT EXISTS**

**CRITICAL - Check for historical data FIRST:**

\`\`\`python
for i in range(n_AYs):
    for j in range(n_ages):
        # CHECK if historical data exists
        if j < original_severity.shape[1] and not np.isnan(original_severity[i, j]):
            # Use ACTUAL historical value (unadjusted)
            projected_unadj[i, j] = original_severity[i, j]
        else:
            # Calculate only for projection cells - reverse adjustments
            projected_unadj[i, j] = selected[j] / trend[i] / tort[i]
\`\`\`

**DO NOT** de-trend historical cells - they should remain at their original values!

**STEP 10. Sum to Ultimate**

\`Ultimate[AY] = Σ(Projected_Paid[AY, all_ages])\`

---

### Critical Pitfalls

1. **Wrong disposal rate denominator**:
   - Must divide by ULTIMATE reported count, not current reported triangle
   - Using current reported gives wrong disposal rates (too high)
   - Results in projected counts that are systematically off

2. **Disposal rates decreasing instead of increasing**:
   - Disposal rates are CUMULATIVE %, must always increase: [0.24, 0.58, 0.71...]
   - If decreasing [0.24, 0.36, 0.20...]: selecting from wrong source
   - Add verification after selection to catch this immediately
   - Causes final values to be 4-10x wrong

3. **Projecting all closed count cells**:
   - Must preserve ACTUAL historical closed count data where it exists
   - Only project future/missing cells with base calculation
   - Throwing away historical data compounds errors throughout

4. **Using wrong trend base year**:
   - Use the evaluation year (e.g., 2008 if data is at 12/31/2008)
   - Do NOT use future years (e.g., 2009)
   - Using base_year + 1 inflates all severities by extra 5%

5. **Missing n_periods in Development()**:
   - Specify n_periods parameter for stability (e.g., n_periods=4)
   - Without it, uses all available periods which may be unstable

6. **Not appending ultimate disposal rate**: Loses "To Ult" column

7. **Excluding projection years**: Causes ~25% error in selections

8. **Averaging adjusted severity for tails**: ~30% too high

9. **De-trending historical severity cells**: Produces wrong values - keep historical as-is

10. **Using np.zeros_like()**: Use np.copy()

11. **SKIPPING intermediate array**: Must create first

12. **Missing /1000 scale**

13. **Triangle construction**: Follow Triangle-First card

---

**When to use:** Reliable closed claim count history.

**When NOT to use:** Unreliable data.

`,
	sources: ["Friedland — Chapter 11, Frequency–Severity Techniques (Disposal Rate Method)."],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
