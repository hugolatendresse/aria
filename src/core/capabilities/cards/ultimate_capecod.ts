import { CapabilityCard } from "../card_registry"

export const ultimateCapeCodCard: CapabilityCard = {
	id: "ultimate-capecod",
	version: "1.0.0",
	title: "Ultimates: Cape Cod (Stanard–Bühlmann)",
	triggers: [
		{
			kind: "keyword",
			any: [
				"cape cod",
				"capecod",
				"stanard",
				"bühlmann",
				"buhlmann",
				"expected loss",
				"ELR",
				"apriori",
				"ultimate",
				"IBNR",
			],
		},
		{ kind: "keyword", any: ["ultimate", "IBNR"], all: ["triangle"] },
		{
			kind: "regex",
			pattern: "\\b(apriori|expected\\s*loss\\s*ratio|exposure|premium|trend|decay|groupby)\\b",
			flags: "i",
		},
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

# --- Exposure (sample_weight) by origin (e.g., Earned Premium) ---
# If you already have a premium triangle that aligns with X:
prem = premium_tri.latest_diagonal   # one value per origin

# Pipeline: select dev, optional tail, then CapeCod with trend/decay
pipe = cl.Pipeline(steps=[
    ('dev',  cl.Development(average='volume', n_periods=2)),
    # ('tail', cl.TailCurve(curve='exponential')),  # optional tail
    ('model', cl.CapeCod(trend=0.03, decay=0.9))
])
pipe.set_fit_request(sample_weight=True)  # ensures sample_weight is routed to final step

# Fit with exposure passed via sample_weight (latest diagonal)
pipe.fit(X, sample_weight=prem)

ult  = pipe.named_steps.model.ultimate_
ibnr = pipe.named_steps.model.ibnr_
ap   = pipe.named_steps.model.apriori_            # trended-to-latest apriori
ap_d = pipe.named_steps.model.detrended_apriori_  # detrended to each origin

# Value extraction (be consistent with other cards):
total_ult  = ult.sum().sum()
total_ibnr = ibnr.sum().sum()
\`\`\`
- **Exposure goes in \`sample_weight\`**; pass **one value per origin** (use the **latest diagonal** of a premium/exposure triangle).

**On‑leveling & Trend options (recommended pattern):**
\`\`\`python
# Example following the docs gallery pattern:
loss_onlevel_pipe = cl.Pipeline(steps=[
    ('olf',  cl.ParallelogramOLF(loss_factor_df, change_col='rate_change', date_col='date', vertical_line=True)),
    ('dev',  cl.Development(n_periods=2)),
    ('model', cl.CapeCod(trend=0.034))
])
# On-level premium to latest level before passing as exposure
prem_onlevel = cl.ParallelogramOLF(prem_factor_df, change_col='rate_change', date_col='date',
                                   vertical_line=True).fit_transform(premium_tri.latest_diagonal)

loss_onlevel_pipe.fit(X, sample_weight=prem_onlevel)
ult_onlevel = loss_onlevel_pipe.named_steps.model.ultimate_
\`\`\`
This mirrors the official **CapeCod Onleveling** example (loss transformed in-pipeline; premium on‑leveled separately, then used as \`sample_weight\`).

**Understanding apriori outputs:**  
With \`trend\` ≠ 0, \`apriori_\` is expressed at the latest origin basis, while \`detrended_apriori_\` maps back to each origin’s basis (the detrended vector is what the estimator actually uses).

**Input / Output:**
- **Input:** \`X\` cumulative loss Triangle; \`sample_weight\` Triangle (exposure/premium—use \`latest_diagonal\`); optional \`Development\`/\`Tail\`; hyperparameters \`trend\`, \`decay\`, \`n_iters\` (Benktander iterations), \`groupby\`.
- **Output:** \`ultimate_\`, \`ibnr_\`, \`apriori_\`, \`detrended_apriori_\` as Triangles.

**Critical Points:**
- **Always provide exposure** via \`sample_weight=exposure.latest_diagonal\`. Do **not** pass the full exposure triangle to \`fit\`; the estimator expects one value per origin.
- Use \`trend\` to common-base origins (latest); for more complex assumptions or rate changes, combine \`Trend\` and/or \`ParallelogramOLF\` with CapeCod in a Pipeline.
- \`decay < 1\` gives more weight to nearer origins when estimating apriori; default \`decay=1\` treats all origins equally.
- If you want Cape Cod logic but a fixed/judgmental ELR, use **BF** instead (apriori chosen externally); Cape Cod's apriori is estimated from data.
- **Tort reform adjustment:** (1) Adjust the loss triangle by multiplying by tort reform factors (e.g., 0.893 for -10.7%, 0.670 for -33.0%); (2) Run Cape Cod on the adjusted triangle with on-level premium; (3) Adjust results back to original level by dividing ultimates/IBNR by the tort reform factors. This ensures the apriori estimation sees consistent loss levels across origins.

**Version:** Tested against chainladder 0.8.x/0.9.x APIs (\`fit(..., sample_weight=...)\`, \`ultimate_\`, \`ibnr_\`, \`apriori_\`, \`detrended_apriori_\`).`,
	sources: [
		"chainladder‑python docs — CapeCod API",
		"chainladder‑python docs — IBNR Methods: CapeCod (concept, apriori, trend/decay)",
		"chainladder‑python gallery — CapeCod Onleveling (ParallelogramOLF + sample_weight pattern)",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
