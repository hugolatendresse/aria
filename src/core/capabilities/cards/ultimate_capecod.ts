import { CapabilityCard } from "../card_registry"

export const ultimateCapeCodCard: CapabilityCard = {
	id: "ultimate-capecod",
	version: "1.0.0",
	title: "Ultimates: Cape Cod (Stanard–Bühlmann)",
	triggers: [
		{
			kind: "keyword",
			any: ["cape cod", "capecod", "cape-cod", "stanard", "bühlmann", "buhlmann", "stanard-bühlmann", "stanard buhlmann"],
		},
		{ kind: "regex", pattern: "\\b(cape[\\s-]?cod|stanard|b[üu]hlmann)\\b", flags: "i" },
	],
	importance: 5,
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

# Pipeline: Development → Tail → CapeCod (with trend parameter)
# IMPORTANT: Use a Pipeline, do NOT fit separately
pipe = cl.Pipeline(steps=[
    ('dev',  cl.Development(average='volume', n_periods=2)),
    ('tail', cl.TailConstant(tail=1.05)),       # optional tail
    ('model', cl.CapeCod(trend=0.025))          # trend handles loss trending internally
])
pipe.set_fit_request(sample_weight=True)

# Fit with on-level premium (NOT manually trended)
pipe.fit(X, sample_weight=onlevel_prem)

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
When tort reform or claims environment changes require adjustment, apply factors to the triangle before fitting, then adjust results back. Factor direction logic: see **Special Adjustments: Tort Reform** card. Implementation: (1) Create factor triangle with appropriate factors by origin; (2) Adjust input triangle: \`X_adjusted = X * tort_tri\`; (3) Fit Cape Cod with premium as sample_weight; (4) Adjust results back: \`ult_original = model.ultimate_ / tort_tri.latest_diagonal\`. Example: Reform reduced losses 40% starting 2006 → old years get factor 0.60, reformed years get 1.0 (already at current level).

**Understanding apriori outputs:**  
With \`trend\` ≠ 0, \`apriori_\` is expressed at the latest origin basis, while \`detrended_apriori_\` maps back to each origin’s basis (the detrended vector is what the estimator actually uses).

**Input / Output:**
- **Input:** \`X\` cumulative loss Triangle; \`sample_weight\` Triangle (exposure/premium—use \`latest_diagonal\`); optional \`Development\`/\`Tail\`; hyperparameters \`trend\`, \`decay\`, \`n_iters\` (Benktander iterations), \`groupby\`.
- **Output:** \`ultimate_\`, \`ibnr_\`, \`apriori_\`, \`detrended_apriori_\` as Triangles.

**Critical Points:**
- **Always provide exposure** via \`sample_weight=exposure.latest_diagonal\`. Do **not** pass the full exposure triangle to \`fit\`; the estimator expects one value per origin. IMPORTANT: When applying tort reform adjustments, the \`sample_weight\` should be the PREMIUM (on-level earned premium), NOT the tort reform factors. Tort factors adjust the loss triangle (X), not the sample_weight.
- **DO NOT manually trend premium:** Cape Cod handles trending internally via the \`trend\` parameter. Pass on-level premium as-is; do NOT multiply it by \`(1 + trend) ** years\`. The \`trend\` parameter tells Cape Cod to common-base all origins to the latest year when estimating the apriori.
- **Use Pipeline for proper workflow:** Chain Development → (optional Tail) → CapeCod in a Pipeline. Do NOT fit them separately and manually combine. Example: \`cl.Pipeline(steps=[('dev', cl.Development(n_periods=2)), ('tail', cl.TailConstant(tail=1.05)), ('model', cl.CapeCod(trend=0.025))])\`.
- \`trend\` parameter: Annual trend rate (e.g., 0.025 for 2.5% per year) used to adjust apriori estimation, NOT for manually trending premium. Cape Cod detrends losses internally to estimate apriori consistently across origins.
- \`decay < 1\` gives more weight to nearer origins when estimating apriori; default \`decay=1\` treats all origins equally.
- If you want Cape Cod logic but a fixed/judgmental ELR, use **BF** instead (apriori chosen externally); Cape Cod's apriori is estimated from data.
- **Tort reform adjustment:** When applying special adjustments, create factor triangle and adjust input losses before fitting (see example above). For factor direction and calculation logic, refer to **Special Adjustments: Tort Reform** card. Always adjust results back after fitting: \`ultimate_original = ultimate_adjusted / tort_tri.latest_diagonal\`.

**Version:** Tested against chainladder 0.8.x/0.9.x APIs (\`fit(..., sample_weight=...)\`, \`ultimate_\`, \`ibnr_\`, \`apriori_\`, \`detrended_apriori_\`).`,
	sources: [
		"chainladder‑python docs — CapeCod API",
		"chainladder‑python docs — IBNR Methods: CapeCod (concept, apriori, trend/decay)",
		"chainladder‑python gallery — CapeCod Onleveling (ParallelogramOLF + sample_weight pattern)",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
