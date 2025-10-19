import { CapabilityCard } from "../card_registry"

export const ultimateFreqSev3Card: CapabilityCard = {
	id: "ultimate-freqsev-3",
	version: "1.0.0",
	title: "Ultimates: Frequency–Severity (Approach 3 – Disposal Rate Method)",
	triggers: [
		{
			kind: "keyword",
			any: ["disposal rate", "disposal rates", "closed claim count", "settlement rate"],
		},
		{ kind: "keyword", any: ["frequency severity", "freq sev"], all: ["disposal"] },
		{ kind: "regex", pattern: "\\b(disposal[\\s-]rate)\\b", flags: "i" },
	],
	importance: 5,
	content: `**Capability Card: Frequency–Severity 3 (Disposal Rate Method) v1.0**

**Key Concept:**  
Projects **incremental closed claim counts** using disposal rates (% of ultimate claims closed by each age), then multiplies by **incremental paid severities** to get ultimates. Works with incremental values throughout projection, not ultimate frequency × severity.

**Core Formula:**  
\`Ultimate[AY] = Σ(Incremental_Count[age] × Unadjusted_Severity[AY, age])\`

---

### Critical Steps

**1. Build Disposal Rate Triangle**

\`Disposal_Rate[AY, age] = Cumulative_Closed_Count[AY, age] / Ultimate_Reported_Count[AY]\`

- Develop reported count triangle to ultimate first (use specified method)
- Disposal rates are cumulative percentages (e.g., 0.24 at 12mo, 0.58 at 24mo, → 1.00 at tail)

**2. Select Disposal Rates by Age**

Apply selection method to each age column (e.g., simple average of latest N periods, tail 1.00).

**3. Project Incremental Closed Claim Counts**

**CRITICAL PROJECTION FORMULA** for ages beyond diagonal:

\`Base = (Ultimate_Reported - Latest_Closed) / (1 - Selected_DR[latest_age])\`  
\`Incremental[age] = Base × (Selected_DR[age] - Selected_DR[age-1])\`

For historical: use actual observed incremental counts.

**Why:** Unclosed claims will close according to selected disposal pattern. Base represents total remaining closures; distribute using disposal rate differences.

**4. Calculate Incremental Paid Severity**

Convert paid and closed triangles to incremental, then:

\`Incremental_Severity = Δ Cumulative_Paid / Δ Cumulative_Closed_Count\`

**5. Adjust Severities to Target Year**

\`Adjusted_Sev = Incremental_Sev × (1 + trend)^(target_year - ay) × tort_reform_factor\`

Tort reform factor direction:
- If reform **reduced** losses by X% in later years → multiply earlier years by (1 - X)
- Partial reform year: multiply by ratio (e.g., (1-0.33)/(1-0.107) for transitional year)

**6-8. Select and Extend Severities**

- Select adjusted severities for main ages (e.g., latest 2 simple average)
- Calculate tail severities: \`Σ(Adjusted_Paid[age≥tail]) / Σ(Closed_Count[age≥tail])\`
- Extend selected severity array through tail ages

**9. Project Unadjusted Incremental Paid**

For projection cells:
- Back out adjustments from selected severity: \`/ ((1+trend)^years) / tort_reform_factor\`
- Multiply by projected count: \`Unadjusted_Sev × Incremental_Count / 1000\` (if in thousands)

For historical: use actual incremental paid values.

**10. Sum to Ultimate**

\`Ultimate[AY] = Σ(Projected_Incremental_Paid[AY, all_ages])\`

---

### Critical Pitfalls

1. **Wrong disposal rate denominator**:
   - WRONG: Dividing by reported count triangle (varies by age)
   - RIGHT: Dividing by ultimate reported count (constant for each AY)

2. **Wrong projection formula**:
   - WRONG: \`Incremental = Disposal_Rate_Diff × (Ultimate - Latest)\`
   - RIGHT: \`Incremental = (Ultimate - Latest) / (1 - DR[latest_age]) × DR_Diff\`
   - The division by (1 - DR[latest_age]) is essential

3. **Using wrong age for base calculation**:
   - Must use disposal rate at the **latest observed age** for that AY
   - Each AY may have different latest observed age (diagonal varies)

4. **Tort reform adjustment direction**:
   - To adjust TO reformed level: multiply by (1 - reduction%)
   - To adjust FROM reformed level: divide by (1 - reduction%)
   - Adjust in Step 5 (TO target), back out in Step 9 (FROM target)

5. **Mixing cumulative and incremental**:
   - Disposal rates: cumulative percentages
   - Projected counts: incremental values
   - Severities: per incremental period
   - Final amounts: sum of incremental products

6. **Triangle construction**: Follow Triangle-First card (use original integer year column as origin)

---

**When to use:**  
Have reliable closed claim count history; claim closure patterns are meaningful; want to explicitly model settlement behavior; combining frequency and severity at granular (incremental) level.

**When NOT to use:**  
Closed claim counts unreliable; insufficient closure history; claim settlement patterns erratic.

`,
	sources: ["Friedland — Chapter 11, Frequency–Severity Techniques (Disposal Rate Method)."],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
