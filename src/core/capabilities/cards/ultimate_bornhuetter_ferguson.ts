import { CapabilityCard } from "../card_registry"

export const ultimateBornhuetterFergusonCard: CapabilityCard = {
	id: "ultimate-bornhuetter-ferguson",
	version: "1.0.0",
	title: "Ultimates: Bornhuetter–Ferguson (ELR / apriori)",
	triggers: [
		{
			kind: "keyword",
			any: [
				"bornhuetter",
				"bf method",
				"bornhuetter-ferguson",
				"bornhuetter ferguson",
				"born-huetter",
				"expected loss ratio",
				"ELR method",
			],
		},
		{ kind: "regex", pattern: "\\b(bornhuetter|bf[\\s-]?method|expected[\\s-]?loss[\\s-]?ratio)\\b", flags: "i" },
	],
	importance: 5,
	content: `**Capability Card: Bornhuetter–Ferguson v1.0**

**What it does:**
Combines development and expected-loss techniques: ultimate = emerged losses + expected unreported (apriori × exposure × % unreported based on CDF). More stable at immature ages than pure chain‑ladder.

**Key API (chainladder‑python):**
\`cl.BornhuetterFerguson(apriori=1.0, apriori_sigma=0.0, random_state=None)\` with \`fit(X, sample_weight=...)\`.
- \`sample_weight\`: Triangle carrying the **exposure** or **prior ultimate** by origin (e.g., earned premium, policy count, or a Triangle of prior ultimates).
- \`apriori\`: Multiplier applied to \`sample_weight\). If \`sample_weight\` already represents prior **ultimates**, set \`apriori=1.0\`. \`apriori_sigma\` enables stochastic priors with bootstrap.

**When to use:**
- Immature origin periods, new programs/lines, or where ELR/prior is credible.
- You want smoother indications than chain‑ladder but still respect the pattern of percent reported/unreported.

**Canonical Implementation:**
\`\`\`python
import chainladder as cl
import pandas as pd
import numpy as np

# X: cumulative loss Triangle (paid or reported)
X = loss_tri

# === Option A — ELR on earned premium as exposure (apriori = ELR) ===
# Create premium triangle with same structure as loss triangle
premium_array = np.zeros_like(X.values)
for i, prem in enumerate(premium_by_origin):
    premium_array[0, 0, i, :] = prem
premium_tri = X.copy()
premium_tri.values = premium_array

pipe = cl.Pipeline(steps=[
    ('dev',  cl.Development(average='volume', n_periods=2)),
    ('tail', cl.TailConstant(tail=1.05)),
    ('model', cl.BornhuetterFerguson(apriori=0.70))  # 70% ELR
])
# Use latest_diagonal when passing exposure
pipe.fit(X, sample_weight=premium_tri.latest_diagonal)

ult  = pipe.named_steps.model.ultimate_
ibnr = pipe.named_steps.model.ibnr_

# Extract scalar totals: ALWAYS use .sum().sum() or .values.sum()
total_ult = ult.sum().sum()   # NOT just .sum()
total_ibnr = ibnr.sum().sum()

# === Option B — Use prior ultimates (ELR × premium) as apriori ===
# Calculate apriori ultimate by origin
apriori_ults = premium_by_origin * elr_by_origin

# Create apriori triangle
apriori_array = np.zeros_like(X.values)
for i, apriori in enumerate(apriori_ults):
    apriori_array[0, 0, i, :] = apriori
apriori_tri = X.copy()
apriori_tri.values = apriori_array

pipe2 = cl.Pipeline(steps=[
    ('dev', cl.Development(average='volume', n_periods=2)),
    ('tail', cl.TailConstant(tail=1.05)),
    ('model', cl.BornhuetterFerguson(apriori=1.0))  # apriori=1.0 when passing ultimates
])
pipe2.fit(X, sample_weight=apriori_tri.latest_diagonal)

ult2 = pipe2.named_steps.model.ultimate_
total_ult2 = ult2.sum().sum()
\`\`\`
- Passing exposure via \`sample_weight\) is the standard way to run expected‑loss family methods; using Chainladder ultimates as the prior via \`sample_weight\) with \`apriori=1\) is also supported.
- Pipelines pass \`sample_weight\) to the final estimator; \`set_fit_request(sample_weight=True)\` makes routing explicit.

**Input / Output:**
- **Input:** \`X\` cumulative loss Triangle; \`sample_weight\` Triangle (exposure or prior ultimates); dev/tail selection (e.g., \`Development\`, \`TailCurve\`) if you want explicit control of CDFs.
- **Output:** \`ultimate_\`, \`ibnr_\` as Triangles.
- **Value extraction:** \`triangle.sum()\` returns a Triangle (NOT scalar). Use \`triangle.sum().sum()\` for total scalar, \`triangle.to_frame()\` for origin-level DataFrame, or \`triangle.values\` for raw numpy array.

**Critical Points:**
- **Creating sample_weight Triangle:** Broadcast exposure/apriori values across all development periods by copying the loss triangle structure: \`premium_array = np.zeros_like(X.values); for i, val in enumerate(values): premium_array[0,0,i,:] = val; sample_tri = X.copy(); sample_tri.values = premium_array\`. Then pass \`sample_tri.latest_diagonal\` to fit().
- **Use .latest_diagonal:** Always pass \`sample_weight=apriori_tri.latest_diagonal\` (NOT the full triangle) when calling \`fit()\`. The BF method needs one value per origin.
- If \`sample_weight\` already equals prior **ultimate** by origin, set \`apriori=1.0\). If \`sample_weight\` is **exposure** (e.g., premium), set \`apriori = ELR\`.
- Control the development/tail explicitly with \`Development\` and \`TailCurve\) if selections matter; otherwise defaults are applied.
- For a stochastic BF, pair with \`BootstrapODPSample\) and set \`apriori_sigma\`/ \`random_state\`.
- Relationship: BF is the \`n=1\` case of Benktander (iterated BF); as \`n\\to\\infty\`, it approaches chain‑ladder.

**Version:** Tested with chainladder 0.8.x/0.9.x API (\`fit(..., sample_weight=...)\`, \`ultimate_\`, \`ibnr_\`).`,
	sources: [
		"chainladder‑python docs — BornhuetterFerguson",
		"chainladder‑python docs — IBNR Methods (Expected Loss / exposure & apriori)",
		"chainladder‑python docs — Pipeline",
		"Gallery: Benktander (BF vs CL relationship)",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
