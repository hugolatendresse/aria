# pytest tests for credibility tools

import math
import pytest

#
# ---- Adjust these imports/aliases to match your module + function names ----
#
# Assumed module name from the earlier tool code: "credibility_tools"
# If your file is different (e.g., tools/credibility.py), update the import below.
from credibility_tools import (
    # Classical / limited-fluctuation
    full_credibility_n_binomial,   # (p, r, gamma) -> required n  (Binomial/proportion)
    full_credibility_m_poisson,    # (r, gamma)    -> required expected claims m (Poisson)

    # Bühlmann
    buhlmann_z,                    # (n, EPV, VHM) -> Z
    buhlmann_estimate,             # (sample_mean, overall_mean, n, EPV, VHM) -> credibility-weighted estimate

    # Bayesian (Poisson-Gamma)
    poisson_gamma_update,          # (alpha, beta, observations) -> {"alpha_post","beta_post","post_mean","pred_mean"}
)
# ---------------------------------------------------------------------------


# -----------------------------
# Classical (limited fluctuation)
# -----------------------------
def test_full_credibility_n_binomial_match_known_value():
    """
    For a binomial/proportion p with limited-fluctuation requirement:
    n >= z^2 * (1-p) / (r^2 p), where z = Phi^{-1}(1 - gamma/2).

    Example: p = 0.05, r = 0.05, gamma = 0.95 -> n ≈ 29,195.09 -> ceil 29,196
    """
    p = 0.05
    r = 0.05
    gamma = 0.95
    n_required = full_credibility_n_binomial(p, r, gamma)
    assert isinstance(n_required, int)
    assert n_required == 29196


def test_full_credibility_n_binomial_input_validation():
    with pytest.raises(ValueError):
        full_credibility_n_binomial(-0.1, 0.05, 0.95)
    with pytest.raises(ValueError):
        full_credibility_n_binomial(0.10, -0.05, 0.95)
    with pytest.raises(ValueError):
        full_credibility_n_binomial(0.10, 0.05, 1.5)
    with pytest.raises(ValueError):
        full_credibility_n_binomial(1.0, 0.05, 0.95)  # p must be in (0,1)


def test_full_credibility_m_poisson_match_known_value():
    """
    For Poisson frequency, full-credibility expected claims threshold:
    m >= (z / r)^2, z = Phi^{-1}(1 - gamma/2).

    Example: r = 0.05, gamma = 0.95 -> m ≈ 1536.58 -> ceil 1,537
    """
    r = 0.05
    gamma = 0.95
    m_required = full_credibility_m_poisson(r, gamma)
    assert isinstance(m_required, int)
    assert m_required == 1537


def test_full_credibility_m_poisson_input_validation():
    with pytest.raises(ValueError):
        full_credibility_m_poisson(-0.01, 0.95)
    with pytest.raises(ValueError):
        full_credibility_m_poisson(0.05, 1.2)


# ---------
# Bühlmann
# ---------
def test_buhlmann_z_basic_cases():
    # EPV -> process variance, VHM -> variance of hypothetical means
    # k = EPV/VHM; Z = n / (n + k)

    # Standard numeric case
    n, EPV, VHM = 10, 4.0, 1.0
    z = buhlmann_z(n, EPV, VHM)
    assert z == pytest.approx(10 / (10 + 4), rel=1e-12)

    # Boundary: VHM == 0 -> no variation across risks => Z = 0
    assert buhlmann_z(10, EPV=4.0, VHM=0.0) == 0.0

    # Boundary: EPV == 0 -> no process variance => k = 0 => Z = 1
    assert buhlmann_z(10, EPV=0.0, VHM=1.0) == 1.0

    # Validation
    with pytest.raises(ValueError):
        buhlmann_z(-1, 4.0, 1.0)
    with pytest.raises(ValueError):
        buhlmann_z(10, -0.1, 1.0)
    with pytest.raises(ValueError):
        buhlmann_z(10, 4.0, -0.1)


def test_buhlmann_estimate_reduces_correctly():
    """
    Credibility estimator should reduce to:
      - Overall mean when Z=0 (VHM=0)
      - Sample mean when Z=1 (EPV=0)
      - In general: m + Z*(xbar - m)
    """
    overall_mean = 100.0
    sample_mean = 120.0
    n, EPV, VHM = 10, 4.0, 1.0
    # Z = 10/(10+4) = 5/7 ≈ 0.7142857; estimate = 100 + 0.7142857 * 20 = 114.285714
    est = buhlmann_estimate(sample_mean, overall_mean, n, EPV, VHM)
    assert est == pytest.approx(114.2857142857, rel=1e-10)

    # Z = 0 -> return overall mean
    assert buhlmann_estimate(120.0, 100.0, n=10, EPV=4.0, VHM=0.0) == 100.0

    # Z = 1 -> return sample mean
    assert buhlmann_estimate(120.0, 100.0, n=10, EPV=0.0, VHM=1.0) == 120.0

    # Validation
    with pytest.raises(ValueError):
        buhlmann_estimate(120.0, 100.0, n=-1, EPV=1.0, VHM=1.0)


# -----------------------------
# Bayesian (Poisson–Gamma)
# -----------------------------
def test_poisson_gamma_update_posterior_and_predictive():
    """
    Conjugacy: Prior Gamma(alpha, beta) with 'beta' as rate.
      Observations y_1,...,y_n (Poisson), unit exposures
    Posterior: alpha' = alpha + sum(y), beta' = beta + n
    Posterior mean: alpha'/beta'
    One-step-ahead predictive mean = posterior mean (Poisson-Gamma)
    """
    alpha, beta = 10.0, 5.0
    obs = [3, 2, 1]  # sum=6, n=3 => alpha'=16, beta'=8 => mean=2.0
    out = poisson_gamma_update(alpha, beta, obs)

    assert set(out.keys()) == {"alpha_post", "beta_post", "post_mean", "pred_mean"}
    assert out["alpha_post"] == pytest.approx(16.0, rel=1e-12)
    assert out["beta_post"] == pytest.approx(8.0, rel=1e-12)
    assert out["post_mean"] == pytest.approx(2.0, rel=1e-12)
    assert out["pred_mean"] == pytest.approx(2.0, rel=1e-12)


def test_poisson_gamma_update_validation():
    with pytest.raises(ValueError):
        poisson_gamma_update(alpha=-1.0, beta=2.0, observations=[1, 2])
    with pytest.raises(ValueError):
        poisson_gamma_update(alpha=1.0, beta=-2.0, observations=[1, 2])
    with pytest.raises(ValueError):
        poisson_gamma_update(alpha=1.0, beta=2.0, observations=[1, -2])
