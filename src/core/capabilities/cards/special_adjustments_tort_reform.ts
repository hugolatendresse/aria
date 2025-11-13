import { CapabilityCard } from "../card_registry"

export const specialAdjustmentsTortReformCard: CapabilityCard = {
	id: "special-adjustments-tort-reform",
	version: "1.1.0",
	title: "Special Adjustments: Tort Reform & Claims Environment Changes",
	triggers: [
		{ kind: "keyword", any: ["tort reform", "tort", "reform", "special factor", "special adjustment"] },
		{ kind: "keyword", any: ["claims environment", "regulatory change", "law change"] },
		{ kind: "keyword", all: ["adjust", "severity"], any: ["reform", "change", "environment"] },
	],
	importance: 4,
	content: `**Capability Card: Special Adjustments (Tort Reform) v1.1**

**What it does:** Adjusts historical data to current basis when claims environment changes (tort reform, regulatory changes, coverage changes) have made past experience non-comparable to projection periods.

**When to use:** Structural changes affecting comparability: tort reform, regulatory changes, coverage changes, claims handling changes, benefit level changes.

### Step 0: Identify the Target Basis: The target basis is ALWAYS the projection year level, NOT the transition year.

**Problem Setup Example:**
"Tort reform effective 1/1/2004 reduced losses by 18% in AY 2004, and by 50% in AY 2005 onward. Project ultimate losses for AY 2009-2010."

**Mapping Exercise (DO THIS FIRST):**

1. **What years are you projecting?** 
   → 2009-2010

2. **What is the reform level for projection years?**
   → 50% reduction (they're in the "AY 2005 onward" category)

3. **This IS your TARGET BASIS.**
   → All historical severities must be adjusted to "50% reduction" level

4. **What was the reform level for each historical period?**
   - Years ≤2003: 0% reduction (pre-reform, "old basis")
   - Year 2004: 18% reduction (transition year)
   - Years 2005+: 50% reduction (full reform, "current basis")

5. **Calculate the gap to TARGET for each period:**
   - Years ≤2003: Need to bring DOWN by 50% → Factor = 0.50
   - Year 2004: Need to bring from 18% to 50% → Factor = 0.50/0.82 = 0.6098
   - Years 2005+: Already at target → Factor = 1.0

**Key Insight:** Projection years define the target. If they're at "50% reduction," that's what you're projecting to, NOT to the transition year's "18% reduction."

### Adjustment Direction

**Pattern 1: Change REDUCED expected losses** (*Example:* Tort reform in 2004 reduced expected losses by 50%)
- Post-reform (2005+): LOWER severity (current basis); Pre-reform (before 2004): HIGHER severity (old basis)
- Action: Multiply historical by \`(1 - reduction%)\` to bring DOWN; Factor: \`0.50 = 1 - 0.50\` (factor < 1.0)

\`\`\`python
def calculate_reform_factor(year, reform_year=2004, reduction_pct=0.50):
    if year < reform_year:
        return 1 - reduction_pct  # Factor < 1.0 to bring DOWN
    else:
        return 1.0  # Already at current level
\`\`\`

**Pattern 2: Change INCREASED expected losses** (*Example:* Benefit increase in 2004 raised expected losses by 22%)
- Post-change (2004+): HIGHER severity (current basis); Pre-change (before 2004): LOWER severity (old basis)
- Action: Multiply historical by \`(1 + increase%)\` to bring UP; Factor: \`1.22 = 1 + 0.22\` (factor > 1.0)

\`\`\`python
def calculate_benefit_factor(year, change_year=2004, increase_pct=0.22):
    if year < change_year:
        return 1 + increase_pct  # Factor > 1.0 to bring UP
    else:
        return 1.0  # Already at current level
\`\`\`

**Pattern 3: Transition Years with Partial Effect** (*Example:* 18% reduction in 2004, full 50% reduction by 2005)
- Logic: Bring transition year the REST OF THE WAY to full reform level
- Critical: Full reform level is determined by projection years, not by first year of change

\`\`\`python
def calculate_reform_factor_transition(year, reform_year=2005, transition_year=2004,
                                      full_reduction=0.50, transition_reduction=0.18):
    """
    full_reduction: The reduction level at projection years (target basis)
    transition_reduction: The reduction level at transition year
    """
    if year < transition_year:
        return 1 - full_reduction  # e.g., 0.50
    elif year == transition_year:
        transition_level = 1 - transition_reduction  # 0.82
        full_reform_level = 1 - full_reduction       # 0.50
        return full_reform_level / transition_level  # 0.50/0.82 = 0.6098
    else:
        return 1.0  # Already at full reform level
\`\`\`

### Decision Tree for Mapping the Problem

\`\`\`
Step 1: What years are you projecting?
   ↓
Step 2: What reform level applies to THOSE projection years?
   ↓
Step 3: THAT level is your TARGET BASIS
   ↓
Step 4: For each historical year, calculate:
   ├─ What reform level applies to this historical year?
   ├─ What's the gap between historical level and TARGET level?
   └─ Apply factor to close that gap

Direction Check:
├─ Reform REDUCED losses? → Historical TOO HIGH → Factor < 1.0
└─ Reform INCREASED losses? → Historical TOO LOW → Factor > 1.0
\`\`\`

**Critical workflow rules:**
1. Develop FIRST, adjust AFTER - never adjust raw triangles
2. Identify TARGET BASIS from projection years - not from transition year
3. Adjust HISTORICAL years only - projection years already at current basis
4. Store ONLY adjusted historical - exclude projection years from selection list
5. De-trend WITHOUT special factors - projection years already at reform level

### Verification Checklist

**Before coding:**
- [ ] Identified projection years
- [ ] Identified what reform level applies to projection years (this is TARGET)
- [ ] Mapped each historical year's reform level vs TARGET
- [ ] Determined factor direction (reduce or increase historical data?)

**After coding:**
- [ ] Reform reduced losses → adjusted historical < unadjusted (after trending)
- [ ] Reform increased losses → adjusted historical > unadjusted (after trending)
- [ ] Projection years get factor = 1.0
- [ ] Transition year factor between pre-reform and full reform factors

**Input/Output:** Input: Developed ultimate severities by AY, change characteristics (direction, magnitude, timing), projection years. Output: Adjusted historical severities on current basis; factors for each year.

**Version:** Tested with chainladder 0.8.x; applicable to any freq-sev or development method requiring basis adjustments.`,
	sources: ["Friedland — Chapter 11, Tort Reform Adjustments", "CAS Exam 5 Loss Reserving material"],
	safetyTags: ["actuarial", "IBNR", "severity-adjustment"],
}
