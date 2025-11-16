import { CapabilityCard } from "../card_registry"

export const ultimateCapeCodCard: CapabilityCard = {
	id: "ultimate-capecod",
	version: "1.5.0",
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
Attributes include \`ultimate_\`, \`ibnr_\`, \`apriori_\`, \`detrended_apriori_\`. Methods accept \`sample_weight\` (exposure) in \`fit/predict\`. Use \`set_fit_request(sample_weight=True)\` if you want to make the routing explicit in Pipelines.

**When to use:**  
- Need a stable indication at immature ages with **exposures/premium available**; want apriori estimated from observed portfolio experience rather than purely external ELR.

**Canonical Implementation:**
\`\`\`python
import chainladder as cl
import numpy as np
import pandas as pd

# Step 1: Load and prepare loss triangle
X = loss_tri  # cumulative loss Triangle

# Step 2: Calculate on-level premium (ONE VALUE PER ORIGIN)
# Use current_level_premium card to on-level premium to current rate level
# Result: premium_df with 'onlevel_premium' column
prem_array = premium_df['onlevel_premium'].values  # numpy array, one per origin

# CRITICAL: DO NOT manually trend premium here!
# WRONG: prem_array = prem_array * (1 + trend) ** years  ← DO NOT DO THIS
# WRONG: premium_df['trend_factor'] = (1 + premium_trend_rate) ** premium_df['years_to_trend']  ← DO NOT DO THIS
# Cape Cod will handle trending internally via its TREND PARAMETER IN STEP 4 

# Step 3: Create sample_weight by reshaping (NOT creating new triangle)
# WRONG approach (AI makes this mistake frequently):
#   prem_long = pd.DataFrame({'origin': ..., 'valuation': ..., 'value': prem_array})
#   sample_weight = cl.Triangle(prem_long, ...)  ← WRONG! Valuation dates won't align
#
# RIGHT approach:
sample_weight = X.copy()  # Copy triangle structure
sample_weight.values = prem_array.reshape(1, 1, -1, 1)  # Reshape to 4D

# Step 4: Create Pipeline with Development + Cape Cod
# MUST include Development in Pipeline - do NOT call CapeCod standalone
# MUST specify trend parameter if trending needed
pipe = cl.Pipeline(steps=[
    ('dev',  cl.Development(average='volume', n_periods=2)),
    ('tail', cl.TailConstant(tail=1.05)),       # optional tail
    ('model', cl.CapeCod(trend=0.025))          # trend=annual rate (NOT 0! THIS is where premium trend is handled)
])

# Step 5: Fit and extract results
pipe.fit(X, sample_weight=sample_weight)

ult  = pipe.named_steps.model.ultimate_
ibnr = pipe.named_steps.model.ibnr_
\`\`\`

**Tort Reform (Triangle Adjustment Approach):**
When tort reform or claims environment changes require adjustment, apply factors to the TRIANGLE (not premium) before fitting, then adjust results back. CRITICAL: Do NOT adjust premium by tort factors - premium represents current exposure and should remain at full current-level amounts. Implementation: (1) Create factor triangle with appropriate factors by origin; (2) Adjust input triangle: \`X_adjusted = X * tort_tri\`; (3) Fit Pipeline (NOT standalone CapeCod) with UNADJUSTED premium: \`pipe = cl.Pipeline([('dev', cl.Development(...)), ('model', cl.CapeCod(...))]); pipe.fit(X_adjusted, sample_weight=premium)\`; (4) Adjust results back: \`ult_original = pipe.named_steps.model.ultimate_ / tort_tri.latest_diagonal\`, \`ibnr_original = pipe.named_steps.model.ibnr_ / tort_tri.latest_diagonal\`. Common errors: Adjusting premium down produces systematically low ultimates; calling CapeCod standalone without Development produces incorrect results. Factor direction: see **Special Adjustments: Tort Reform** card.

**Understanding apriori outputs:**  
With \`trend\` ≠ 0, \`apriori_\` is expressed at the latest origin basis, while \`detrended_apriori_\` maps back to each origin’s basis (the detrended vector is what the estimator actually uses).

**Input / Output:**
- **Input:** \`X\` cumulative loss Triangle; \`sample_weight\` Triangle (exposure/premium—use \`latest_diagonal\`); optional \`Development\`/\`Tail\`; hyperparameters \`trend\`, \`decay\`, \`n_iters\` (Benktander iterations), \`groupby\`.
- **Output:** \`ultimate_\`, \`ibnr_\`, \`apriori_\`, \`detrended_apriori_\` as Triangles.

**Critical Points:**
- **THREE MOST COMMON ERRORS** 
  1. Creating sample_weight from scratch: \`cl.Triangle(prem_df_long, ...)\` ← WRONG
  2. Manually trending premium: \`prem * (1 + trend) ** years\` ← WRONG. Premium trend is handled in the Cape Cod pipeline! 
  3. Omitting trend parameter: \`CapeCod()\` instead of \`CapeCod(trend=rate)\` ← WRONG
- **MUST use Pipeline**: NEVER call \`cl.CapeCod().fit()\` directly. ALWAYS use: \`cl.Pipeline([('dev', cl.Development(...)), ('model', cl.CapeCod(trend=...))])\`
- **sample_weight construction**: Get premium array, copy triangle, reshape: \`sw = X.copy(); sw.values = prem_array.reshape(1, 1, -1, 1)\`. Do NOT create new triangle from long-format data.

**Version:** v1.5 - Added step-by-step workflow with explicit WRONG examples. Highlighted three most common errors.`,
	sources: [
		"chainladder‑python docs — CapeCod API",
		"chainladder‑python docs — IBNR Methods: CapeCod (concept, apriori, trend/decay)",
		"chainladder‑python gallery — CapeCod Onleveling (ParallelogramOLF + sample_weight pattern)",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
