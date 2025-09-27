"""
Actuarial credibility calculation tools

This module provides functions for:
- Classical (Limited Fluctuation) credibility
- Bühlmann and Bühlmann-Straub credibility  
- Bayesian credibility with conjugate priors

Usage:
    from src.core.capabilities.python.credibility_tools import classical_full_credibility_frequency
    n_full = classical_full_credibility_frequency(p=0.95, k=0.05)
    
    from src.core.capabilities.python.credibility_tools import BuhlmannInputs, buhlmann
    data = {"risk_1": [1.2, 1.5], "risk_2": [2.1, 1.9]}
    result = buhlmann(BuhlmannInputs(data=data))
    
    from src.core.capabilities.python.credibility_tools import bayes_poisson_gamma
    posterior = bayes_poisson_gamma(prior_alpha=2, prior_beta=100, 
                                   total_counts=15, total_exposure=120)
"""

from dataclasses import dataclass
from math import isfinite
from statistics import NormalDist
from typing import Dict, List, Tuple

# ----------------------------
# Utilities
# ----------------------------

def _z_two_sided(p: float) -> float:
    """
    Two-sided normal critical value: find z s.t. P(|Z| <= z) = p
    (i.e., z_{1 - α/2} where p = 1 - α).
    """
    if not (0.5 < p < 0.999999):
        raise ValueError("p must be in (0.5, 0.999999) for two-sided coverage")
    return NormalDist().inv_cdf((1 + p) / 2.0)


# ----------------------------
# Classical (Limited-Fluctuation) credibility
# ----------------------------

def classical_full_credibility_frequency(p: float, k: float) -> float:
    """
    Full-credibility standard for COUNT of claims under Poisson approximation:
      require expected number of claims n ≥ (z/k)^2
    where p = two-sided coverage (e.g., 0.95), k = relative tolerance (e.g., 0.10).
    Returns required expected number of claims n_full.
    """
    z = _z_two_sided(p)
    return (z / k) ** 2


def classical_full_credibility_severity(cv: float, p: float, k: float) -> float:
    """
    Full-credibility standard for the MEAN SEVERITY:
      require number of claims n ≥ (z * CV / k)^2
    where CV = sigma/mean of severity.
    Returns required number of claims n_full.
    """
    z = _z_two_sided(p)
    return (z * cv / k) ** 2


def classical_full_credibility_pure_premium(cv_sev: float, p: float, k: float) -> float:
    """
    Full-credibility standard for PURE PREMIUM per exposure (compound Poisson):
      relative variance ≈ (CV_X^2 + 1) / n, where n = expected #claims.
      require z^2 * (CV_X^2 + 1) / n ≤ k^2 ⇒ n ≥ z^2 * (CV_X^2 + 1) / k^2.
    Returns required expected number of claims n_full.
    """
    z = _z_two_sided(p)
    return (z ** 2) * (cv_sev ** 2 + 1.0) / (k ** 2)


def classical_partial_credibility(n: float, n_full: float) -> float:
    """
    Partial credibility weight:
      Z = min(1, sqrt(n / n_full))
    where n is the applicable exposure size metric (e.g., expected #claims).
    """
    if n_full <= 0:
        raise ValueError("n_full must be > 0")
    if n < 0:
        raise ValueError("n must be ≥ 0")
    from math import sqrt
    return min(1.0, sqrt(n / n_full))


# ----------------------------
# Bühlmann & Bühlmann–Straub
# ----------------------------

@dataclass
class BuhlmannInputs:
    # Equal weights (Bühlmann): observations grouped per risk
    # data[risk_id] = [x_t1, x_t2, ..., x_tn]
    data: Dict[str, List[float]]


@dataclass
class BuhlmannStraubInputs:
    # General weights (Bühlmann–Straub): list of (risk_id, value, weight)
    # weight is exposure (or credibility unit) for that observation
    observations: List[Tuple[str, float, float]]  # (risk_id, y, w) with w>0


@dataclass
class BuhlmannResult:
    mu: float         # collective mean
    EPV: float        # expected process variance
    VHM: float        # variance of hypothetical means
    K: float          # EPV/VHM (credibility constant)
    Z_by_risk: Dict[str, float]
    estimate_by_risk: Dict[str, float]  # Z * ybar_i + (1-Z) * mu


