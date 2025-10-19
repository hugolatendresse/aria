import { CapabilityCard } from "../card_registry"

export const specialAdjustmentsTortReformCard: CapabilityCard = {
	id: "special-adjustments-tort-reform",
	version: "1.0.0",
	title: "Special Adjustments: Tort Reform & Claims Environment Changes",
	triggers: [
		{ kind: "keyword", any: ["tort reform", "tort", "reform", "special factor", "special adjustment"] },
		{ kind: "keyword", any: ["claims environment", "regulatory change", "law change"] },
		{ kind: "keyword", all: ["adjust", "severity"], any: ["reform", "change", "environment"] },
	],
	importance: 4,
	content: `**Capability Card: Special Adjustments (Tort Reform) v1.0**

**What it does:** Adjusts historical data to current basis when claims environment changes (tort reform, regulatory changes, coverage changes) have made past experience non-comparable to projection periods.

**When to use:** Structural changes affecting comparability: tort reform, regulatory changes, coverage changes, claims handling changes, benefit level changes.

### Core Concept: Bringing Historical Data to "Current Basis"

**Key Insight:** Projection years are ALREADY at current basis. Only historical years need adjustment.

**Timeline:**
\`\`\`
Historical Years        Change Event         Projection Years
  (old basis)            (e.g., 2007)         (current basis)
 1998...2006          Tort Reform 2007          2007-2008
      ↓                       |                      ↓
Need adjustment to            |            Already at target level
  match 2007+ level           |            No adjustment needed
\`\`\`

### Adjustment Direction (Critical Decision)

**Pattern 1: Change REDUCED expected losses** (*Example:* Tort reform in 2007 reduced expected losses by 33%)
- Post-reform (2007+): LOWER severity (current basis); Pre-reform (before 2007): HIGHER severity (old basis)
- Action: Multiply historical by \`(1 - reduction%)\` to bring DOWN; Factor: \`0.67 = 1 - 0.33\` (factor < 1.0)

\`\`\`python
def calculate_reform_factor(year, reform_year=2007, reduction_pct=0.33):
    if year < reform_year:
        return 1 - reduction_pct  # Factor < 1.0 to bring DOWN
    else:
        return 1.0  # Already at current level
\`\`\`

**Pattern 2: Change INCREASED expected losses** (*Example:* Benefit increase in 2007 raised expected losses by 25%)
- Post-change (2007+): HIGHER severity (current basis); Pre-change (before 2007): LOWER severity (old basis)
- Action: Multiply historical by \`(1 + increase%)\` to bring UP; Factor: \`1.25 = 1 + 0.25\` (factor > 1.0)

\`\`\`python
def calculate_benefit_factor(year, change_year=2007, increase_pct=0.25):
    if year < change_year:
        return 1 + increase_pct  # Factor > 1.0 to bring UP
    else:
        return 1.0  # Already at current level
\`\`\`

**Pattern 3: Transition Years with Partial Effect** (*Example:* 10.7% reduction in 2006, full 33% reduction by 2007)
- Logic: Bring transition year the REST OF THE WAY to full reform level

\`\`\`python
def calculate_reform_factor_transition(year, reform_year=2007, transition_year=2006,
                                      full_reduction=0.33, transition_reduction=0.107):
    if year < transition_year:
        return 1 - full_reduction  # e.g., 0.67
    elif year == transition_year:
        transition_level = 1 - transition_reduction  # 0.893
        full_reform_level = 1 - full_reduction       # 0.67
        return full_reform_level / transition_level  # 0.67/0.893 = 0.7503
    else:
        return 1.0  # Already at full reform level
\`\`\`

### Canonical Implementation (Frequency-Severity Methods)

\`\`\`python
import chainladder as cl
import numpy as np

all_accident_years = [1998, 1999, ..., 2008]
projection_years = [2007, 2008]
target_year = 2008
sev_trend = 0.05

# Step 1: Develop severities to ultimate (NO adjustments)
severity_tri = reported_claims_tri / reported_count_tri
severity_pipe = cl.Pipeline([
    ('dev', cl.Development(average='simple', n_periods=2)),
    ('tail', cl.TailConstant(tail=1.05)),
    ('model', cl.Chainladder())
])
severity_pipe.fit(severity_tri)
sev_ult_by_ay = severity_pipe.named_steps.model.ultimate_.values[0, 0, :, -1]

# Step 2: Adjust HISTORICAL severities only
def calculate_special_factor(year):
    if year <= 2005:
        return 0.67  # Bring DOWN by 33%
    elif year == 2006:
        return 0.67 / 0.893  # Bring from transition to full reform
    else:
        return 1.0  # Already at post-reform level

adjusted_historical_sevs = []
for i, year in enumerate(all_accident_years):
    if year < projection_years[0]:  # Historical years only
        trend_factor = (1 + sev_trend) ** (target_year - year)
        special_factor = calculate_special_factor(year)
        adjusted_historical_sevs.append(sev_ult_by_ay[i] * trend_factor * special_factor)

# Step 3: Select from adjusted historical severities
latest_5_hist = adjusted_historical_sevs[-5:]
selected_sev = np.mean(sorted(latest_5_hist)[1:4])  # Middle 3 of 5

# Step 4: De-trend to projection years (NO special factors)
for year in projection_years:
    ay_severity = selected_sev / ((1 + sev_trend) ** (target_year - year))
\`\`\`

**Critical workflow rules:**
1. Develop FIRST, adjust AFTER - never adjust raw triangles
2. Adjust HISTORICAL years only - projection years already at current basis
3. Store ONLY adjusted historical - exclude projection years from selection list
4. De-trend WITHOUT special factors - projection years already at reform level

### Decision Tree
\`\`\`
Did the change REDUCE expected severity?
├─ YES (tort reform, coverage reduction) → Historical TOO HIGH → Factor < 1.0 → Multiply by (1 - reduction%)
└─ NO (benefit increase, expanded coverage) → Historical TOO LOW → Factor > 1.0 → Multiply by (1 + increase%)
\`\`\`

### Verification Checklist
Verify factor direction: (1) Reform reduced losses → adjusted historical < unadjusted; (2) Reform increased losses → adjusted historical > unadjusted; (3) Projection years get factor = 1.0

Example: Reform reduced losses by 33%; 2005 unadjusted $38,447; Trend factor 1.1576, Special factor 0.67; Adjusted: 38,447 × 1.1576 × 0.67 = $29,820 (lower than trended unadjusted $44,509, consistent with reform)

### Common Mistakes

**WRONG: Factor in opposite direction**
\`\`\`python
return 1.0 / (1.0 - 0.33)  # = 1.49 - Increases instead of decreases
\`\`\`

**WRONG: Adjusting projection years**
\`\`\`python
for year in all_accident_years:  # Includes projection years
    adjusted_sevs.append(sev * special_factor)
\`\`\`

**WRONG: Applying special factors when de-trending**
\`\`\`python
ay_severity = selected_sev / trend_factor * 0.67  # Already adjusted
\`\`\`

**WRONG: Selecting from wrong array**
\`\`\`python
latest_5 = adjusted_sevs[-5:]  # WRONG if includes projection years
\`\`\`

### Related Cards
Frequency-Severity Method #2 (primary use case); Frequency-Severity Method #1 (may use when trending losses); Trend Selection (interaction with trend factors)

**Input/Output:** Input: Developed ultimate severities by AY, change characteristics (direction, magnitude, timing). Output: Adjusted historical severities on current basis; factors for each year.

**When NOT to use:** Stable claims environment with no structural changes affecting comparability.

**Version:** Tested with chainladder 0.8.x; applicable to any freq-sev or development method requiring basis adjustments.`,
	sources: ["Friedland — Chapter 11, Tort Reform Adjustments", "CAS Exam 5 Loss Reserving material"],
	safetyTags: ["actuarial", "IBNR", "severity-adjustment"],
}
