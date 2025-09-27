import { CapabilityCard } from "../card_registry"

export const ultimateCapeCodCard: CapabilityCard = {
	id: "ultimate-capecod",
	version: "1.0.0",
	title: "Ultimates: Cape Cod (expected-loss, ELR/Exposure based)",
	triggers: [
		{ kind: "keyword", any: ["cape cod", "capecod", "ultimate", "IBNR", "exposure", "ELR", "expected loss", "apriori"] },
		{ kind: "keyword", any: ["benktander", "on-level", "parallelogram"], all: ["triangle"] },
		{ kind: "regex", pattern: "\\b(sample_weight|trend|decay|n_iters)", flags: "i" },
	],
	importance: 4,
	short: `Cape Cod method: Expected-loss technique using exposure base (on-leveled premium) with development factors to produce ultimates less sensitive to late-year volatility.`,
	long: `**Capability Card: Cape Cod (Expected-Loss) v1.0**

**What it does:**
Applies the Cape Cod technique: builds an apriori from exposure (e.g., on‑leveled earned premium) and development factors, then produces ultimates and IBNR by origin. Supports trend/decay and iteration bridging toward Benktander.

**When to use:**
- You have (i) a cumulative loss Triangle and (ii) an exposure Triangle (e.g., on‑leveled earned premium)
- You want expected‑loss style ultimates that are less sensitive to late‑year volatility than pure Chainladder

**Canonical Implementation:**
\`\`\`python
import chainladder as cl
import pandas as pd

# X: cumulative loss Triangle (paid or reported)
dev = cl.Development(average='volume')
X = dev.fit_transform(loss_tri)

# Exposure base: Triangle (e.g., earned premium) — typically on-leveled first
# On-level premium via parallelogram OLF (if needed)
# rate_history: DataFrame with rate changes and dates
# rate_history columns: {'eff_date', 'rate_change'} where -0.05 = -5%
olf = cl.ParallelogramOLF(rate_history=rate_history, change_col='rate_change', date_col='eff_date')
prem_onlevel = olf.fit_transform(premium_tri)   # Triangle aligned to loss_tri's index/origin/dev

# Cape Cod with trend/decay assumptions (trend can also be applied via cl.Trend on X)
cc = cl.CapeCod(trend=0.00, decay=1.00, n_iters=1)  # n_iters>1 moves toward Benktander
cc.fit(X=X, sample_weight=prem_onlevel)             # exposure Triangle passed via sample_weight

ult  = cc.ultimate_         # Triangle of ultimates
ibnr = cc.ibnr_             # Triangle of IBNR
apriori = cc.apriori_       # (trended) apriori vector used by Cape Cod
\`\`\`

**Input/Output:**
- **Input:** X: cl.Triangle (cumulative loss), sample_weight: cl.Triangle (exposure), trend/decay/n_iters parameters
- **Output:** ultimate_, ibnr_, apriori_ Triangles

**Critical Points:**
- Exposure must be passed as Triangle via sample_weight and align on index/origin/development with X
- On‑level exposure first; otherwise Cape Cod reflects mixed rate levels. Use Parallelogram OLF
- If you already trended X via cl.Trend, that overrides the Cape Cod 'trend' parameter
- Set grains consistently (monthly vs quarterly vs annual) for both loss and exposure Triangles
- Zero or negative exposure rows will zero‑out or distort apriori; sanitize before fit

**Version:** Tested with chainladder 0.8.x. API: cl.CapeCod(trend,decay,...) with attributes ultimate_/ibnr_/apriori_; exposure Triangle provided to fit(..., sample_weight=exposure).`,
	sources: ["chainladder-python docs v0.8.x", "Cape Cod API documentation"],
	safetyTags: ["actuarial", "IBNR", "exposure-based"],
}
