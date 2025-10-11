import { CapabilityCard } from "../card_registry"

export const ultimateChainladderCard: CapabilityCard = {
	id: "ultimate-chainladder",
	version: "1.0.0",
	title: "Ultimates: Chain Ladder (LDF / link‑ratio)",
	triggers: [
		{
			kind: "keyword",
			any: ["chain ladder", "chainladder", "link ratio", "ldf", "cdf", "mack", "ultimate", "IBNR", "tail", "bootstrap"],
		},
		{ kind: "keyword", any: ["ultimate", "IBNR"], all: ["triangle"] },
		{ kind: "regex", pattern: "\\b(ldf|cdf|link[- ]?ratio|mack|tail|std|mse|sigma|reserve)s?\\b", flags: "i" },
	],
	importance: 5,
	content: `**Capability Card: Chain Ladder (Link‑Ratio) v1.0**

**What it does:**
Fits age‑to‑age link ratios (LDFs), derives CDFs and an optional tail factor, then projects ultimate losses by origin. Optionally applies Mack's distribution‑free variance model to get standard errors on reserves.

**When to use:**
- You have a cumulative loss Triangle (paid or reported) with credible development history
- You need a transparent baseline reserving method and/or Mack variability

**Canonical Implementation:**
\`\`\`python
import chainladder as cl

# X: cumulative loss Triangle (paid or reported)
X = loss_tri

# Pipeline approach - chains development, tail, and model together
pipe = cl.Pipeline(steps=[
    ('dev', cl.Development(average='volume')),
    ('tail', cl.TailCurve(curve='exponential')),  # or cl.TailConstant(tail=1.05)
    ('model', cl.Chainladder())
])

pipe.fit(X)

# Access results via named_steps
ult  = pipe.named_steps.model.ultimate_   # Triangle of ultimates
ibnr = pipe.named_steps.model.ibnr_       # Triangle of IBNR
ldf  = pipe.named_steps.model.ldf_        # selected age-to-age factors
cdf  = pipe.named_steps.model.cdf_        # cumulative-to-ultimate factors

# Extract values (Triangle.sum() returns scalar, not Triangle)
total_ult = float(ult.sum())              # Total across all origins
ult_df = ult.to_frame()                   # Convert to DataFrame
ult_array = ult.values                    # Get numpy array (shape: 1,1,n_origins,1)
\`\`\`

**Input/Output:**
- **Input:** X: cl.Triangle (cumulative loss), options for averaging (volume/simple), tail selection, exclusions
- **Output:** ultimate_, ibnr_, ldf_, cdf_; with Mack: std_ultimate_ / std_reserve_

**Critical Points:**
- Supply **cumulative** data; if you have incremental, cumulate first and validate triangles for structural zeros/outliers.
- **Use Pipeline:** Chains estimators into single object for reproducibility. Steps are named ('dev', 'tail', 'model') for easy access via \`pipe.named_steps.model.ultimate_\`.
- **Value extraction:** \`triangle.sum()\` returns a scalar (np.float64), NOT a Triangle. Use \`float(triangle.sum())\` directly. Do NOT use \`.sum().values[0,0,0,0]\` which will fail.
- Apply any calendar‑year adjustments (e.g., on‑leveling, mix shifts) **before** fitting if they materially affect link ratios (parallelogram on‑level technique for premium/exposure adjustment is documented in CAS *Basic Ratemaking*).
- **Tail options:** Use \`TailConstant(tail=1.05)\` for fixed tail factor, \`TailCurve\` for fitted curves. TailConstant supports \`decay\` parameter for exponential decay over projection periods.
- Choose averaging (volume vs. simple) consistently across ages; consider excluding erratic early/late ages and select a defensible tail.
- Keep grain consistent (AY/PY, annual vs. quarterly) and align indexes; watch for sparse latest diagonals.

**Version:** Tested with chainladder 0.8.x. API: cl.Pipeline(steps=[...]).fit(X) → pipe.named_steps.model.ultimate_/ibnr_/ldf_/cdf_; use MackChainladder() for std_ultimate_ / std_reserve_ diagnostics.`,
	sources: [
		"chainladder-python docs v0.8.x",
		"Mack (1993)",
		"CAS Basic Ratemaking (parallelogram on-level)",
		"https://chainladder-python.readthedocs.io/en/latest/user_guide/workflow.html",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