def _bm_component_estimates_equal_n(data: Dict[str, List[float]]) -> Tuple[float, float, float]:
    """
    Estimate μ (mu), EPV, VHM under Bühlmann with equal numbers per risk (n_i all equal).
    If n_i differ mildly, treat as 'approximately equal'; for strongly unequal exposures, use BS.
    """
    # Basic sanity
    r = len(data)
    if r < 2:
        raise ValueError("Need at least 2 risks for Bühlmann estimation.")
    n_list = [len(v) for v in data.values()]
    if min(n_list) < 2:
        raise ValueError("Each risk needs at least 2 observations for EPV estimation.")

    # Means
    risk_means = {k: (sum(v) / len(v)) for k, v in data.items()}
    all_vals: List[float] = [x for v in data.values() for x in v]
    mu = sum(all_vals) / len(all_vals)
    n = n_list[0]  # assume equal n

    # EPV: pooled within-risk variance
    ss_within = 0.0
    for k, v in data.items():
        m = risk_means[k]
        ss_within += sum((x - m) ** 2 for x in v)
    EPV = ss_within / (r * (n - 1))

    # VHM: between-risk variance minus EPV/n
    # unbiased between-groups variance
    from statistics import mean
    mean_of_risk_means = mean(risk_means.values())
    ss_between = sum((risk_means[k] - mean_of_risk_means) ** 2 for k in data)
    VHM = max((ss_between / (r - 1)) - (EPV / n), 0.0)

    return mu, EPV, VHM


def buhlmann(inputs: BuhlmannInputs) -> BuhlmannResult:
    """
    Bühlmann credibility (equal weights per time cell).
    Returns μ, EPV, VHM, K, Z_i and credibility estimates for each risk i.
    """
    mu, EPV, VHM = _bm_component_estimates_equal_n(inputs.data)
    if VHM == 0.0:
        K = float("inf")
    else:
        K = EPV / VHM

    # Risk sample sizes (assumes equal n but computes explicitly)
    n_by_risk = {k: len(v) for k, v in inputs.data.items()}
    ybar_by_risk = {k: (sum(v) / len(v)) for k, v in inputs.data.items()}

    Z_by_risk = {k: (n_by_risk[k] / (n_by_risk[k] + K)) if isfinite(K) else 0.0
                 for k in inputs.data}
    estimate_by_risk = {k: Z_by_risk[k] * ybar_by_risk[k] + (1.0 - Z_by_risk[k]) * mu
                        for k in inputs.data}
    return BuhlmannResult(mu=mu, EPV=EPV, VHM=VHM, K=K,
                          Z_by_risk=Z_by_risk, estimate_by_risk=estimate_by_risk)


def buhlmann_straub(inputs: BuhlmannStraubInputs) -> BuhlmannResult:
    """
    Bühlmann–Straub with general weights (exposures). Nonparametric moment estimators.
    observations: list of (risk_id, y, w), w>0
    """
    # Organize by risk
    by_risk: Dict[str, List[Tuple[float, float]]] = {}
    for rid, y, w in inputs.observations:
        if w <= 0:
            raise ValueError("Weights must be positive.")
        by_risk.setdefault(rid, []).append((y, w))

    if len(by_risk) < 2:
        raise ValueError("Need at least 2 risks for Bühlmann–Straub estimation.")

    # Weighted means per risk and overall
    m_i: Dict[str, float] = {rid: sum(w for _, w in obs) for rid, obs in by_risk.items()}
    ybar_i: Dict[str, float] = {
        rid: sum(w * y for y, w in obs) / m_i[rid] for rid, obs in by_risk.items()
    }
    M = sum(m_i.values())
    mu = sum(m_i[rid] * ybar_i[rid] for rid in by_risk) / M

    # EPV_hat (weighted within-risk)
    # Denominator uses effective df: sum_i (m_i - sum_j w_ij^2 / m_i)
    num_within = 0.0
    den_within = 0.0
    sum_wsq_over_mi = 0.0
    for rid, obs in by_risk.items():
        mi = m_i[rid]
        sum_wsq_over_mi_i = sum((w ** 2) / mi for _, w in obs)
        sum_wsq_over_mi += sum_wsq_over_mi_i
        num_within += sum(w * (y - ybar_i[rid]) ** 2 for y, w in obs)
        den_within += (mi - sum_wsq_over_mi_i)

    if den_within <= 0:
        raise ValueError("Insufficient within-risk degrees of freedom.")
    EPV = num_within / den_within

    # VHM_hat (between-risk, corrected for within component)
    # See standard nonparametric Bühlmann–Straub moment estimator.
    num_between = sum(m_i[rid] * (ybar_i[rid] - mu) ** 2 for rid in by_risk)
    den_between = M - sum_wsq_over_mi  # effective df for between
    raw_between = num_between / den_between if den_between > 0 else 0.0
    VHM = max(raw_between - EPV * (1.0 / den_between), 0.0) if den_between > 0 else 0.0

    K = (EPV / VHM) if VHM > 0 else float("inf")
    Z_by_risk = {rid: (m_i[rid] / (m_i[rid] + K)) if isfinite(K) else 0.0 for rid in by_risk}
    estimate_by_risk = {rid: Z_by_risk[rid] * ybar_i[rid] + (1.0 - Z_by_risk[rid]) * mu
                        for rid in by_risk}

    return BuhlmannResult(mu=mu, EPV=EPV, VHM=VHM, K=K,
                          Z_by_risk=Z_by_risk, estimate_by_risk=estimate_by_risk)


