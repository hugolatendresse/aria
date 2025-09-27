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
			any: ["credibility", "limited fluctuation", "classical credibility", "full credibility", "square root rule"],
		},
		{
			kind: "regex",
			pattern: "\\b(complement of credibility|ASOP\\s*25|Nf|p-value|confidence|tolerable error|k)\\b",
			flags: "i",
		},
	],
	importance: 5,
	short: "Compute full-credibility standard from (p,k), apply square-root rule Z=min(1,√(N/Nf)), then blend with a vetted complement.",
	long: `**Capability Card: Classical Credibility (Limited Fluctuation)**

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

**Output template (embed in solution):**
- Inputs: \(p, k, z, N, N_f\), complement description
- Z: \`min(1, sqrt(N/Nf))\`
- Estimate: \`Z*Observed + (1-Z)*Related\``,
	sources: [
		"Werner & Modlin, Basic Ratemaking, Ch. 12: Classical credibility definitions, full-credibility standards, square-root rule, complement guidance (pp. 217–220, 224).",
	],
	safetyTags: ["actuarial", "pricing", "credibility"],
}

/**
 * 2) Bühlmann (Least-Squares) Credibility
 */
export const buhlmannCredibilityCard: CapabilityCard = {
	id: "credibility-buhlmann",
	version: "1.0.0",
	title: "Bühlmann Credibility (Least Squares)",
	triggers: [
		{ kind: "keyword", any: ["Bühlmann", "Buhlmann", "least squares credibility", "EVPV", "VHM", "K", "Bühlmann–Straub"] },
		{ kind: "regex", pattern: "\\b(prior mean|K\\s*=\\s*EVPV\\s*/\\s*VHM|credibility parameter)\\b", flags: "i" },
	],
	importance: 5,
	short: "Use Z = N/(N+K) with K = EVPV/VHM; blend observed with prior mean. For varying weights, apply Bühlmann–Straub.",
	long: `**Capability Card: Bühlmann Credibility (Least Squares)**

**Estimator form.** \`Estimate = Z × Observed + (1 − Z) × PriorMean\`.

**Credibility factor.** 
- \\(Z = \\dfrac{N}{N + K}\\), with \\(K = \\text{EVPV}/\\text{VHM}\\).
  - EVPV = expected value of process variance (within‑risk variability).
  - VHM = variance of hypothetical means (between‑risk variability).
- Interpret K as “average risk variance vs. variance between risks.”

**When exposures/weights vary (Bühlmann–Straub).**
- Replace \(N\) by a weight \(w\\) (e.g., earned exposure, expected claim count). Use:
  \\(Z = w/(w + K)\\).
- Prior mean is the complement.

**Procedure:**
1. **Inputs:** Observed statistic (e.g., pure premium), weight \(N\) or \(w\), prior mean \(m\), and \(K\).
2. **Compute Z:** \`Z = N/(N+K)\` (or \(w/(w+K)\)).
3. **Blend:** \`Estimate = Z*Observed + (1-Z)*m\`.
4. **Disclose assumptions:** Stationarity (no structural shifts in risk or process), EVPV and VHM applicable to the context.
5. **Document K source:** model‑based (subject to model error) or empirical (subject to sampling error).

**Checks:**
- If VHM = 0 ⇒ K → ∞ ⇒ Z → 0; the data carry no cross‑sectional signal under those assumptions.
- Cap Z in [0,1]. Guard against negative or ill‑conditioned variance estimates.

**Reporting template:**
- Inputs: Observed, \(N\)/\(w\), \(m\), EVPV, VHM, \(K\)
- Z and final \`Estimate\`
- Rationale for \(K\) and prior mean`,
	sources: [
		"Werner & Modlin, Basic Ratemaking, Ch. 12: Bühlmann credibility Z=N/(N+K), K=EVPV/VHM, assumptions & interpretation (pp. 221–223).",
	],
	safetyTags: ["actuarial", "pricing", "credibility"],
}

/**
 * 3) Bayesian Credibility (Posterior Updating)
 */
export const bayesianCredibilityCard: CapabilityCard = {
	id: "credibility-bayesian",
	version: "1.0.0",
	title: "Bayesian Credibility (Posterior Mean)",
	triggers: [
		{
			kind: "keyword",
			any: ["Bayesian", "Bayes", "posterior", "conjugate prior", "Gamma-Poisson", "Beta-Binomial", "Normal-Normal"],
		},
		{ kind: "regex", pattern: "\\b(posterior mean|prior hyperparameters|conjugate)\\b", flags: "i" },
	],
	importance: 5,
	short: "Specify likelihood + prior; compute posterior; use posterior mean as estimate. Often equivalent to least-squares credibility.",
	long: `**Capability Card: Bayesian Credibility**

**Core idea.** No explicit Z: update a prior distribution with observed data via Bayes’ Theorem and use the posterior mean (or other posterior functional) as the estimate.

**Procedure (generic):**
1. **Choose a likelihood** for the data (e.g., Poisson for frequency, Binomial for hit/miss, Normal for severity).
2. **Choose a conjugate prior** for tractable updating (Gamma for Poisson rate, Beta for Binomial probability, Normal for Normal mean with known variance).
3. **Update hyperparameters** with sufficient statistics (e.g., claims and exposure for Poisson; successes and trials for Binomial; sample mean/variance and n for Normal).
4. **Estimate:** Use the **posterior mean** (or median if specified). In many conjugate cases, this can be written in a credibility form that mirrors least‑squares credibility: \`Estimate = Z*Observed + (1−Z)*PriorMean\`.
5. **Report:** Prior choice and parameters, observed sufficient statistics, posterior parameters, posterior estimate. State model assumptions and sensitivity.

**Examples (conjugate forms commonly used in actuarial work):**
- **Poisson–Gamma** (frequency): prior \\(\\text{Gamma}(\\alpha,\\beta)\\) on rate; with total exposure \\(w\\) and claims \\(c\\), posterior \\(\\text{Gamma}(\\alpha+c,\\beta+w)\\); posterior mean \\(=(\\alpha+c)/(\\beta+w)\\).
- **Beta–Binomial** (hit probability): prior \\(\\text{Beta}(a,b)\\); with successes \\(x\\) of \\(n\\), posterior \\(\\text{Beta}(a+x,b+n-x)\\); posterior mean \\(=(a+x)/(a+b+n)\\).
- **Normal–Normal** (severity or pure premium with known variance): posterior mean is a precision‑weighted average of sample mean and prior mean.

**Notes:**
- Hyperparameter selection is part of the modeling decision; document elicitation or reference‑based choices.
- In special cases, the Bayesian posterior mean equals the least‑squares (Bühlmann) credibility estimate.`,
	sources: [
		"Werner & Modlin, Basic Ratemaking, Ch. 12: Bayesian analysis overview and equivalence to least-squares credibility in special cases (p. 223).",
	],
	safetyTags: ["actuarial", "pricing", "credibility"],
}
