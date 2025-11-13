import { CapabilityCard } from "../card_registry"

export const firstDollarTrendedPresentRatesCard: CapabilityCard = {
	id: "complement-first-dollar-trended-present-rates",
	version: "1.2.0",
	title: "Complement — Trended Present Rates (WM Ch.12)",
	triggers: [
		{ kind: "keyword", any: ["trended present rates", "present rates complement", "residual indication"] },
		{
			kind: "regex",
			pattern:
				"\\b(complement of credibility|first[- ]?dollar|target effective date|residual|prior indicated|prior implemented)\\b",
			flags: "i",
		},
	],
	content: `**Trended Present Rates Complement (WM Ch.12) v1.2**

**Purpose:**
Trends the prior rate indication (what was indicated vs. what was taken) forward to the new rate effective date.

**Core Formula:**
\`\`\`
TPR = (1 + net_trend)^t × (1 + prior_indicated) / (1 + prior_implemented) - 1

where:
  net_trend = (1 + loss_trend) / (1 + premium_trend) - 1
  t = years from prior target effective date to new target effective date
\`\`\`

**Complete Example:**
\`\`\`python
from datetime import datetime

# Prior rate filing information
prior_indicated_rate_change = 0.08   # 8.0% was indicated
prior_implemented_rate_change = 0.03  # 3.0% was implemented
prior_target_eff_date = '1/1/2023'
new_target_eff_date = '1/1/2024'

# Current trends (use PROJECTED loss trend, not current)
premium_trend_annual = 0.025      # 2.5% annual
projected_loss_trend_annual = 0.03  # 3.0% annual (4-point)

# Step 1: Calculate net trend
net_trend = (1 + projected_loss_trend_annual) / (1 + premium_trend_annual) - 1
# Result: 0.004878 (0.49%)

# Step 2: Calculate trend period in years
from_date = datetime.strptime(prior_target_eff_date, '%m/%d/%Y').date()
to_date = datetime.strptime(new_target_eff_date, '%m/%d/%Y').date()
trend_period_years = (to_date - from_date).days / 365.25
# Result: 1.0021 years

# Step 3: Calculate TPR using RATIO formula
trended_present_rates = (
    (1 + net_trend) ** trend_period_years * 
    ((1 + prior_indicated_rate_change) / (1 + prior_implemented_rate_change)) - 1
)
# Result: 0.05366 (5.37%)
\`\`\`

**MOST COMMON ERRORS:**

**ERROR 1: Simple Subtraction (Ignores Ratio and Trending)**
\`\`\`python
# WRONG - just subtracting the two changes
trended_present_rates = prior_indicated - prior_implemented
# 0.08 - 0.03 = 0.05 (5.0%)
# CORRECT answer: 5.37%, error = 0.37 percentage points!
\`\`\`

**ERROR 2: Using the Ratio But Forgetting Net Trend**
\`\`\`python
# WRONG - missing the trending component
trended_present_rates = (1 + prior_indicated) / (1 + prior_implemented) - 1
# Result: 4.85%, but should be 5.37% after applying net trend
\`\`\`

**ERROR 3: Recalculating from Scratch Instead of Trending Forward**
\`\`\`python
# WRONG - this recalculates indication, doesn't trend prior filing
losses_with_current_trend = apply_current_trend(ultimate_losses)
trended_present_rates = calculate_indication(losses_with_current_trend)
# This is conceptually wrong - TPR should adjust the PRIOR filing, not recalculate
\`\`\`

**Key Points:**
- **Use RATIO**: (1 + indicated) / (1 + implemented), NOT subtraction
- **Net Trend Formula**: net_trend = (1 + loss_trend) / (1 + premium_trend) - 1
  - **Loss component**: Use PROJECTED loss trend (4-point), not current (8-point)
  - **Premium component**: Use premium trend from premium trending analysis, NOT frequency/severity trends
- **Use Target Effective Dates**: When rates are scheduled to take effect, not actual dates
- Convert to rate change by subtracting 1 at the end

**Verification Checklist:**
- [ ] Using ratio: (1 + indicated) / (1 + implemented)
- [ ] NOT using simple subtraction: indicated - implemented
- [ ] Net trend = (1 + projected_loss_trend) / (1 + premium_trend) - 1
- [ ] Loss component: projected (4-point) loss trend
- [ ] Premium component: premium trend (NOT frequency trend variable)
- [ ] Trend period from target effective dates
- [ ] Final formula: (1 + net_trend)^t × ratio - 1`,
	sources: [
		"Werner & Modlin, Basic Ratemaking — Ch.12, First-Dollar complements list and trended present rates method (pp. 225, 230–231).",
	],
	safetyTags: ["actuarial", "pricing", "credibility", "complements"],
}
