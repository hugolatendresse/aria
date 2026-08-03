import { CapabilityCard } from "../card_registry"

export const ultimateCapeCodCard: CapabilityCard = {
	id: "ultimate-capecod",
	version: "1.2.0",
	title: "Ultimates: Cape Cod (Stanard–Bühlmann)",
	triggers: [
		{
			kind: "keyword",
			any: ["cape cod method", "capecod method", "cape-cod method"],
		},
		{ kind: "regex", pattern: "\\b(cape[\\s-]?cod)\\s+(method|approach|model|estimator)\\b", flags: "i" },
	],
	content: `**Capability Card: Cape Cod v1.0**

**What it does:**  
Derives the **expected claim ratio (apriori)** *from the triangle itself* (not purely judgmental) and blends it with emerged losses using development/CDF—i.e., a data‑driven BF. Supports optional trend-to-latest and origin‑distance **decay** weighting, and exposes the fitted **apriori_** and **detrended_apriori_** vectors.

**Key API (chainladder‑python):**  
\`cl.CapeCod(trend=0, decay=1, n_iters=1, apriori_sigma=0.0, random_state=None, groupby=None)\`  
Attributes include \`ultimate_\`, \`ibnr_\`, \`apriori_\`, \`detrended_apriori_\`. Methods accept \`sample_weight\` (exposure) in \`fit/predict\`. Use \`set_fit_request(sample_weight=True)\` if you want to make the routing explicit in Pipelines.

**When to use:**  
- Need a stable indication at immature ages with **exposures/premium available**; want apriori estimated from observed portfolio experience rather than purely external ELR.

**Canonical Implementation:**
\`\`\`python
import chainladder as cl
import numpy as np
import pandas as pd

# X: cumulative loss Triangle (paid or reported)
X = loss_tri

# --- CRITICAL: On-level premium first (if rate changes exist) ---
# Use the current_level_premium card guidance to on-level premium
# Then pass the on-leveled premium as-is (do NOT manually trend it)
onlevel_prem = premium_tri.latest_diagonal   # already on-leveled to current


# --- CRITICAL: Create sample_weight correctly ---
# WRONG: Creating a new triangle from long data - valuation dates won't align
# RIGHT: Reshape premium array and copy triangle structure
prem_array = [19783309, 30547757, ...]  # one value per origin (on-leveled)
sample_weight = X.copy()
sample_weight.values = prem_array.reshape(1, 1, -1, 1)  # reshape to 4D triangle

# Pipeline: Development → Tail → CapeCod (with trend parameter)
# IMPORTANT: Use a Pipeline, do NOT fit separately
pipe = cl.Pipeline(steps=[
    ('dev',  cl.Development(average='volume', n_periods=2)),
    ('tail', cl.TailConstant(tail=1.05)),       # optional tail
    ('model', cl.CapeCod(trend=0.025))          # trend handles loss trending internally
])
pipe.set_fit_request(sample_weight=True)

# Fit with reshaped premium as sample_weight (NOT manually trended)
pipe.fit(X, sample_weight=sample_weight)

ult  = pipe.named_steps.model.ultimate_
ibnr = pipe.named_steps.model.ibnr_
ap   = pipe.named_steps.model.apriori_            # trended-to-latest apriori
ap_d = pipe.named_steps.model.detrended_apriori_  # detrended to each origin

# Value extraction
total_ult  = ult.sum().sum()
total_ibnr = ibnr.sum().sum()
\`\`\`
- **Exposure goes in \`sample_weight\`**; pass **one value per origin** (on-leveled premium, NOT manually trended).
- **The \`trend\` parameter is NOT for premium**; it adjusts the apriori estimation by detrending losses to a common basis.

**Tort Reform (Triangle Adjustment Approach):**
When tort reform or claims environment changes require adjustment, apply factors to the TRIANGLE (not premium) before fitting, then adjust results back. CRITICAL: Do NOT adjust premium by tort factors - premium represents current exposure and should remain at full current-level amounts. Implementation: (1) Create factor triangle with appropriate factors by origin; (2) Adjust input triangle: \`X_adjusted = X * tort_tri\`; (3) Fit model with UNADJUSTED premium as sample_weight: \`pipe.fit(X_adjusted, sample_weight=premium)\`; (4) Adjust results back: \`ult_original = model.ultimate_ / tort_tri.latest_diagonal\`, \`ibnr_original = model.ibnr_ / tort_tri.latest_diagonal\`. Common error: Adjusting premium down produces systematically low ultimates. Factor direction: see **Special Adjustments: Tort Reform** card.

**Understanding apriori outputs:**  
With \`trend\` ≠ 0, \`apriori_\` is expressed at the latest origin basis, while \`detrended_apriori_\` maps back to each origin’s basis (the detrended vector is what the estimator actually uses).

**Input / Output:**
- **Input:** \`X\` cumulative loss Triangle; \`sample_weight\` Triangle (exposure/premium—use \`latest_diagonal\`); optional \`Development\`/\`Tail\`; hyperparameters \`trend\`, \`decay\`, \`n_iters\` (Benktander iterations), \`groupby\`.
- **Output:** \`ultimate_\`, \`ibnr_\`, \`apriori_\`, \`detrended_apriori_\` as Triangles.

**Critical Points:**
- **Create sample_weight correctly**: NEVER create a new triangle from long-format premium data (valuation dates won't align). Instead: (1) Get premium array (one value per origin); (2) Copy loss triangle structure: \`sw = X.copy()\`; (3) Reshape and assign: \`sw.values = prem_array.reshape(1, 1, -1, 1)\`. This preserves triangle alignment.
- **Always provide exposure** via \`sample_weight\` (one value per origin). Do **not** pass the full exposure triangle to \`fit\`; the estimator expects specific structure.
- **Tort reform**: NEVER adjust premium by tort factors. Pass UNADJUSTED current-level premium as sample_weight. Tort factors adjust the loss triangle only.
- **DO NOT manually trend premium:** This method handles trending internally via the \`trend\` parameter. Pass on-level premium as-is; do NOT multiply it by \`(1 + trend) ** years\`. The \`trend\` parameter common-bases all origins to the latest year when estimating the apriori.
- **Use Pipeline for proper workflow:** Chain Development → (optional Tail) → CapeCod in a Pipeline. Do NOT fit them separately and manually combine. Example: \`cl.Pipeline(steps=[('dev', cl.Development(n_periods=2)), ('tail', cl.TailConstant(tail=1.05)), ('model', cl.CapeCod(trend=0.025))])\`.
- \`trend\` parameter: Annual trend rate (e.g., 0.025 for 2.5% per year) used to adjust apriori estimation, NOT for manually trending premium. The method detrends losses internally to estimate apriori consistently across origins.
- \`decay < 1\` gives more weight to nearer origins when estimating apriori; default \`decay=1\` treats all origins equally.
- If you want this method's logic but a fixed/judgmental ELR, use **BF** instead (apriori chosen externally); this method's apriori is estimated from data.
- **Tort reform adjustment:** Adjust TRIANGLE (not premium) before fitting, adjust RESULTS back after. Never multiply premium by tort factors - this produces incorrect ultimates. See **Special Adjustments: Tort Reform** card for complete implementation and factor direction logic.

**Version:** v1.2 - Added sample_weight construction guidance. Tested against chainladder 0.8.x/0.9.x APIs.`,
	sources: [
		"chainladder‑python docs — CapeCod API",
		"chainladder‑python docs — IBNR Methods: CapeCod (concept, apriori, trend/decay)",
		"chainladder‑python gallery — CapeCod Onleveling (ParallelogramOLF + sample_weight pattern)",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
