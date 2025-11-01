import { CapabilityCard } from "../card_registry"

/**
 * 1) Classical Credibility (Limited Fluctuation)
 */
export const classicalLimitedFluctuationCredibilityCard: CapabilityCard = {
	id: "credibility-classical-limited-fluctuation",
	version: "1.1.0",
	title: "Classical Credibility (Limited Fluctuation)",
	triggers: [
		{
			kind: "keyword",
			any: ["limited fluctuation", "classical credibility", "square root rule", "credibility"],
		},
		{
			kind: "regex",
			pattern: "\\b(complement of credibility|ASOP\\s*25|Nf|p-value|confidence|tolerable error)\\b",
			flags: "i",
		},
	],
	content: `**Capability Card: Classical Credibility (Limited Fluctuation)**

**Formula:** \`Estimate = Z × Observed + (1 − Z) × Related\`

**Credibility Factor:** \\(Z = \\min\\big(1, \\sqrt{N / N_f}\\big)\\)

where:
- \`N\` = observed number of claims  
- \`N_f\` = full credibility standard (claims needed for full credibility)
- Cap Z at 1.0 (never > 1.0)

---

## Implementation - Two Scenarios

### SCENARIO A: Problem Provides N_f Directly

**When problem states:** "Total claims: 700, Claims for full credibility: 1082"

\`\`\`python
import numpy as np

total_claims = 700
claims_for_full_credibility = 1082

# Calculate Z directly - DO NOT call credibility functions
z = np.sqrt(total_claims / claims_for_full_credibility)
z = min(z, 1.0)  # Cap at 1.0

# Apply blend
credibility_weighted_estimate = z * observed_value + (1 - z) * complement_value
\`\`\`

### SCENARIO B: Problem Provides p (Confidence) and k (Error)

**SCENARIO B1: Frequency-Only (Constant Severity)**

**When problem states:** "90% confidence, ±5% tolerable error" for claim counts/frequency

\`\`\`python
from ratemaking.credibility import (
    classical_full_credibility_frequency,
    classical_partial_credibility
)

# Step 1: Calculate N_f for frequency-only
n_full = classical_full_credibility_frequency(p=0.90, k=0.05)
# p = confidence level (MUST be > 0.5, like 0.80, 0.90, 0.95)
# k = tolerable relative error (e.g., 0.05 for ±5%)

# Step 2: Calculate Z
total_claims = 700
z = classical_partial_credibility(n=total_claims, n_full=n_full)
# Use parameter name 'n', not 'observed_claims'

# Step 3: Apply blend
credibility_weighted_estimate = z * observed_value + (1 - z) * complement_value
\`\`\`

**SCENARIO B2: Pure Premium with Severity Variation**

**When problem states:** "90% confidence, ±5% tolerable error, severity CV = 0.30"

\`\`\`python
from ratemaking.credibility import (
    classical_full_credibility_pure_premium,
    classical_partial_credibility
)

# Step 1: Calculate N_f adjusted for severity variation
severity_cv = 0.30  # Coefficient of variation of severity
n_full = classical_full_credibility_pure_premium(
    cv_sev=severity_cv,
    p=0.90,
    k=0.05
)
# Formula: N_f = (z/k)^2 * (1 + CV_S^2)
# Adjusts for variable severity

# Step 2: Calculate Z
total_claims = 700
z = classical_partial_credibility(n=total_claims, n_full=n_full)

# Step 3: Apply blend to pure premium
credibility_weighted_pure_premium = z * observed_pp + (1 - z) * complement_pp
\`\`\`

---

## Parameter Requirements

**classical_full_credibility_frequency(p, k):**
- Use for: Frequency/claim count credibility (constant severity assumption)
- \`p\`: Confidence - MUST be in (0.5, 0.999999)
  - CORRECT: 0.90, 0.95
  - WRONG: 0.05, 0.10, 0.50
- \`k\`: Tolerable error (e.g., 0.05)
- Returns: N_f for frequency

**classical_full_credibility_pure_premium(cv_sev, p, k):**
- Use for: Pure premium credibility (variable severity)
- \`cv_sev\`: Coefficient of variation of severity (e.g., 0.30)
- \`p\`: Confidence - MUST be in (0.5, 0.999999)
- \`k\`: Tolerable error
- Returns: N_f adjusted for severity variation
- Formula: \\(N_f = (z/k)^2 \\times (1 + \\text{CV}_S^2)\\)

**classical_partial_credibility(n, n_full):**
- \`n\`: Observed claims (use 'n', not 'observed_claims')
- \`n_full\`: Full credibility standard from above
- Returns: Z between 0 and 1

---

## Common Errors

**ERROR 1: Using functions when N_f is provided**
\`\`\`python
# GIVEN: "Claims for full credibility: 1082"
# WRONG - N_f is already provided!
n_full = classical_full_credibility_frequency(p=0.90, k=0.05)

# CORRECT - Use it directly
z = np.sqrt(700 / 1082)
\`\`\`

**ERROR 2: Using p < 0.5**
\`\`\`python
# WRONG - p=0.05 means 5% confidence (fails validation)
n_full = classical_full_credibility_frequency(p=0.05, k=0.05)

# CORRECT - p=0.90 means 90% confidence
n_full = classical_full_credibility_frequency(p=0.90, k=0.05)
\`\`\`

**ERROR 3: Wrong parameter name**
\`\`\`python
# WRONG
z = classical_partial_credibility(observed_claims=700, n_full=1082)

# CORRECT - parameter is 'n'
z = classical_partial_credibility(n=700, n_full=1082)
\`\`\`

---

## Decision Tree

\`\`\`
Is "claims for full credibility" (N_f) provided?
  ├─ YES → Use np.sqrt(n / nf) directly
  └─ NO → Is confidence (p) and error (k) provided?
       ├─ YES → Choose based on what's being blended:
       │        ├─ Frequency/claim counts → classical_full_credibility_frequency(p, k)
       │        └─ Pure premium (freq × sev) → classical_full_credibility_pure_premium(cv_sev, p, k)
       │        Then: classical_partial_credibility(n, n_full)
       └─ NO → Ask for clarification or assume p=0.90, k=0.05
\`\`\`

**When to use which function:**
- **Frequency-only**: Use \`classical_full_credibility_frequency\` when blending claim counts or frequencies (assumes constant severity)
- **Pure premium**: Use \`classical_full_credibility_pure_premium\` when blending pure premiums (frequency × severity, accounts for severity variation)`,
	sources: [
		"Werner & Modlin, Basic Ratemaking, Ch. 12: Classical credibility definitions, full-credibility standards, square-root rule, complement guidance (pp. 217–220, 224).",
	],
	safetyTags: ["actuarial", "pricing", "credibility"],
}

