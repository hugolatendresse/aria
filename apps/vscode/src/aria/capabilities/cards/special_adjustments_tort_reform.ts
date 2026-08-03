import { CapabilityCard } from "../card_registry"

export const specialAdjustmentsTortReformCard: CapabilityCard = {
	id: "special-adjustments-tort-reform",
	version: "1.5.0",
	title: "Special Adjustments: Tort Reform & Claims Environment Changes",
	triggers: [{ kind: "keyword", any: ["tort reform"] }],
	content: `**Capability Card: Special Adjustments (Tort Reform) v1.5**

**What it does:** Adjusts historical data to current basis when claims environment changes (tort reform, regulatory changes, coverage changes) have made past experience non-comparable to projection periods.

**When to use:** Structural changes affecting comparability: tort reform, regulatory changes, coverage changes, claims handling changes, benefit level changes.

---

### CRITICAL: The Factor Inversion Trap

**THE #1 MISTAKE (made by 90% of implementations):**

Applying reduction factors to the years that EXPERIENCED the reduction, instead of to the years that DIDN'T.

**Statement:** "Severities reduced by 33% in 2007+, compared to earlier years"

**WRONG interpretation:**
- "Apply 33% reduction to 2007+" → multiply 2007+ by (1-0.33) = 0.67
- "Earlier years unchanged" → multiply earlier by 1.0
- **Result: Factors [1.0, 1.0, ..., 0.67, 0.67] ← BACKWARDS!**

**RIGHT interpretation:**
- "2007+ are ALREADY at reduced level" → multiply 2007+ by 1.0 (no change)
- "Earlier years are at higher level, need to come DOWN to match 2007+" → multiply earlier by 0.67
- **Result: Factors [0.67, 0.67, ..., 1.0, 1.0] ← CORRECT!**

**Why this is natural but wrong:** 
When you see "reduced by 33% in 2007", your brain wants to apply a 0.67 factor to 2007. But 2007 is DESCRIBING the already-reduced state (the target), not instructing you to reduce it further!

**The trap in action (real debugging example):**

Given: "10.7% reduction in 2006, 33% in 2007+"
\`\`\`python
# WRONG (what many AIs do):
if ay < 2006:
    tort_factor = 1.0  # Earlier unchanged
elif ay == 2006:
    tort_factor = 1.0 - 0.107  # Apply transition reduction
else:
    tort_factor = 1.0 - 0.33   # Apply full reduction
# Result: [1.0, 1.0, ..., 0.893, 0.67, 0.67]
# Effect: Makes pre-reform years HIGHER, post-reform LOWER
# Outcome: Pre-reform AYs overestimated, post-reform underestimated!
\`\`\`

This produces the OPPOSITE effect - it makes the problem worse instead of fixing it!

---

### Foolproof Parsing Recipe

Given: "Reduced by A% in year T, by B% in year F+, compared to earlier"

**Step 1: Write down what level each year group is AT (their current state):**

\`\`\`
Earlier years (before T): 100% (baseline)
Transition year T: (100 - A)% (partially reduced)
Full reform (F+): (100 - B)% (fully reduced)
\`\`\`

**Step 2: Identify target level (what you're trending/adjusting TO):**

Usually the latest projection year's level. If projecting 2007-2008 and reform is "33% in 2007+":
\`\`\`
Target level = (100 - B)% = 67%
\`\`\`

**Step 3: For EACH accident year, calculate adjustment = target / current:**

\`\`\`python
def get_tort_reform_factor(ay, base_year):
    # STEP 1: Define levels (what each year IS at)
    earlier_level = 1.00  # Pre-reform baseline
    transition_level = 1.00 - A  # Partial reduction
    full_reform_level = 1.00 - B  # Full reduction
    
    # STEP 2: Define target (what we're adjusting TO)
    # Usually: the level of the latest projection years
    if base_year >= F:
        target_level = full_reform_level
    elif base_year == T:
        target_level = transition_level
    else:
        target_level = earlier_level
    
    # STEP 3: Calculate factor = target / current
    if ay >= F:  # This AY is at full reform level
        current_level = full_reform_level
    elif ay == T:  # This AY is at transition level
        current_level = transition_level
    else:  # This AY is at pre-reform level
        current_level = earlier_level
    
    return target_level / current_level
\`\`\`

**Concrete example:** "Reduced by 10.7% in 2006, by 33% in 2007+, compared to earlier"

Base year = 2008 (latest evaluation year, which is post-reform):

\`\`\`python
def get_tort_reform_factor(ay, base_year=2008):
    # STEP 1: Levels (current state of each year group)
    earlier_level = 1.00      # 2005 and before
    transition_level = 0.893  # 2006 (100% - 10.7% = 89.3%)
    full_reform_level = 0.67  # 2007+ (100% - 33% = 67%)
    
    # STEP 2: Target (2008 is post-reform, so target = 67%)
    target_level = full_reform_level  # 0.67
    
    # STEP 3: Calculate adjustment for each AY
    if ay >= 2007:  # Post-reform years
        current_level = full_reform_level  # 0.67
        return target_level / current_level  # 0.67/0.67 = 1.0
    elif ay == 2006:  # Transition year
        current_level = transition_level  # 0.893
        return target_level / current_level  # 0.67/0.893 = 0.75
    else:  # Pre-reform years (2005 and earlier)
        current_level = earlier_level  # 1.00
        return target_level / current_level  # 0.67/1.00 = 0.67
\`\`\`

**Result (CORRECT):**
- AY 2001-2005: 0.67 (brings from 100% down to 67%)
- AY 2006: 0.75 (brings from 89.3% down to 67%)  
- AY 2007-2008: 1.0 (already at 67%, no adjustment needed)

**Alternative calculation for transition year:**
\`\`\`python
# Can also express as ratio of reductions:
transition_factor = (1 - 0.33) / (1 - 0.107)  # = 0.67 / 0.893 = 0.75
\`\`\`

---

### Verification - MANDATORY

After writing your function, verify with these tests:

\`\`\`python
# Test your function
factors = {ay: get_tort_reform_factor(ay) for ay in [2001, 2005, 2006, 2007, 2008]}
print(f"Tort reform factors: {factors}")

# Expected for "33% reduction in 2007+, 10.7% in 2006, base_year=2008":
# {2001: 0.67, 2005: 0.67, 2006: 0.75, 2007: 1.0, 2008: 1.0}

# Verify pattern - CRITICAL CHECKS:
assert factors[2001] < 1.0, "Pre-reform years should be REDUCED (< 1.0)"
assert factors[2007] == 1.0, "Post-reform projection years should be 1.0"
assert factors[2001] < factors[2006] < factors[2007], "Factors should INCREASE over time"

print("✓ SUCCESS: Tort reform factors are correct!")
print(f"  Pre-reform reduced by {(1-factors[2001])*100:.1f}%")
print(f"  Transition reduced by {(1-factors[2006])*100:.1f}%")
print(f"  Post-reform unchanged (1.0)")
\`\`\`

**If your factors look like this (WRONG):**
\`\`\`
{2001: 1.0, 2005: 1.0, 2006: 0.893, 2007: 0.67, 2008: 0.67}
    ↑ Should be < 1.0              ↑ Should be 1.0
\`\`\`

**YOU HAVE INVERTED FACTORS.** The pattern is exactly backwards:
- Pre-reform years are 1.0 (unchanged) - WRONG, should be reduced!
- Post-reform years are < 1.0 (reduced) - WRONG, should be 1.0!
- This makes the problem WORSE instead of fixing it

**Fix:** Swap your if/else logic - apply reduction to earlier years, not reform years.

---

### Pattern Recognition

**Factors should INCREASE over accident years:**
\`\`\`
[0.67, 0.67, 0.67, 0.67, 0.67, 0.75, 1.0, 1.0]  ✓ CORRECT
 ↑ Earlier AYs reduced            ↑ Later AYs unchanged

[1.0, 1.0, 1.0, 1.0, 1.0, 0.893, 0.67, 0.67]  ✗ INVERTED!
 ↑ Earlier AYs unchanged            ↑ Later AYs reduced (WRONG!)
\`\`\`

**Mnemonic:** "Old data comes DOWN to new level" = old years get factors < 1.0

---

### Common Mistakes & Fixes

**MISTAKE 1: Inverted factors - THE MOST COMMON ERROR**

**WRONG REASONING:** "Statement says 'reduced by 33% in 2007+' so I apply 0.67 to 2007+"

**RIGHT REASONING:** "2007+ are 33% LOWER than earlier. To make comparable, earlier must come DOWN. Apply 0.67 to earlier."

**Red flag:** If your oldest AY has factor=1.0 and newest has factor<1.0, YOU'VE INVERTED IT.

**MISTAKE 2: Dividing instead of multiplying for pre-reform years**

\`\`\`python
# WRONG - creates factors > 1.0:
tort_factor = 1.0 / (1.0 - 0.33)  # = 1.493 (increases instead of decreases!)

# RIGHT - creates factors < 1.0:
tort_factor = 1.0 - 0.33  # = 0.67 (decreases as intended)
\`\`\`

If you're getting factors > 1.0 for pre-reform years, you're dividing when you should multiply.

**MISTAKE 3: Not recognizing "compared to earlier" phrasing**

"Compared to earlier" explicitly tells you earlier years are the 100% baseline that needs adjustment.

**MISTAKE 4: Confusing severity adjustments with frequency adjustments**

Tort reform typically affects SEVERITY (claim size), not frequency (claim count). Apply to severity data only.

---

### Integration with Trend

When using both trend and tort reform:

\`\`\`python
for i in range(n_AYs):
    ay = 2001 + i
    
    # Trend factor
    years_to_trend = base_year - ay
    trend_factor = (1 + trend_rate) ** years_to_trend
    
    # Tort reform factor (using function above)
    tort_factor = get_tort_reform_factor(ay, base_year)
    
    # Apply BOTH adjustments
    for j in range(n_ages):
        if not np.isnan(severity[i, j]):
            adjusted_severity[i, j] = severity[i, j] * trend_factor * tort_factor
\`\`\`

Both factors multiply the original data - they compound.

---

### Exposure-Based Methods (BF / Stanard-Buhlmann)

**CRITICAL:** With exposure-based methods, adjust the TRIANGLE (not premium) by tort factors. Premium represents current exposure and must stay at full current-level. Adjusting premium down produces systematically low ultimates. Implementation: (1) Adjust triangle: \`X_adj = X * tort_tri\`; (2) Fit with unadjusted premium: \`pipe.fit(X_adj, sample_weight=premium)\`; (3) Adjust results back: \`ult = model.ultimate_ / tort_tri.latest_diagonal\`.

---

**Version:** v1.5 - Added exposure-based methods guidance.`,
	sources: ["Friedland — Chapter 11, Tort Reform Adjustments", "CAS Exam 5 Loss Reserving material"],
	safetyTags: ["actuarial", "IBNR", "severity-adjustment"],
}
