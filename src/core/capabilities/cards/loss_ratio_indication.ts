import { CapabilityCard } from "../card_registry"

export const lossRatioIndicationCard: CapabilityCard = {
	id: "ratemaking-loss-ratio-indication",
	version: "1.2.0",
	title: "Ratemaking: Loss Ratio Indication Method",
	triggers: [
		{
			kind: "keyword",
			any: [
				"loss ratio method",
				"indicated rate change",
				"VPLR",
				"ULAE factor",
				"permissible loss ratio",
				"variable expense",
				"fixed expense",
			],
		},
		{ kind: "regex", pattern: "\\b(loss[\\s-]?ratio[\\s-]?(method|indication)|VPLR|ULAE)\\b", flags: "i" },
	],
	content: `**Loss Ratio Indication Method v1.2**

**Core Formula:**
\`\`\`
Indicated Rate Change = (Loss+LAE Ratio + Fixed Expense) / VPLR - 1

where:
  VPLR = 1 - Variable Expense - UW Profit
  (VPLR contains ONLY variable expenses and profit, NOT fixed expenses)
\`\`\`

**Complete Implementation:**
\`\`\`python
# Step 1: Calculate Projected Loss+LAE Ratio
ulae_factor = 1.12  # provided
projected_ultimate_losses_by_ay = ultimate_losses_by_ay * loss_trend_factors_by_ay

projected_loss_lae_ratio = (
    projected_ultimate_losses_by_ay.sum() / projected_earned_premium.sum()
) * ulae_factor

# Step 2: Calculate VPLR (Variable Permissible Loss Ratio)
variable_expense_provision = 0.15  # 15% provided
underwriting_profit_provision = 0.04   # 4% provided

# CRITICAL: VPLR uses ONLY variable expenses and profit
vplr = 1 - variable_expense_provision - underwriting_profit_provision

# Step 3: Calculate Indicated Rate Change
fixed_expense_provision = 0.09  # 9% provided

# CRITICAL: Fixed expense goes in NUMERATOR, not denominator
indicated_rate_change = (projected_loss_lae_ratio + fixed_expense_provision) / vplr - 1
\`\`\`

**Why Fixed and Variable Expenses Are Treated Differently:**

**Variable Expenses** (commissions, premium taxes):
- Scale with premium: 20% commission on $100 = $20, on $200 = $40
- Go in DENOMINATOR via VPLR
- Reduce available premium: \`1 - variable_expense - profit\`

**Fixed Expenses** (overhead, salaries):
- Do NOT scale with premium: $50 overhead whether premium is $100 or $200
- Go in NUMERATOR
- Added to loss costs: \`loss_ratio + fixed_expense\`

**COMMON ERRORS:**

**ERROR 1: Treating All Expenses as Multiplicative Complements**
\`\`\`python
# WRONG - treats fixed expenses like they scale with premium
denominator = (1 - variable_expense) * (1 - fixed_expense) * (1 - profit)
indicated = loss_ratio / denominator - 1
\`\`\`

**ERROR 2: Putting Fixed Expenses in VPLR**
\`\`\`python
# WRONG - fixed expenses don't belong in VPLR
vplr = 1 - variable_expense - profit - fixed_expense  # NO!
indicated = loss_ratio / vplr - 1
\`\`\`

**ERROR 3: Putting ALL Expenses in Denominator**
\`\`\`python
# WRONG - lumping everything together
total_provision = variable_expense + profit + fixed_expense
indicated = loss_ratio / (1 - total_provision) - 1
\`\`\`

**CORRECT Formula Structure:**
\`\`\`python
vplr = 1 - variable_expense - profit  # Denominator: ONLY variable expenses and profit
indicated = (loss_ratio + fixed_expense) / vplr - 1  # Numerator: loss + fixed expenses
\`\`\`

**Quick Reference:**
- ULAE factor: Multiply entire loss ratio by this factor
- Loss trending: Use Two-Step method by accident year (see loss trending card)
- Negative rate change: Current rates are too high
- Positive rate change: Need rate increase

**Verification Checklist:**
- [ ] VPLR = 1 - variable_expense - profit (NO fixed expenses)
- [ ] Fixed expense ADDED to loss ratio in numerator
- [ ] Formula is: (loss_ratio + fixed_expense) / VPLR - 1
- [ ] NOT using: loss_ratio / (1 - all_expenses) - 1`,
	sources: ["Werner & Modlin - Basic Ratemaking", "CAS Ratemaking Principles"],
	safetyTags: ["actuarial", "ratemaking", "indication"],
}