export const credibilityBuhlmannCard: CapabilityCard = {
	id: "credibility-buhlmann-advanced",
	version: "1.0.0",
	title: "Credibility — Bühlmann / Bühlmann–Straub",
	triggers: [
		{ kind: "keyword", any: ["Bühlmann", "Buhlmann", "Bühlmann-Straub", "structure parameter", "EPV", "VHM"] },
		{ kind: "regex", pattern: "\\b(prior|collective mean|hypothetical means)\\b", flags: "i" },
	],
	content: `**Capability Card: Bühlmann Credibility v1.0**

**Method guardrails:** Compute **μ** (collective mean), **EPV** (process variance), **VHM** (variance of hypothetical means), **K = EPV/VHM**, then per risk \`Z_i = n_i / (n_i + K)\` (or \`m_i\` exposures in Bühlmann–Straub). Estimate with nonparametric moments; data must be reasonably homogeneous/stationary.

**Required Steps:**
1) **Define cells/risks** and the per‑period observations (and exposures when unequal).
2) **Pick model**:
   - Equal weights (Bühlmann): use \`buhlmann(BuhlmannInputs)\`.
   - Unequal exposures (Bühlmann–Straub): use \`buhlmann_straub(BuhlmannStraubInputs)\`.
3) **Compute components** (tool returns μ, EPV, VHM, K, Zᵢ, and estimates).
4) **Final estimates**: \`Z_i * risk_mean_i + (1 - Z_i) * μ\`.
5) **Diagnostics**: sanity check μ vs complement; EPV>0, VHM≥0; explain any shrinkage extremes (Z≈0 or 1).

**Python module usage:**
\`\`\`python
from ratemaking.credibility import (
    BuhlmannInputs, BuhlmannStraubInputs, 
    buhlmann, buhlmann_straub
)

# For equal weights (classic Bühlmann)
data = {"risk_1": [1.2, 1.5, 1.1], "risk_2": [2.1, 1.9, 2.3]}
inputs = BuhlmannInputs(data=data)
result = buhlmann(inputs)

# For unequal weights (Bühlmann-Straub)
# observations = [("risk_1", 1.2, 100), ("risk_1", 1.5, 120), ("risk_2", 2.1, 80)]
# inputs = BuhlmannStraubInputs(observations=observations)
# result = buhlmann_straub(inputs)

# Access results
print(f"Collective mean (μ): {result.mu}")
print(f"K parameter: {result.K}")
print(f"Credibility by risk: {result.Z_by_risk}")
print(f"Final estimates: {result.estimate_by_risk}")
\`\`\`

**Implementation approach:** Import the module and use the dataclasses and functions for calculations.

**Common pitfalls:**
- Using wildly heterogeneous risks in a single pool (inflates EPV, deflates VHM, distorts K).
- Forgetting that the **complement is the collective mean μ** in Bühlmann; document how μ is formed.`,
	sources: ["Werner & Modlin, *Basic Ratemaking* — Chapter 12 (CAS)"],
	safetyTags: ["actuarial", "credibility"],
}

