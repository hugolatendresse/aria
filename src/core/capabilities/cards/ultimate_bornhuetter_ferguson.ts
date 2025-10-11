import { CapabilityCard } from "../card_registry"

export const ultimateBornhuetterFergusonCard: CapabilityCard = {
	id: "ultimate-bornhuetter-ferguson",
	version: "1.0.0",
	title: "Ultimates: Bornhuetter–Ferguson (ELR / apriori)",
	triggers: [
		{
			kind: "keyword",
			any: ["bornhuetter", "bf", "bornhuetter-ferguson", "expected loss", "ELR", "apriori", "prior", "ultimate", "IBNR"],
		},
		{ kind: "keyword", any: ["ultimate", "IBNR"], all: ["triangle"] },
		{
			kind: "regex",
			pattern: "\\b(apriori|expected\\s*loss\\s*ratio|exposure|premium|percent\\s*(un)?reported|cdf)\\b",
			flags: "i",
		},
	],
	importance: 5,
	content: `**Capability Card: Bornhuetter–Ferguson v1.0**

**What it does:**
Combines development and expected-loss techniques: ultimate = emerged losses + expected unreported (apriori × exposure × % unreported based on CDF). More stable at immature ages than pure chain‑ladder. :contentReference[oaicite:0]{index=0}

**Key API (chainladder‑python):**
\`cl.BornhuetterFerguson(apriori=1.0, apriori_sigma=0.0, random_state=None)\` with \`fit(X, sample_weight=...)\`.
- \`sample_weight\`: Triangle carrying the **exposure** or **prior ultimate** by origin (e.g., earned premium, policy count, or a Triangle of prior ultimates).
- \`apriori\`: Multiplier applied to \`sample_weight\). If \`sample_weight\` already represents prior **ultimates**, set \`apriori=1.0\`. \`apriori_sigma\` enables stochastic priors with bootstrap. :contentReference[oaicite:1]{index=1}

**When to use:**
- Immature origin periods, new programs/lines, or where ELR/prior is credible.
- You want smoother indications than chain‑ladder but still respect the pattern of percent reported/unreported. :contentReference[oaicite:2]{index=2}

**Canonical Implementation:**
\`\`\`python
import chainladder as cl

# X: cumulative loss Triangle (paid or reported)
X = loss_tri

# === Option A — ELR on earned premium as exposure (apriori = ELR) ===
premium = prem_tri.latest_diagonal  # exposure by origin as a Triangle
pipe = cl.Pipeline(steps=[
    ('dev',  cl.Development(average='volume')),
    ('tail', cl.TailCurve(curve='exponential')),  # optional
    ('model', cl.BornhuetterFerguson(apriori=0.70))  # 70% ELR
])
# Route sample_weight through the pipeline to the final estimator
pipe.set_fit_request(sample_weight=True)
pipe.fit(X, sample_weight=premium)

ult  = pipe.named_steps.model.ultimate_
ibnr = pipe.named_steps.model.ibnr_

# === Option B — Use Chainladder ultimates as the apriori (apriori = 1.0) ===
cl_pipe = cl.Pipeline(steps=[
    ('dev',  cl.Development(average='volume')),
    ('tail', cl.TailCurve(curve='exponential')),
    ('cl',   cl.Chainladder())
]).fit(X)
apriori_ulims = cl_pipe.named_steps.cl.ultimate_

bf = cl.BornhuetterFerguson(apriori=1.0).fit(X, sample_weight=apriori_ulims)
ult2 = bf.ultimate_
\`\`\`
- Passing exposure via \`sample_weight\) is the standard way to run expected‑loss family methods; using Chainladder ultimates as the prior via \`sample_weight\) with \`apriori=1\) is also supported. :contentReference[oaicite:3]{index=3}
- Pipelines pass \`sample_weight\) to the final estimator; \`set_fit_request(sample_weight=True)\` makes routing explicit. :contentReference[oaicite:4]{index=4}

**Input / Output:**
- **Input:** \`X\` cumulative loss Triangle; \`sample_weight\` Triangle (exposure or prior ultimates); dev/tail selection (e.g., \`Development\`, \`TailCurve\`) if you want explicit control of CDFs.
- **Output:** \`ultimate_\`, \`ibnr_\` as Triangles.
- **Value extraction:** \`triangle.sum()\` returns a Triangle (NOT scalar). Use \`triangle.sum().sum()\` for total scalar, \`triangle.to_frame()\` for origin-level DataFrame, or \`triangle.values\` for raw numpy array. :contentReference[oaicite:5]{index=5}

**Critical Points:**
- Ensure \`sample_weight\` aligns with \`X\` (same origin index; broadcast across development if needed). Use Triangle ops or the estimator’s \`intersection\` helper to align indices. :contentReference[oaicite:6]{index=6}
- If \`sample_weight\` already equals prior **ultimate** by origin, set \`apriori=1.0\). If \`sample_weight\` is **exposure** (e.g., premium), set \`apriori = ELR\`. :contentReference[oaicite:7]{index=7}
- Control the development/tail explicitly with \`Development\` and \`TailCurve\) if selections matter; otherwise defaults are applied. :contentReference[oaicite:8]{index=8}
- For a stochastic BF, pair with \`BootstrapODPSample\) and set \`apriori_sigma\`/ \`random_state\`. :contentReference[oaicite:9]{index=9}
- Relationship: BF is the \`n=1\` case of Benktander (iterated BF); as \`n\\to\\infty\`, it approaches chain‑ladder. :contentReference[oaicite:10]{index=10}

**Version:** Tested with chainladder 0.8.x/0.9.x API (\`fit(..., sample_weight=...)\`, \`ultimate_\`, \`ibnr_\`). :contentReference[oaicite:11]{index=11}`,
	sources: [
		"chainladder‑python docs — BornhuetterFerguson",
		"chainladder‑python docs — IBNR Methods (Expected Loss / exposure & apriori)",
		"chainladder‑python docs — Pipeline",
		"Gallery: Benktander (BF vs CL relationship)",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
