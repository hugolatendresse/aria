// cards/first_dollar_complements.ts
import { CapabilityCard } from "../card_registry"

export const firstDollarComplementsUmbrellaCard: CapabilityCard = {
	id: "complement-first-dollar-umbrella",
	version: "1.0.0",
	title: "Complements of Credibility — First-Dollar (WM Ch.12)",
	triggers: [
		{
			kind: "keyword",
			any: ["complement of credibility", "first dollar", "Harwayne", "competitor rates", "related group", "larger group"],
		},
		{ kind: "regex", pattern: "\\b(trended present rates|rate change from larger group|Harwayne)\\b", flags: "i" },
	],
	importance: 5,
	content: `**First-Dollar complements available (method auto-selection based on user phrasing):**
1) Larger group loss costs → exposure-weighted PP from the larger set.  
2) Related group loss costs → similar but acknowledge bias; document adjustments.  
3) Rate change from larger group applied to present rates → use \`larger_group_applied_rate_change_to_present_rate\`.  
4) **Harwayne’s method** → reweight related states to subject class mix, compute \(F_s\), adjust class-of-interest, exposure-weight combine.  
5) **Trended present rates** → see dedicated card; use residual × trend with target-to-target dates.  
6) Competitors’ rates → acceptable when own data volume is low; document comparability caveats.

**Python module usage (enforced):**
\`\`\`python
# Install: pip install ratemaking-tools
from ratemaking_tools.complements import (
    larger_group_applied_rate_change_to_present_rate,
    harwayne_complement, 
    HarwayneInputs
)
\`\`\`

**Guardrails:** Explicitly state independence, bias, and data availability per WM’s evaluation bullets before blending with Z.`,
	sources: ["Werner & Modlin, Basic Ratemaking — Ch.12, First-Dollar complements and evaluations (pp. 225–231)."],
	safetyTags: ["actuarial", "pricing", "credibility", "complements"],
}
