import { CapabilityCard } from "../card_registry"

export const premiumOnLevelingCard: CapabilityCard = {
	id: "ratemaking-premium-onleveling",
	version: "1.0.0",
	title: "Ratemaking: Premium On-Leveling to Current Rate Level",
	triggers: [
		{
			kind: "keyword",
			any: ["on-level", "onlevel", "current rate level", "rate level factor", "parallelogram", "rate change history"],
		},
		{ kind: "regex", pattern: "\\b(on[\\s-]?level|current[\\s-]?rate[\\s-]?level|CRL)\\b", flags: "i" },
	],
	content: `**Capability Card: Premium On-Leveling v1.0**

**What it does:**
Adjusts historical earned premiums to a common "current rate level" (CRL) for comparison across periods when rate changes have occurred. 

**Key Concept:**
The current rate level is typically the rate level at the midpoint of the latest calendar year. All historical premiums are adjusted to this common reference point.
The Parallelogram Method applies rate changes proportionally based on exposure period overlap. 
We either apply provided on-level/current rate level factors or we build a cumulative multiplicative chain of rate changes.

**Canonical Implementation:**
\`\`\`python
import pandas as pd
import numpy as np

# Given: earned_premium and current_rate_level_factor by calendar year
df['Earned Premium at CRL'] = df['Earned Premium'] * df['Current Rate Level Factor']

# Alternative: Calculate from rate change history
df['rate_factor'] = 1 + df['rate_change_pct']
df['cumulative_rate_factor'] = df['rate_factor'].cumprod()

# On-level to target period (e.g., latest year)
target_cumulative = df.loc[df['Year'] == target_year, 'cumulative_rate_factor'].values[0]
df['onlevel_factor'] = target_cumulative / df['cumulative_rate_factor']
df['onlevel_premium'] = df['Earned Premium'] * df['onlevel_factor']
\`\`\`

**Input / Output:**
- **Input:** Historical earned premium, rate change history or rate level factors
- **Output:** Earned premium at current rate level (CRL)

**When to use:**
- Before trending analysis when rate changes occurred during experience period
- Comparing loss ratios across periods with different rate levels
- Required for accurate premium trend analysis

**Critical Points:**
- Midpoint convention: Latest CY midpoint (July 1) is standard "current" reference
- Parallelogram vs simple: Parallelogram more accurate for mid-year rate changes
- Always on-level BEFORE trending to avoid confounding rate changes with trend`,
	sources: ["Werner & Modlin - Basic Ratemaking", "CAS Rate of Return paper"],
	safetyTags: ["actuarial", "ratemaking", "premium"],
}

