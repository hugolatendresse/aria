import { CapabilityCard } from "../card_registry"

export const purePremiumIndicationCard: CapabilityCard = {
	id: "ratemaking-pure-premium-indication",
	version: "1.0.0",
	title: "Ratemaking: Pure Premium Indication Method",
	triggers: [
		{
			kind: "keyword",
			any: ["pure premium method", "loss cost method", "pure premium indication"],
		},
		{
			kind: "regex",
			pattern: "\\b(pure[\\s-]?premium[\\s-]?(method|indication)|loss[\\s-]?cost[\\s-]?method)\\b",
			flags: "i",
		},
	],
	content: `**Pure Premium Indication Method v1.0**

**Core Formula:**
\`\`\`
Indicated Rate = (Loss Costs + Other Costs) / VPLR

where:
  VPLR = 1 - Variable Expense - UW Profit
  (VPLR contains ONLY variable expenses and profit, NOT fixed expenses)

CRITICAL: The division by VPLR is MANDATORY - it "loads" the rate for variable expenses and profit.
Without this division, your rate will be too low by approximately 1/VPLR 
\`\`\`

**Implementation:**
\`\`\`python
# Step 1: Calculate trended ultimate losses with ULAE
# CRITICAL: Apply ULAE to NON-CAT losses ONLY, BEFORE credibility weighting
trended_ultimate_non_cat = (ultimate_losses_by_ay * trend_factors).sum()
trended_ultimate_with_ulae = trended_ultimate_non_cat * ulae_factor

# CRITICAL: Use ACTUAL HISTORICAL exposures (DO NOT trend or project exposures)
# Sum the earned exposures from the experience period 
total_exposures = historical_earned_exposures.sum() 

# Divide trended losses by actual historical exposures
selected_pp = trended_ultimate_with_ulae / total_exposures

# Step 2: Apply credibility weighting
# CRITICAL: Credibility is applied AFTER ULAE but BEFORE adding CAT/reins/fixed
credibility_weighted_pp = z * selected_pp + (1 - z) * regional_pp

# Step 3: Add other cost components
# CRITICAL: CAT, reinsurance, and fixed expenses are NOT multiplied by ULAE
# CAT losses already include their own ALAE, reinsurance and fixed are not losses
total_costs_per_exp = credibility_weighted_pp + cat_pp + reinsurance + fixed_expense_per_exp

# Step 4: Calculate VPLR and final indicated rate
# CRITICAL: You MUST divide by VPLR - this is NOT optional
# VPLR "loads" the rate for variable expenses and profit
vplr = 1 - variable_expense - profit  # NO fixed expenses here
indicated_rate = total_costs_per_exp / vplr
\`\`\`

**Why this matters:** 
- The sum of costs represents what you need to cover losses and fixed expenses
- Dividing by VPLR "loads" this to account for variable expenses (commissions, premium taxes) and profit
**CRITICAL: What ULAE Does and Does NOT Apply To:**

**ULAE APPLIES TO:**
- Non-CAT ultimate losses only
- Applied AFTER trending, BEFORE credibility

**ULAE DOES NOT APPLY TO:**
- CAT losses (CAT pure premium already includes CAT ALAE)
- Reinsurance costs (not a loss)
- Fixed expenses (not a loss)
- The final total of all components

**Common ULAE Error:**
\`\`\`python
# WRONG - Applying ULAE to everything
total_before_ulae = non_cat_pp + cat_pp + reinsurance + fixed_expense
total_with_ulae = total_before_ulae * ulae_factor  # NO! ULAE only for non-CAT losses

# CORRECT - Apply ULAE only to non-CAT losses
non_cat_with_ulae = (trended_losses.sum() / exposures) * ulae_factor
total = non_cat_with_ulae + cat_pp + reinsurance + fixed_expense  # Then add others
\`\`\`

**vs Loss Ratio Method:**
- Loss Ratio: works with ratios (losses/premium) → outputs rate change (%)
- Pure Premium: works with costs (losses/exposure) → outputs rate ($/exposure)

**Critical Rules:**

**Order of Operations:**
1. Trend non-CAT ultimate losses by accident year → sum them
2. Apply ULAE factor to summed trended non-CAT losses (NOT to CAT/reins/fixed)
3. Divide by ACTUAL HISTORICAL exposures (DO NOT trend exposures)
4. Apply credibility weighting to non-CAT pure premium
5. Add CAT PP + reinsurance + fixed expense (these do NOT get ULAE)
6. Divide by VPLR → final indicated rate

**Variable vs Fixed Expenses:**
- **Variable** (commissions, premium taxes): scale with premium → go in VPLR (denominator)
- **Fixed** (overhead, salaries): do NOT scale → go in numerator as cost per exposure
- **CAT, Reinsurance**: specific costs → go in numerator as cost per exposure

**Common Errors:**
\`\`\`python
# WRONG - trending or projecting exposures
total_exposures = historical_exposures.sum() / 5  # NO! Don't divide by years
total_exposures = historical_exposures * trend_factor  # NO! Don't trend exposures

# WRONG - applying ULAE to everything
total = (non_cat + cat_pp + reinsurance + fixed) * ulae_factor  # NO!

# WRONG - fixed expenses in VPLR
vplr = 1 - variable_expense - profit - fixed_expense  # NO!

# CORRECT - Sum costs, then divide by VPLR
total_costs = credibility_weighted_pp + cat_pp + reinsurance + fixed_expense
vplr = 1 - variable_expense - profit
rate = total_costs / vplr  # MUST divide by VPLR
\`\`\`

**Verification Checklist:**
- [ ] FINAL STEP: Divided total costs by VPLR (THIS IS MANDATORY)
- [ ] Formula used: (all_costs_per_exp) / VPLR, not just sum of costs
- [ ] Exposures: Use ACTUAL HISTORICAL sum (DO NOT trend, project, or average)
- [ ] Exposures: Simply sum earned exposures from experience period
- [ ] ULAE applied ONLY to non-CAT losses (NOT to CAT/reinsurance/fixed)
- [ ] ULAE applied AFTER trending, BEFORE credibility weighting
- [ ] CAT, reinsurance, fixed expenses added AFTER credibility (no ULAE on these)
- [ ] VPLR = 1 - variable_expense - profit (NO fixed expenses)
- [ ] All costs per exposure before summing
- [ ] Fixed expenses in numerator, not VPLR
- [ ] Formula: (all_costs_per_exp) / VPLR
- [ ] Result is rate ($/exp), not rate change (%)`,
	sources: ["Werner & Modlin - Basic Ratemaking", "CAS Ratemaking Principles"],
	safetyTags: ["actuarial", "ratemaking", "indication"],
}
