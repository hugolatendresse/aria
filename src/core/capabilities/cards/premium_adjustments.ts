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
	version: "1.1.0",
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
	content: `**Capability Card: Premium Trending (Exponential & Two-Step) v1.1**

**What it does:**
Projects historical earned premiums to future policy periods using (1) exponential trend fitting to estimate growth rate, then (2) Two-Step trending to separate historical convergence from future projection.

**CRITICAL DATA REQUIREMENTS:**

Premium trending uses **QUARTERLY WRITTEN PREMIUM DATA**, NOT calendar year earned premium:

\`\`\`python
# CORRECT: Use quarterly written premium data
qtrly_df = pd.read_csv('qtrly_written_premium_exposures.csv')
qtrly_df['Average Written Premium at CRL'] = (
    qtrly_df['Written Premium at CRL'] / 
    qtrly_df['Written Exposure']
)

# WRONG: Do NOT use calendar year earned premium for trend fitting
# cy_earned_premium is used as the BASE to be trended, not for fitting the trend
\`\`\`

**Part 1: Exponential Trend Fitting**

Fits exponential growth curve using Excel LOGEST equivalent:

**MANDATORY METHODOLOGY - LOGEST Regression (NOT Geometric Means):**

\`\`\`python
import numpy as np

def exponential_trend_fit(data_series, n_points):
    """
    Fit exponential trend using least squares (Excel LOGEST method).
    Matches Excel: =LOGEST(data, SEQUENCE(n))
    
    CRITICAL: This is LINEAR REGRESSION on LOG-TRANSFORMED data,
    NOT geometric mean of period-to-period changes.
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

# WRONG APPROACH - DO NOT USE:
# geometric_mean = (data.pct_change() + 1).prod() ** (1/len(data)) - 1
# This gives different results than LOGEST regression!

# Example: Quarterly data to annual trend
quarterly_trend = exponential_trend_fit(quarterly_avg_premium, n_points=8)
annual_trend = (1 + quarterly_trend) ** 4 - 1  # Compound 4 quarters
\`\`\`

**Rolling Annual Data for Smoothing:**

CRITICAL: Rolling data is ONLY for trend fitting, NOT for current state values.

**CORRECT METHOD - Ratio of Sums:**
\`\`\`python
# Create rolling 4-quarter average premium per exposure
# CRITICAL: Calculate ratio of SUMS, not mean of individual ratios

rolling_annual_premium = []
rolling_annual_exposure = []

for i in range(3, len(qtrly_df)):
    # Sum previous 4 quarters (i-3, i-2, i-1, i)
    annual_prem = qtrly_df['Written Premium at CRL'].iloc[i-3:i+1].sum()
    annual_exp = qtrly_df['Written Exposure'].iloc[i-3:i+1].sum()
    rolling_annual_premium.append(annual_prem)
    rolling_annual_exposure.append(annual_exp)

# CORRECT: Divide sums to get average premium per exposure
rolling_avg_premium = np.array(rolling_annual_premium) / np.array(rolling_annual_exposure)

# Fit to rolling annual averages (smooths quarterly volatility)
# CRITICAL: Use LOGEST regression, not geometric means
# CRITICAL: Even though these are "rolling annual" values, they are QUARTERLY data points!
# Each point represents one quarter's 12-month rolling average
# Therefore the trend fit returns a QUARTERLY trend rate
quarterly_trend = exponential_trend_fit(rolling_avg_premium, n_points=8)
annual_trend = (1 + quarterly_trend) ** 4 - 1

# WRONG: Treating rolling annual values as annual trend directly
# premium_trend_annual = exponential_trend_fit(rolling_avg_premium, n_points=8)  # NO!
# This gives quarterly trend, not annual trend!

# Note: This produces approximately N-3 rolling points from N quarters
# Example: 20 quarters → 17 rolling annual points
# So "8-point trend" means last 8 rolling annual values (8 quarters, not 8 years!)
\`\`\`

**WRONG METHOD - Mean of Ratios:**
\`\`\`python
# WRONG: Do NOT take mean of individual quarterly ratios
qtrly_df['Premium_Per_Exposure'] = qtrly_df['Written Premium'] / qtrly_df['Written Exposure']
rolling_avg_wrong = qtrly_df['Premium_Per_Exposure'].rolling(4).mean()

# This gives: mean(P1/E1, P2/E2, P3/E3, P4/E4)
# Correct is: (P1+P2+P3+P4) / (E1+E2+E3+E4)
# These are mathematically different when exposures vary!
\`\`\`

**Part 2: Two-Step Trending**

**WHEN TO USE:** Default method when you have calendar year earned premium data. Do NOT use simple trending formula like \`(1 + trend)^years\` unless you have NO calendar year breakdown.

Two-Step separates trending into (A) historical-to-current and (B) current-to-future:

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

# Component A: Current Trend Factor (VARIES BY CALENDAR YEAR)
# Brings each CY's historical earned premium to latest written premium level
# CRITICAL: Use QUARTERLY value (not rolling avg) to represent current state
avg_written_premium_series = qtrly_df['Average Written Premium at CRL']
latest_avg_written_crl = avg_written_premium_series.iloc[-1]  # Latest QUARTERLY value

# Calculate for EACH calendar year separately
cy_earned_premium_df['Average Earned Premium at CRL'] = (
    cy_earned_premium_df['Earned Premium at CRL'] / 
    cy_earned_exposures_df['Earned Exposure']
)

cy_earned_premium_df['Current Trend Factor'] = (
    latest_avg_written_crl / 
    cy_earned_premium_df['Average Earned Premium at CRL']
)

# Component B: Projected Trend Factor (SAME FOR ALL YEARS)
# Projects from current to future average written date
# Uses the annual trend rate fitted to rolling data in Part 1
projected_trend_factor = (1 + annual_premium_trend) ** projected_period

# Total Trend Factor (VARIES BY CALENDAR YEAR due to Component A)
# CRITICAL: Apply to EACH calendar year, not to the total
cy_earned_premium_df['Total Trend Factor'] = (
    cy_earned_premium_df['Current Trend Factor'] * projected_trend_factor
)

# Apply to earned premiums
cy_earned_premium_df['Projected Earned Premium at CRL'] = (
    cy_earned_premium_df['Earned Premium at CRL'] * 
    cy_earned_premium_df['Total Trend Factor']
)

# WRONG: Do NOT apply single factor to total
# total_projected_premium = total_earned_premium * (1 + trend)^years  # NO!
\`\`\`

**Why Two-Step?**
- **Component A** accounts for each calendar year being at different premium levels
- **Component B** projects all years forward to same future date
- Each CY gets a different total trend factor based on how far it is from current level
- More accurate than applying one factor to aggregate premium

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

# If ratemaking.trending module not available, approximate:
def calculate_trend_period_years(from_date, to_date):
    delta_days = (to_date - from_date).days
    return delta_days / 365.25
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

- **DATA SOURCE**: Use quarterly written premium data, NOT calendar year earned premium
- **METHODOLOGY**: Exponential fit = \`np.polyfit\` on log-transformed data (LOGEST), NOT geometric mean of changes
- **ROLLING VS QUARTERLY**: Rolling data for trend fitting, quarterly data for current state comparisons
- Quarterly → annual: \`(1+q)^4-1\` (compound), NOT \`q*4\`
- Current date = **midpoint of latest CY** (7/1), NOT end of period
- Always use 365.25 for year conversion (accounts for leap years)
- \`future_average_written_date\` for premium; \`future_average_earned_date\` includes policy term
- Two-step separates: (1) historical data convergence, (2) forward projection
- On-level premium FIRST, then trend
- **Component A (Current Trend Factor)**: Latest QUARTERLY avg written premium (not rolling avg) divided by historical avg earned
- **Component B (Projected Trend Factor)**: Same for all years, uses fitted trend rate
- **Total Trend Factor**: Varies by calendar year due to Component A

**Common Mistakes to Avoid:**

1. **Using calendar year earned premium instead of quarterly written premium for trend fitting**
2. **Using geometric mean instead of LOGEST exponential regression**
3. **Using rolling average values for current state comparisons (use quarterly)**
4. **Skipping Two-Step trending when calendar year data available (do NOT use simple trend^years)**
5. **Not creating rolling annual data from quarterly data before fitting**
6. **Forgetting to compound quarterly trends to annual: must use (1+q)^4-1**
7. **Using fixed trend factor for all years (Two-Step produces different factors per year)**
8. **CRITICAL: Taking mean of individual ratios instead of ratio of sums for rolling averages**
   - WRONG: \`.rolling(4).mean()\` on Premium/Exposure column
   - CORRECT: Sum 4Q premium / Sum 4Q exposure
9. **Using frequency/severity trends instead of premium trend in TPR calculations**
   - Premium trend comes from premium trending analysis
   - Do NOT use frequency trend variable for net trend calculation in TPR
10. **CRITICAL: Treating rolling annual values as if they give annual trend rates directly**
    - WRONG: \`annual_trend = exponential_trend_fit(rolling_avg_premium, n_points=8)\`
    - Rolling annual values are computed QUARTERLY (one value per quarter)
    - Trend fit returns QUARTERLY trend that must be compounded to annual
    - CORRECT: \`quarterly_trend = exponential_trend_fit(rolling_avg_premium, n_points=8); annual_trend = (1 + quarterly_trend)**4 - 1\``,
	sources: ["Werner & Modlin - Basic Ratemaking", "ratemaking package - trending module"],
	safetyTags: ["actuarial", "ratemaking", "premium", "trending"],
}
