import { CapabilityCard } from "../card_registry"

export const ultimateFreqSev3Card: CapabilityCard = {
	id: "ultimate-freqsev-3",
	version: "1.0.0",
	title: "Ultimates: Frequency–Severity (Approach 3 – Disposal Rate Method)",
	triggers: [
		{
			kind: "keyword",
			any: [
				"frequency severity",
				"freq sev",
				"freq-sev",
				"frequency-severity",
				"freqsev",
				"frequency and severity",
				"disposal rate",
				"disposal rates",
				"closed claim count",
				"settlement rate",
			],
		},
		{ kind: "keyword", any: ["claim count", "closed with payment", "CWP"], all: ["frequency", "severity"] },
		{ kind: "regex", pattern: "\\b(freq(uency)?[\\s-]sev(erity)?)\\b", flags: "i" },
	],
	content: `**Capability Card: Frequency–Severity 3 (Disposal Rate Method) v1.0**

**Key Concept:**  
Projects **incremental closed claim counts** using disposal rates (% of ultimate claims closed by each age), then multiplies by **incremental paid severities** to get ultimates. Works with incremental values throughout projection, not ultimate frequency × severity.

**Core Formula:**  
\`Ultimate[AY] = Σ(Incremental_Count[age] × Unadjusted_Severity[AY, age])\`

---

### KEY DIFFERENCE from Frequency-Severity Method #2

**FS Method #2**: Adjusts ONLY historical years (excludes projection years from adjusted collection)  
**FS Method #3**: Adjusts ALL years including projection years

In FS#3:
- ALL accident years get adjusted in Step 5 (including projection/latest years)
- ALL accident years are used for severity selection in Step 6
- Do NOT exclude projection years from the selection pool

---

### Critical Steps

**1. Build Disposal Rate Triangle**

\`Disposal_Rate[AY, age] = Cumulative_Closed_Count[AY, age] / Ultimate_Reported_Count[AY]\`

- Develop reported count triangle to ultimate first (use specified method)
- Disposal rates are cumulative percentages (starting low, increasing to 1.00 at tail)

**2. Select Disposal Rates by Age**

Apply selection method to each age column (e.g., simple average of latest N periods, tail 1.00).

**CRITICAL**: Do NOT use chainladder's Development method on disposal rate triangles. Manually select by extracting array values and averaging.

**3. Project Incremental Closed Claim Counts**

**CRITICAL PROJECTION FORMULA** for ages beyond diagonal:

\`Base = (Ultimate_Reported - Latest_Closed) / (1 - Selected_DR[latest_age])\`  
\`Incremental[age] = Base × (Selected_DR[age] - Selected_DR[age-1])\`

**4. Calculate Incremental Paid Severity**

\`Incremental_Severity = Δ Cumulative_Paid / Δ Cumulative_Closed_Count\`

This is the **original unadjusted** severity triangle.

**5. Adjust Severities to Target Year - FOR ALL ACCIDENT YEARS**

\`\`\`python
# CRITICAL: Adjust ALL accident years, not just historical
adjusted_severity = np.copy(original_severity)

for i in range(n_accident_years):  # ALL years, including projection years
    ay = start_year + i
    trend_factor = (1 + trend) ** (target_year - ay)
    special_factor = get_special_factor(ay)
    
    for j in range(n_ages):
        if not np.isnan(original_severity[i, j]):
            adjusted_severity[i, j] = original_severity[i, j] * trend_factor * special_factor
\`\`\`

**WRONG - Excluding projection years**:
\`\`\`python
# DON'T do this in FS Method #3!
for i in range(n_accident_years):
    ay = start_year + i
    if ay <= 2006:  # WRONG! Don't exclude 2007-2008!
        adjusted_severity[i, j] = original_severity[i, j] * trend * factor
\`\`\`

**6. Select Main Age Severities FROM ADJUSTED TRIANGLE - USE ALL YEARS**

\`\`\`python
# CRITICAL: Use ALL accident years for selection, not just "historical"
selected_severities = []
for age_col in range(n_main_ages):
    age_values = []
    for ay_idx in range(n_accident_years):  # ALL years
        if not np.isnan(adjusted_severity[ay_idx, age_col]):
            age_values.append(adjusted_severity[ay_idx, age_col])
    
    # Latest N average from ALL years
    selected_severities.append(np.mean(age_values[-n:]))
\`\`\`

**WRONG - Filtering out projection years**:
\`\`\`python
# DON'T do this in FS Method #3!
for ay_idx in range(n_accident_years):
    ay = start_year + ay_idx
    if ay <= 2006:  # WRONG! Excludes 2007-2008 from selection
        age_values.append(adjusted_severity[ay_idx, age_col])

# Result: Selects from 2005-2006 instead of 2007-2008
# Produces wrong selected severities (e.g., 8757 instead of 11807)
\`\`\`

**Why FS#3 is different**: In FS#2, projection years don't have developed ultimates to adjust, so you only adjust historical. In FS#3, ALL years have incremental severity data from the triangle, so ALL get adjusted and ALL are used for selection.

**7. Calculate Tail Severities (ADJUSTED) - Aggregate Across Multiple Ages**

Aggregate across ALL AYs (including projection years).

**8. Combine Severities**

\`full_selected_severities = selected_main + [tail_72+, tail_84+, tail_84+, ...]\`

**ALL VALUES ARE ADJUSTED TO TARGET YEAR.**

**9. Project Unadjusted Incremental Paid**

**CRITICAL TWO-STEP PROCESS**: Create 2D unadjusted severity array with AY-specific de-trending, THEN multiply by counts.

**10. Sum to Ultimate**

\`Ultimate[AY] = Σ(Projected_Incremental_Paid[AY, all_ages])\`

---

### Critical Pitfalls

1. **Wrong disposal rate denominator**:
   - WRONG: Dividing by reported count triangle (varies by age)
   - RIGHT: Dividing by ultimate reported count (constant for each AY)

2. **Using np.zeros_like() in Step 5**:
   - WRONG: Creates 0.0 for missing data
   - RIGHT: Use np.copy() or np.full_like(..., np.nan)

3. **Excluding projection years from adjustment in Step 5**:
   - WRONG: Only adjusting "historical" years (e.g., 2001-2006)
   - RIGHT: Adjust ALL accident years including projection years (2001-2008)
   - FS#3 adjusts all years; FS#2 adjusts only historical

4. **Excluding projection years from selection in Step 6**:
   - WRONG: \`if ay <= 2006: age_values.append(...)\` excludes 2007-2008
   - RIGHT: Use ALL accident years for selection
   - If you exclude projection years, you'll select from wrong AYs (e.g., 2005-2006 instead of 2007-2008)
   - Results in severely wrong selected severities (~25% off)

5. **Calculating separate tail severity per age**:
   - WRONG: One value per tail age [72, 84, 96]
   - RIGHT: TWO aggregate buckets (ages >= 72, ages >= 84)

6. **SKIPPING intermediate 2D array in Step 9**:
   - WRONG: Direct multiplication
   - RIGHT: Create projected_unadjusted_severity first

7. **RE-SELECTING in Step 9**:
   - WRONG: Averaging original severity values
   - RIGHT: Divide full_selected_severities by adjustment factors

8. **Using ADJUSTED severities directly**:
   - WRONG: \`paid = count * full_selected_severities\`
   - RIGHT: Back out adjustments per AY first

9. **Missing /1000 scale factor**

10. **Triangle construction**: Follow Triangle-First card

---

**When to use:**  
Have reliable closed claim count history; claim closure patterns meaningful; want to model settlement behavior explicitly.

**When NOT to use:**  
Closed claim counts unreliable; insufficient closure history; erratic patterns.

`,
	sources: ["Friedland — Chapter 11, Frequency–Severity Techniques (Disposal Rate Method)."],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
