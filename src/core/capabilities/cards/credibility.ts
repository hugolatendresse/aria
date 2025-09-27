import { CapabilityCard } from "../card_registry"

/**
 * 1) Classical Credibility (Limited Fluctuation)
 */
export const classicalLimitedFluctuationCredibilityCard: CapabilityCard = {
	id: "credibility-classical-limited-fluctuation",
	version: "1.0.0",
	title: "Classical Credibility (Limited Fluctuation)",
	triggers: [
		{
			kind: "keyword",
			any: ["limited fluctuation", "classical credibility", "square root rule"],
		},
		{
			kind: "regex",
			pattern: "\\b(complement of credibility|ASOP\\s*25|Nf|p-value|confidence|tolerable error|k)\\b",
			flags: "i",
		},
	],
	importance: 5,
	content: `**Capability Card: Classical Credibility (Limited Fluctuation)**

**Core idea.** Assign Z to the observed (subject) experience and (1−Z) to related experience:
\`Estimate = Z × Observed + (1 − Z) × Related\`.

**Required Steps:**
1. **Specify confidence and precision.** Select confidence \(p\) and tolerable relative error \(k\). Obtain \(z = z_{(p+1)/2}\) from the Standard Normal.
2. **Full-credibility standard.**
   - **Claim count** (Poisson, homogeneous exposures, constant severity): 
     \\(N_f = (z/k)^2\\).
   - **Pure premium with variable severity**: adjust for severity variation using the severity coefficient of variation (CV):
     \\(N_f = (z/k)^2\\,\\big(1 + \\text{CV}_S^2\\big)\\).
   - **Full-credibility exposures**: \\(\\text{Exposures}_f = N_f / \\text{expected frequency}\\).
3. **Credibility assignment (square–root rule).** For observed claims/exposure‑weighted counts \(N\):  
   \\[
   Z = \\min\\Big(1, \\sqrt{N / N_f}\\Big).
   \\]
   Cap Z in [0,1].
4. **Select the complement of credibility** (the “related” component).
   - Must be explainable, adjustably similar to subject experience (jurisdiction, peril, class mix, trend).
   - Examples: all‑territory/industry mean, GLM indicated by broader data, prior rate level, larger geographic group, or multi‑year aggregate.
5. **Blend.** Report: (i) \(p,k,z,N_f,N,Z\); (ii) complement definition & adjustments; (iii) final estimate.

**Implementation notes:**
- Make all assumptions explicit: homogeneity, Poisson frequency, (optionally) constant severity. If constant severity is rejected, use the severity‑adjusted \(N_f\).
- If the problem supplies a credibility table (e.g., 90%/±5%), respect it.
- Do not allow negative Z or Z > 1; apply capping.

**Common pitfalls & checks:**
- Using exposures directly as \(N\) without translating via expected frequency.
- Ignoring severity variation when blending pure premiums.
- Selecting complements that are not comparable or not adjusted for mix/trend. 

**Python module usage:**
\`\`\`python
# Install: pip install ratemaking-tools
from ratemaking_tools.credibility import (
    classical_full_credibility_frequency,
    classical_full_credibility_pure_premium, 
    classical_partial_credibility
)

# Calculate full credibility standard
n_full = classical_full_credibility_frequency(p=0.95, k=0.05)

# For pure premium with severity variation
# n_full = classical_full_credibility_pure_premium(cv_sev=0.3, p=0.95, k=0.05)

# Calculate credibility factor  
z = classical_partial_credibility(n=observed_claims, n_full=n_full)

# Apply credibility blend
estimate = z * observed_rate + (1 - z) * complement_rate
\`\`\`

**Implementation approach:** Write complete Python scripts using these functions rather than manual calculations.

**Output template (embed in solution):**
- Inputs: \(p, k, z, N, N_f\), complement description
- Z: \`min(1, sqrt(N/Nf))\` 
- Estimate: \`Z*Observed + (1-Z)*Related\``,
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
		{ kind: "keyword", any: ["Bühlmann", "Buhlmann", "Bühlmann-Straub", "structure parameter", "EPV", "VHM", "K"] },
		{ kind: "regex", pattern: "\\b(prior|collective mean|hypothetical means)\\b", flags: "i" },
	],
	importance: 5,
	content: `**Capability Card: Bühlmann Credibility v1.0**

**Method guardrails:** Compute **μ** (collective mean), **EPV** (process variance), **VHM** (variance of hypothetical means), **K = EPV/VHM**, then per risk \`Z_i = n_i / (n_i + K)\` (or \`m_i\` exposures in Bühlmann–Straub). Estimate with nonparametric moments; data must be reasonably homogeneous/stationary. :contentReference[oaicite:3]{index=3}

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
from ratemaking_tools.credibility import (
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
- Forgetting that the **complement is the collective mean μ** in Bühlmann; document how μ is formed. :contentReference[oaicite:4]{index=4}`,
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
	importance: 5,
	content: `**Capability Card: Bayesian Credibility v1.0**

**Method guardrails:** Use a defensible conjugate prior and show the **posterior mean as a credibility blend** of the sample statistic and prior mean. Always disclose prior hyperparameters and their interpretation (e.g., 'prior β acts like prior exposure'). :contentReference[oaicite:5]{index=5}

**Python module usage:**
\`\`\`python
from ratemaking_tools.credibility import (
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