# ----------------------------
# Bayesian conjugate helpers
# ----------------------------

@dataclass
class PoissonGammaPosterior:
    alpha: float
    beta: float
    mean: float           # posterior mean of λ
    credibility_Z: float  # weight on sample rate vs prior mean (n / (n + beta))
    prior_mean: float
    sample_rate: float


def bayes_poisson_gamma(prior_alpha: float, prior_beta: float,
                        total_counts: float, total_exposure: float) -> PoissonGammaPosterior:
    """
    Conjugate update for Poisson rate λ with Gamma(α, β) prior (shape α, rate β).
    Observations: total_counts over total_exposure (so sample rate = counts/exposure).
    Posterior: α' = α + counts, β' = β + exposure.
    """
    if prior_alpha <= 0 or prior_beta <= 0:
        raise ValueError("Gamma prior α, β must be > 0.")
    if total_counts < 0 or total_exposure <= 0:
        raise ValueError("Counts ≥ 0 and exposure > 0 required.")

    alpha_p = prior_alpha + total_counts
    beta_p = prior_beta + total_exposure
    prior_mean = prior_alpha / prior_beta
    sample_rate = total_counts / total_exposure
    posterior_mean = alpha_p / beta_p

    # Credibility form: posterior_mean = Z * sample_rate + (1-Z) * prior_mean
    # For Gamma–Poisson, Z = total_exposure / (total_exposure + prior_beta)
    Z = total_exposure / (total_exposure + prior_beta)

    return PoissonGammaPosterior(alpha=alpha_p, beta=beta_p, mean=posterior_mean,
                                 credibility_Z=Z, prior_mean=prior_mean,
                                 sample_rate=sample_rate)


@dataclass
class BetaBinomialPosterior:
    a: float
    b: float
    mean: float
    credibility_Z: float  # n / (n + a + b)
    prior_mean: float
    sample_rate: float


def bayes_beta_binomial(prior_a: float, prior_b: float,
                        successes: int, trials: int) -> BetaBinomialPosterior:
    """
    Conjugate update for Bernoulli probability p with Beta(a,b) prior.
    Posterior: a' = a + s, b' = b + (n - s).
    Credibility form has weight n / (n + (a + b)).
    """
    if prior_a <= 0 or prior_b <= 0:
        raise ValueError("Beta prior a, b must be > 0.")
    if not (0 <= successes <= trials):
        raise ValueError("0 ≤ successes ≤ trials required.")
    a_p = prior_a + successes
    b_p = prior_b + (trials - successes)
    prior_mean = prior_a / (prior_a + prior_b)
    sample_rate = successes / trials if trials > 0 else 0.0
    mean = a_p / (a_p + b_p)
    Z = trials / (trials + prior_a + prior_b)
    return BetaBinomialPosterior(a=a_p, b=b_p, mean=mean, credibility_Z=Z,
                                 prior_mean=prior_mean, sample_rate=sample_rate)


@dataclass
class NormalNormalPosterior:
    mu: float
    tau2: float  # posterior variance of the mean
    credibility_Z: float  # weight on sample mean vs prior mean
    prior_mean: float
    sample_mean: float


def bayes_normal_known_var(prior_mean: float, prior_var: float,
                           sample_mean: float, known_var: float, n: int) -> NormalNormalPosterior:
    """
    Conjugate Normal–Normal with known variance σ^2 (per observation).
    Prior: θ ~ Normal(m0, v0). Data: x̄ with variance σ^2/n.
    Posterior mean is a credibility blend with weight Z = v0 / (v0 + σ^2/n) on sample mean.
    """
    if prior_var <= 0 or known_var <= 0 or n <= 0:
        raise ValueError("prior_var, known_var > 0 and n > 0 required.")
    v_data = known_var / n
    Z = prior_var / (prior_var + v_data)  # NOTE: This is the weight on the SAMPLE mean
    mu_post = Z * sample_mean + (1.0 - Z) * prior_mean
    tau2_post = 1.0 / (1.0 / prior_var + n / known_var)
    return NormalNormalPosterior(mu=mu_post, tau2=tau2_post, credibility_Z=Z,
                                 prior_mean=prior_mean, sample_mean=sample_mean)


# ----------------------------
# Module exports
# ----------------------------

__all__ = [
    # Classical credibility functions
    'classical_full_credibility_frequency',
    'classical_full_credibility_severity', 
    'classical_full_credibility_pure_premium',
    'classical_partial_credibility',
    
    # Bühlmann credibility types and functions
    'BuhlmannInputs', 
    'BuhlmannStraubInputs', 
    'BuhlmannResult',
    'buhlmann', 
    'buhlmann_straub',
    
    # Bayesian credibility types and functions
    'PoissonGammaPosterior', 
    'BetaBinomialPosterior', 
    'NormalNormalPosterior',
    'bayes_poisson_gamma', 
    'bayes_beta_binomial', 
    'bayes_normal_known_var'
]