export const credibilityBayesianCard: CapabilityCard = {
	id: "credibility-bayesian-advanced",
	version: "1.0.0",
	title: "Credibility — Bayesian (Conjugate Families)",
	triggers: [
		{ kind: "keyword", any: ["Bayesian", "Gamma-Poisson", "Beta-Binomial", "Normal-Normal", "posterior", "prior"] },
		{ kind: "regex", pattern: "\\b(prior mean|posterior mean|conjugate|hyperparameter)\\b", flags: "i" },
	],
	content: `**Capability Card: Bayesian Credibility v1.0**

**Method guardrails:** Use a defensible conjugate prior and show the **posterior mean as a credibility blend** of the sample statistic and prior mean. Always disclose prior hyperparameters and their interpretation (e.g., 'prior β acts like prior exposure').

**Python module usage:**
\`\`\`python
from ratemaking.credibility import (
    bayes_poisson_gamma,
    bayes_beta_binomial,
    bayes_normal_known_var
)

# Poisson-Gamma example (frequency modeling)
result = bayes_poisson_gamma(
    prior_alpha=2.0, prior_beta=100.0,
    total_counts=15, total_exposure=120
)
print(f"Posterior mean: {result.mean}")
print(f"Credibility weight: {result.credibility_Z}")
print(f"Prior mean: {result.prior_mean}")
print(f"Sample rate: {result.sample_rate}")

# Beta-Binomial example (hit/miss modeling)
# result = bayes_beta_binomial(prior_a=1, prior_b=1, successes=8, trials=20)

# Normal-Normal example (severity with known variance)
# result = bayes_normal_known_var(prior_mean=1000, prior_var=10000, 
#                                sample_mean=1200, known_var=25000, n=50)
\`\`\`

**Implementation approach:** Use conjugate updating functions to compute Bayesian credibility estimates.

**Procedure:**
1) Specify a prior consistent with historical/industry knowledge; document it.
2) Compute the posterior with the tool and **report: prior mean, sample statistic, Z, posterior mean**.
3) If needed, map the posterior to pricing quantities (e.g., pure premium = freq × severity).

**Common pitfalls:**
- Hiding prior strength; always quantify (e.g., 'β=400 exposure equivalents').
- Combining Bayesian updates with separate classical Z on the same target (double-shrinking).`,
	sources: ["Werner & Modlin, *Basic Ratemaking* — Chapter 12 (CAS)"],
	safetyTags: ["actuarial", "credibility"],
}