export const premiumTrendingCard: CapabilityCard = {
	id: "ratemaking-premium-trending",
	version: "1.0.0",
	title: "Ratemaking: Premium Trending (Exponential Fit & Two-Step)",
	triggers: [
		{
			kind: "keyword",
			any: [
				"premium trend",
				"exponential trend",
				"two-step trend",
				"two-step premium",
				"LOGEST",
				"rolling annual",
				"current trend factor",
				"projected trend factor",
				"average written premium",
			],
		},
		{
			kind: "regex",
			pattern: "\\b(premium[\\s-]?trend|exponential[\\s-]?fit|two[\\s-]?step[\\s-]?(trend|premium)|LOGEST)\\b",
			flags: "i",
		},
	],
	content: `**Capability Card: Premium Trending (Exponential & Two-Step) v1.0**

**What it does:**
Projects historical earned premiums to future policy periods using (1) exponential trend fitting to estimate growth rate, then (2) Two-Step trending to separate historical convergence from future projection.

**Part 1: Exponential Trend Fitting**

Fits exponential growth curve using Excel LOGEST equivalent:

\`\`\`python
import numpy as np

def exponential_trend_fit(data_series, n_points):
    """
    Fit exponential trend using least squares (Excel LOGEST method).
    Matches Excel: =LOGEST(data, SEQUENCE(n))
    """
    recent_data = data_series[-n_points:]
    
    x = np.arange(n_points)  # 0, 1, 2, ..., n-1
    log_y = np.log(recent_data)
    
    # Linear regression on log-transformed data
    coeffs = np.polyfit(x, log_y, 1)
    slope = coeffs[0]
    
    # Convert back from log space
    period_trend = np.exp(slope) - 1
    return period_trend

# Example: Quarterly data to annual trend
quarterly_trend = exponential_trend_fit(quarterly_avg_premium, n_points=8)
annual_trend = (1 + quarterly_trend) ** 4 - 1  # Compound 4 quarters
\`\`\`

**Rolling Annual Data for Smoothing:**

CRITICAL: Rolling data is ONLY for trend fitting, NOT for current state values.

\`\`\`python
# Create rolling 4-quarter sums from quarterly data
rolling_annual_premium = []
rolling_annual_exposure = []

for i in range(3, len(qtrly_df)):
    annual_prem = qtrly_df['Written Premium at CRL'].iloc[i-3:i+1].sum()
    annual_exp = qtrly_df['Written Exposure'].iloc[i-3:i+1].sum()
    rolling_annual_premium.append(annual_prem)
    rolling_annual_exposure.append(annual_exp)

rolling_avg = np.array(rolling_annual_premium) / np.array(rolling_annual_exposure)

# Fit to rolling annual averages (smooths quarterly volatility)
trend = exponential_trend_fit(rolling_avg, n_points=8)
annual_trend = (1 + trend) ** 4 - 1
\`\`\`

**Part 2: Two-Step Trending**

Separates trending into (A) historical-to-current and (B) current-to-future:

\`\`\`python
from datetime import datetime
from ratemaking.trending import future_average_written_date

# Setup dates
latest_cy = 2025
current_date = datetime(latest_cy, 7, 1).date()  # Midpoint of latest CY

# Calculate future average written date
effective_date = '1/1/2027'
rates_in_effect_months = 12
future_avg_written = future_average_written_date(effective_date, rates_in_effect_months)
# Returns: datetime.date(2027, 7, 1) - midpoint of rate period

# Trend period from current to future
delta_days = (future_avg_written - current_date).days
projected_period = delta_days / 365.25

# Component A: Current Trend Factor
# Brings historical earned premium to latest written premium level
# CRITICAL: Use QUARTERLY value (not rolling avg) to represent current state
avg_written_premium_series = qtrly_df['Average Written Premium at CRL']
latest_avg_written_crl = avg_written_premium_series.iloc[-1]  # Latest QUARTERLY value

historical_avg_earned_crl = earned_premium_crl / exposures  # By CY
current_trend_factor = latest_avg_written_crl / historical_avg_earned_crl

# Component B: Projected Trend Factor
# Projects from current to future average written date
# Uses the annual trend rate fitted to rolling data in Part 1
projected_trend_factor = (1 + annual_premium_trend) ** projected_period

# Total Trend Factor
total_trend_factor = current_trend_factor * projected_trend_factor

# Apply to earned premiums
projected_earned_premium = earned_premium_crl * total_trend_factor
\`\`\`

**Ratemaking Date Functions:**

\`\`\`python
from ratemaking.trending import (
    future_average_written_date,
    future_average_earned_date,
    future_average_accident_date
)

# For premium trending
avg_written = future_average_written_date('1/1/2027', rates_in_effect_months=12)
# Returns midpoint of rate period: 7/1/2027

# For earned premium (includes policy term)
avg_earned = future_average_earned_date('1/1/2027', rates_in_effect_months=12, policy_term_months=6)
# Returns average exposure date: 10/1/2027

# For accident year trending (used for losses)
avg_accident = future_average_accident_date('1/1/2027', rates_in_effect_months=12, policy_term_months=6)
\`\`\`

**Selection Guidance:**

- **n=8** for historical/current: More stable, recent 2 years
- **n=4** for prospective: Responsive to recent changes
- **Rolling annual**: Smooths quarterly volatility FOR TREND FITTING ONLY
- Use on-leveled premium data (already adjusted to CRL)

**When to use:**

- Premium trending before rate indications
- Need to project premiums to future policy period
- Two-step when separating historical vs prospective patterns
- Use \`future_average_written_date\` for premium trending (exposure-based)

**Critical Points:**

- Exponential fit: \`np.polyfit\` on log-transformed data (NOT optimization)
- Quarterly → annual: \`(1+q)^4-1\` (compound), NOT \`q*4\`
- Current date = **midpoint of latest CY** (7/1), NOT end of period
- Always use 365.25 for year conversion (accounts for leap years)
- \`future_average_written_date\` for premium; \`future_average_earned_date\` includes policy term
- Two-step separates: (1) historical data convergence, (2) forward projection
- On-level premium FIRST, then trend
- **ROLLING DATA**: Used ONLY for fitting trend rate (smoothing). Use QUARTERLY values for current state comparisons
- **Component A**: Latest QUARTERLY avg written premium (not rolling avg) divided by historical avg earned`,
	sources: ["Werner & Modlin - Basic Ratemaking", "ratemaking package - trending module"],
	safetyTags: ["actuarial", "ratemaking", "premium", "trending"],
}
