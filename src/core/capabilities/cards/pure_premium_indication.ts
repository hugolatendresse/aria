import { CapabilityCard } from "../card_registry"

export const purePremiumIndicationCard: CapabilityCard = {
	id: "ratemaking-pure-premium-indication",
	version: "1.0.0",
	title: "Ratemaking: Pure Premium Indication Method",
	triggers: [
		{
			kind: "keyword",
			any: [
				"pure premium method",
				"loss cost method",
				"indicated pure premium",
				"indicated rate",
				"Werner-Modlin",
				"permissible loss ratio",
			],
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
\`\`\`

**Implementation:**
\`\`\`python
# Calculate projected pure premium (non-CAT)
trended_ultimate_with_ulae = (ultimate_losses_by_ay * trend_factors * ulae_factor).sum()
selected_pp = trended_ultimate_with_ulae / total_exposures

# Apply credibility (see credibility card)
credibility_weighted_pp = z * selected_pp + (1 - z) * regional_pp

# Calculate VPLR
vplr = 1 - variable_expense - profit  # NO fixed expenses here

# Calculate total indicated rate
indicated_rate = (
    credibility_weighted_pp + cat_pp + reinsurance + fixed_expense_per_exp
) / vplr
\`\`\`

**vs Loss Ratio Method:**
- Loss Ratio: works with ratios (losses/premium) → outputs rate change (%)
- Pure Premium: works with costs (losses/exposure) → outputs rate ($/exposure)

**Critical Rules:**

**Variable vs Fixed Expenses:**
- **Variable** (commissions, premium taxes): scale with premium → go in VPLR (denominator)
- **Fixed** (overhead, salaries): do NOT scale → go in numerator as cost per exposure
- **CAT, Reinsurance**: specific costs → go in numerator as cost per exposure

**Common Errors:**
\`\`\`python
# WRONG - fixed expenses in VPLR
vplr = 1 - variable_expense - profit - fixed_expense  # NO!

# WRONG - forgetting to divide by VPLR
rate = pp + cat_pp + reinsurance + fixed_expense  # Missing /vplr

# WRONG - mixing units
sum = total_losses + cat_pp_per_exp  # Different units!
# CORRECT
sum = (total_losses / exposures) + cat_pp_per_exp  # Same units
\`\`\`

**Verification Checklist:**
- [ ] VPLR = 1 - variable_expense - profit (NO fixed expenses)
- [ ] All costs per exposure before summing
- [ ] Fixed expenses in numerator, not VPLR
- [ ] Formula: (all_costs_per_exp) / VPLR
- [ ] Result is rate ($/exp), not rate change (%)`,
	sources: ["Werner & Modlin - Basic Ratemaking", "CAS Ratemaking Principles"],
	safetyTags: ["actuarial", "ratemaking", "indication"],
}
