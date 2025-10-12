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
# loss_tri: cl.Triangle already aligned by origin/development
X = loss_tri

# Core Chain Ladder with (volume) average link ratios and a simple tail
dev = cl.Development(average='volume')
tail = cl.TailCurve(method='exponential')   # optional; can be None

# Deterministic chain ladder (ultimates + IBNR)
clm = cl.Chainladder(development=dev, tail=tail)
clm.fit(X)

ult  = clm.ultimate_   # Triangle of ultimates
ibnr = clm.ibnr_       # Triangle of IBNR
ldf  = clm.ldf_        # selected age-to-age factors
cdf  = clm.cdf_        # cumulative-to-ultimate factors

# Mack variability (standard errors by origin)
mack = cl.MackChainladder(development=dev, tail=tail)
mack.fit(X)
mse_ult = mack.std_ultimate_  # or mack.std_reserve_ depending on need
\`\`\`

**Input/Output:**
- **Input:** X: cl.Triangle (cumulative loss), options for averaging (volume/simple), tail selection, exclusions
- **Output:** ultimate_, ibnr_, ldf_, cdf_; with Mack: std_ultimate_ / std_reserve_

**Critical Points:**
- Supply **cumulative** data; if you have incremental, cumulate first and validate triangles for structural zeros/outliers.
- Apply any calendar‑year adjustments (e.g., on‑leveling, mix shifts) **before** fitting if they materially affect link ratios (parallelogram on‑level technique for premium/exposure adjustment is documented in CAS *Basic Ratemaking*). :contentReference[oaicite:0]{index=0}
- Choose averaging (volume vs. simple) consistently across ages; consider excluding erratic early/late ages and select a defensible tail.
- Keep grain consistent (AY/PY, annual vs. quarterly) and align indexes; watch for sparse latest diagonals.
- Document any manual overrides to LDFs/CDFs; preserve reproducibility with a parameterized pipeline.

**Version:** Tested with chainladder 0.8.x. API: cl.Chainladder(...).fit(X) → attributes ultimate_/ibnr_/ldf_/cdf_; cl.MackChainladder adds std_ultimate_ / std_reserve_ diagnostics.`,
	sources: ["chainladder-python docs v0.8.x", "Mack (1993)", "CAS Basic Ratemaking (parallelogram on-level)"],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
