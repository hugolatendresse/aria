import { CapabilityCard } from "../card_registry"

export const lossRatioIndicationCard: CapabilityCard = {
	id: "ratemaking-loss-ratio-indication",
	version: "1.0.0",
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
	content: `**Capability Card: Loss Ratio Indication Method v1.0**

**What it does:**
Calculates the indicated rate change needed to achieve target profitability based on projected loss ratios, expense provisions, and underwriting profit targets. 

**Key Concept:**
The loss ratio method compares projected losses (as % of premium) to the permissible loss ratio (portion of premium available for losses after expenses and profit).

**Canonical Implementation:**
\`\`\`python
import numpy as np

# Step 1: Calculate Projected Loss and LAE Ratio
ulae_factor = 1.10  # e.g., 10% ULAE on loss+ALAE (provided by the user)

# Weighted average (total-level, NOT by-year average)
total_projected_ultimate_losses = (ultimate_losses * loss_trend_factors).sum()
total_projected_earned_premium = projected_earned_premium.sum()

projected_loss_lae_ratio = (
    total_projected_ultimate_losses / total_projected_earned_premium
) * ulae_factor

# Step 2: Variable Permissible Loss Ratio (VPLR)
variable_expense_provision = 0.11  # 11% (provided by the user)
underwriting_profit_provision = 0.04    # 4% (provided by the user)

vplr = 1 - variable_expense_provision - underwriting_profit_provision

# Step 3: Indicated Rate Change
fixed_expense_provision = 0.09  # 9% (provided by the user)

indicated_rate_change = (
    (projected_loss_lae_ratio + fixed_expense_provision) / vplr
) - 1
\`\`\`

**ULAE Factor:**
- ULAE = Unallocated Loss Adjustment Expense (not attributable to specific claims)
- Ratio method: ULAE / (Loss + ALAE)
- Factor method: \`1 + ULAE_ratio\` (e.g., 1.10 = 10% ULAE provision)
- Applied to Loss+ALAE to get total Loss+LAE

**Expense Provisions:**
- **Variable expenses**: Scale with premium (commissions, taxes, premium-based fees)
- **Fixed expenses**: Don't scale with premium (general overhead, flat fees)
- Variable expense % deducted from available premium before calculating VPLR
- Fixed expense % added to loss+LAE in numerator

**VPLR (Variable Permissible Loss Ratio):**
- Portion of premium available for losses after variable expenses and profit
- Formula: \`1 - variable_expense - UW_profit\`
- Represents maximum loss ratio that allows target profit

**Indicated Rate Change Formula (Loss Ratio Method):**
\`\`\`
Indicated = (Selected Loss+LAE Ratio + Fixed Expense Provision) / VPLR - 1

Where:
- Selected Loss+LAE Ratio = (Projected Ultimate × ULAE Factor) / Projected Premium
- Fixed Expense Provision = fixed expense as % of premium
- VPLR = 1 - variable_expense - UW_profit
\`\`\`

**When to use:**
- Personal lines, homeowners, auto (premium-based exposures)
- When loss experience is credible predictor of future

**Critical Points:**
- Loss+LAE ratio: Use **total weighted average** unless the user specifies otherwise
- ULAE factor multiplies entire (losses/premium) ratio
- Variable expenses reduce available premium (in denominator via VPLR)
- Fixed expenses add to required premium (in numerator)
- Negative indicated rate = rates too high; positive = need increase
- Always use trended/projected values, not historical raw data`,
	sources: ["Werner & Modlin - Basic Ratemaking", "CAS Ratemaking Principles"],
	safetyTags: ["actuarial", "ratemaking", "indication"],
}
