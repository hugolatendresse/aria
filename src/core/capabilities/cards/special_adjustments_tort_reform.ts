import { CapabilityCard } from "../card_registry"

export const specialAdjustmentsTortReformCard: CapabilityCard = {
	id: "special-adjustments-tort-reform",
	version: "1.2.0",
	title: "Special Adjustments: Tort Reform & Claims Environment Changes",
	triggers: [
		{ kind: "keyword", any: ["tort reform", "tort", "reform", "special factor", "special adjustment"] },
		{ kind: "keyword", any: ["claims environment", "regulatory change", "law change"] },
		{ kind: "keyword", all: ["adjust", "severity"], any: ["reform", "change", "environment"] },
	],
	importance: 4,
	content: `**Capability Card: Special Adjustments (Tort Reform) v1.2**

**What it does:** Adjusts historical data to current basis when claims environment changes (tort reform, regulatory changes, coverage changes) have made past experience non-comparable to projection periods.

**When to use:** Structural changes affecting comparability: tort reform, regulatory changes, coverage changes, claims handling changes, benefit level changes.

---

### PARSING "Reduced by X% compared to earlier years" Statements

**Common phrasing:** "Tort reform effective 1/1/YEAR reduced expected losses by A% in AY YEAR, and by B% in AY YEAR+1 and later, compared to EARLIER years."

**CRITICAL PARSING RULES:**

1. **"compared to earlier years"** = earlier years are the BASELINE (100% level)

2. **Years mentioned in the statement are ALREADY at the reduced level** (not the years to reduce)

3. **The percentages tell you how much EARLIER years exceeded these levels**

**Example statement:** 
"Tort reform effective 1/1/2006 reduced expected losses by 10% in AY 2006, and by 35% in AY 2007 and later, compared to 2005 and earlier years."

**STEP-BY-STEP PARSING:**

**Step 1: Map each year group to its loss level:**
- "compared to 2005 and earlier years" → 2005 and earlier are at 100% (baseline)
- "reduced by 10% in AY 2006" → 2006 is at 90% (= 100% - 10%)
- "reduced by 35% in AY 2007 and later" → 2007+ is at 65% (= 100% - 35%)

| Year Group | Loss Level | Calculation |
|------------|------------|-------------|
| ≤ 2005 | 100% | Baseline (pre-reform) |
| 2006 | 90% | 100% - 10% |
| ≥ 2007 | 65% | 100% - 35% |

**Step 2: Identify target (projection years define target):**
- If projecting 2007-2008 → Target = 65% level
- If projecting 2006 → Target = 90% level  
- If projecting 2009+ → Target = 65% level (same as 2007+)

**Step 3: Calculate factors to bring each year TO target:**

Assume projecting 2007-2008 (target = 65%):

| Year | Current Level | Target | Factor | Calculation |
|------|---------------|--------|--------|-------------|
| ≤ 2005 | 100% | 65% | 0.65 | 0.65 / 1.00 |
| 2006 | 90% | 65% | 0.722 | 0.65 / 0.90 |
| ≥ 2007 | 65% | 65% | 1.0 | 0.65 / 0.65 |

**CODE:**
\`\`\`python
def get_tort_reform_factor(ay, target_year=2008):
    # From parsing: 2005- at 100%, 2006 at 90%, 2007+ at 65%
    # Target (projection years 2007-2008): 65% level
    
    if ay >= 2007:
        # Already at 65% level (target)
        return 1.0
    elif ay == 2006:
        # At 90% level, bring to 65% level
        return 0.65 / 0.90  # 0.722
    else:  # ay <= 2005
        # At 100% level, bring to 65% level
        return 0.65  # = 1 - 0.35
\`\`\`

**WRONG interpretation of same statement:**
\`\`\`python
# WRONG - Applying reduction to reformed years!
if ay >= 2007:
    return 1 - 0.35  # 0.65 - WRONG! These years already AT 65%!
elif ay == 2006:
    return 1 - 0.10  # 0.90 - WRONG! This year already AT 90%!
else:
    return 1.0  # WRONG! Old years stay at 100%!
\`\`\`

**The error:** Subtracting the reduction from the years that EXPERIENCED the reduction, leaving pre-reform years unchanged.

---

### Generic Parsing Algorithm

Given: "Reduced by A% in year Y, by B% in year Z+, compared to earlier"

\`\`\`python
# Step 1: Map to loss levels
levels = {}
levels['earlier'] = 1.00  # Baseline
levels['year_Y'] = 1.00 - A  # e.g., 1.00 - 0.10 = 0.90
levels['year_Z_plus'] = 1.00 - B  # e.g., 1.00 - 0.35 = 0.65

# Step 2: Identify target from projection years
if projecting_year_in_Z_plus:
    target_level = levels['year_Z_plus']
elif projecting_year_Y:
    target_level = levels['year_Y']
else:
    target_level = levels['earlier']

# Step 3: Calculate factors
def get_factor(ay):
    if ay >= Z:
        current_level = levels['year_Z_plus']
    elif ay == Y:
        current_level = levels['year_Y']
    else:
        current_level = levels['earlier']
    
    return target_level / current_level
\`\`\`

**Result**: Old years get factors < 1.0 (reduced), reformed years get 1.0 (unchanged).

---

### Common Mistakes & Verification

**MISTAKE 1: Inverted factors - THE MOST COMMON ERROR**

WRONG REASONING:
"Statement says 'reduced by 35% in 2007+' so apply 0.65 factor to 2007+ years"

RIGHT REASONING:
"Statement says 2007+ are 35% LOWER than earlier years. Earlier years are 35% TOO HIGH for target basis. Apply 0.65 to earlier years."

**Mnemonic**: When you read "reduced by X% in year Y", think:
- Year Y is already AT the reduced level (it's a description, not an instruction)
- Years BEFORE Y are NOT reduced yet (they need the factor)
- Apply (1-X) to bring old years down to match year Y

**MISTAKE 2: Not recognizing "compared to earlier" phrasing**

Statement: "Reduced by 30% in 2005+, compared to 2004 and earlier"

This means:
- 2004 and earlier: 100% (explicitly stated as comparison baseline)
- 2005+: 70% (reduced FROM the 100% baseline)

Factors to bring to 70% target:
- 2004 and earlier: 0.70 (bring from 100% to 70%)
- 2005+: 1.0 (already at 70%)

---

### Verification Tests

**MANDATORY checks after writing tort reform code:**

1. **Parse check - Write out the levels:**
   - [ ] Pre-reform years: at ___% level
   - [ ] Transition year: at ___% level
   - [ ] Full reform years: at ___% level
   - [ ] Projection years: at ___% level (THIS IS TARGET)

2. **Factor direction check**:
   - [ ] If reform REDUCED: factors for old years < 1.0 (reducing them)
   - [ ] If reform REDUCED: factors for projection years = 1.0 (already reduced)
   - [ ] Old year factor = target_level / old_level (e.g., 0.65/1.00 = 0.65)
   - [ ] Projection year factor = target_level / projection_level (e.g., 0.65/0.65 = 1.0)

3. **Results check** (after adjusting):
   - [ ] If reform REDUCED: adjusted_old_years < original_old_years (after trending)
   - [ ] Projection years should NOT be in the adjusted collection for selection

4. **Sanity check - Values make sense:**
   - [ ] Projection year factors = 1.0
   - [ ] Pre-reform factors < 1.0 (for reductions) or > 1.0 (for increases)
   - [ ] Transition year factor is between pre-reform and post-reform factors

**If checks fail**: You likely have inverted factors. Remember: reduction percentage applies to OLD years, not to the years mentioned in the reduction statement.

---

**Input/Output:** Input: Developed ultimate severities by AY, change characteristics (direction, magnitude, timing), projection years. Output: Adjusted historical severities on current basis; factors for each year.

**Version:** Tested with chainladder 0.8.x; applicable to any freq-sev or development method requiring basis adjustments.`,
	sources: ["Friedland — Chapter 11, Tort Reform Adjustments", "CAS Exam 5 Loss Reserving material"],
	safetyTags: ["actuarial", "IBNR", "severity-adjustment"],
}
