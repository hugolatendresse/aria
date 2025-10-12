// cards/first_dollar_trended_present_rates.ts
import { CapabilityCard } from "../card_registry"

export const firstDollarTrendedPresentRatesCard: CapabilityCard = {
	id: "complement-first-dollar-trended-present-rates",
	version: "1.0.0",
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
	importance: 6,
	content: `**Capability: Trended Present Rates Complement (WM Ch.12)**

**Formula (pure premium form):**  
C = Present Rate × (1 + loss_trend)^{t} × (Prior Indicated / Prior Implemented).  
**Trend period t** is measured **from the prior review's *target* effective date** to the **new filing's *target* effective date**. Do *not* use actual effective dates.  
**Loss-ratio form:** C_factor = (Prior Indicated / Prior Implemented) × ((1 + loss_trend)/(1 + premium_trend))^{t}.  

**Required inputs (declare explicitly):**  
- present_rate (≥0)  
- prior_indicated_factor (= 1 + last indicated change)  
- prior_implemented_factor (= 1 + last implemented change)  
- loss_trend_annual (decimal) and **trend_from**, **trend_to** (target effective dates);  
- *Optional (factor form):* premium_trend_annual.  

**Python module usage (enforced):**
\`\`\`python
# Install: pip install ratemaking-tools
from ratemaking_tools.complements import (
    trended_present_rates_loss_cost,
    trended_present_rates_rate_change_factor
)

# Pure premium complement:
C = trended_present_rates_loss_cost(
    present_rate=present_rate,
    prior_indicated_factor=prior_indicated_factor,
    prior_implemented_factor=prior_implemented_factor,
    loss_trend_annual=loss_trend,
    trend_from=prior_target_eff_date,
    trend_to=new_target_eff_date
)

# Factor complement (loss-ratio workflow):
C_factor = trended_present_rates_rate_change_factor(
    prior_indicated_factor=prior_indicated_factor,
    prior_implemented_factor=prior_implemented_factor,
    loss_trend_annual=loss_trend,
    premium_trend_annual=premium_trend,
    trend_from=prior_target_eff_date,
    trend_to=new_target_eff_date
)
\`\`\`

**Guardrails:**  
- If trend dates are missing, fail with: "Provide target-to-target (prior review to new filing) effective dates."  
- If user mixes *pure premium* vs *factor* in the same step, pick the one consistent with the rest of the workflow and state the choice.  

**Rationale & sources:** WM lists trended present rates among six standard first‑dollar complements and defines the trend period and residual ratio usage (prior indicated / prior implemented) with a numeric example (≈ \$229).`,
	sources: [
		"Werner & Modlin, Basic Ratemaking — Ch.12, First-Dollar complements list and trended present rates method (pp. 225, 230–231).",
	],
	safetyTags: ["actuarial", "pricing", "credibility", "complements"],
}
