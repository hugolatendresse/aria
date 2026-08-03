import { CapabilityCard } from "../card_registry"

export const lossTrending: CapabilityCard = {
	id: "ratemaking-loss-trending-freqsev",
	version: "1.1.0",
	title: "Ratemaking: Loss Trending (Two-Step Method)",
	triggers: [
		{
			kind: "keyword",
			any: [
				"frequency trend",
				"severity trend",
				"pure premium trend",
				"frequency severity",
				"two-step loss trend",
				"loss trend",
				"loss trending",
				"trend losses",
			],
		},
		{
			kind: "regex",
			pattern: "\\b(frequency[\\s-]?severity|freq[\\s-]?sev|loss[\\s-]?trend|pure[\\s-]?premium[\\s-]?trend)\\b",
			flags: "i",
		},
	],
	content: `**Capability Card: Loss Trending (Two-Step Method) v1.1**

**What it does:**
Trends historical ultimate losses to future policy periods using Two-Step trending methodology. This card covers BOTH pure premium trending AND frequency-severity decomposition approaches.

**APPLIES TO ALL LOSS TRENDING METHODS:**
- Pure Premium Trending (trend aggregate losses directly)
- Loss Cost Trending (trend losses per exposure)
- Frequency-Severity Decomposition (trend components separately)

**The Two-Step trending methodology, date calculations, and per-accident-year structure described here are MANDATORY for ALL methods.**

**OPTION 1: Pure Premium / Loss Cost Trending**

When trending losses or loss ratios directly (WITHOUT frequency-severity decomposition):

**CRITICAL DATA REQUIREMENTS:**

Loss trending uses **QUARTERLY REGIONAL/STATE PURE PREMIUM or LOSS COST DATA**:

\`\`\`python
# Load quarterly pure premium data
qtrly_pp_df = pd.read_csv('qtrly_regional_pure_premium.csv')

# The series to fit trends to
pp_series = qtrly_pp_df['Paid Pure Premium (including ALAE)']
\`\`\`

**MANDATORY METHODOLOGY - LOGEST Regression (NOT Geometric Means):**

\`\`\`python
import numpy as np

def exponential_trend_fit(data_series, n_points):
    """
    Fit exponential trend using least squares (Excel LOGEST method).
    
    CRITICAL: This is LINEAR REGRESSION on LOG-TRANSFORMED data,
    NOT geometric mean of period-to-period changes.
    """
    if len(data_series) < n_points:
        raise ValueError(f"Data series has {len(data_series)} points but {n_points} requested")
    
    if hasattr(data_series, 'values'):
        recent_data = data_series[-n_points:].values
    else:
        recent_data = data_series[-n_points:]
    
    x = np.arange(n_points)  # 0, 1, 2, ..., n-1
    log_y = np.log(recent_data)
    
    # Linear regression on log-transformed data
    coeffs = np.polyfit(x, log_y, 1)
    slope = coeffs[0]
    
    # Convert back from log space
    trend_rate = np.exp(slope) - 1
    
    return trend_rate

# CURRENT loss trend (8-point for historical/stable)
quarterly_trend_8pt = exponential_trend_fit(pp_series, n_points=8)
annual_trend_8pt = (1 + quarterly_trend_8pt) ** 4 - 1

# PROJECTED loss trend (4-point for recent/responsive)
quarterly_trend_4pt = exponential_trend_fit(pp_series, n_points=4)
annual_trend_4pt = (1 + quarterly_trend_4pt) ** 4 - 1

# Use annual_trend_8pt for "current" period
# Use annual_trend_4pt for "projected" period
\`\`\`

**OPTION 2: Frequency-Severity Decomposition**

When decomposing into frequency and severity components:

\`\`\`python
# Load quarterly loss trend data
qtrly_loss_trend_df = pd.read_csv('qtrly_regional_loss_trend_data.csv')

# Calculate frequency and severity
qtrly_loss_trend_df['Frequency'] = (
    qtrly_loss_trend_df['Closed Claim Count'] / 
    qtrly_loss_trend_df['Earned Exposure']
)

qtrly_loss_trend_df['Severity'] = (
    qtrly_loss_trend_df['Paid Losses'] / 
    qtrly_loss_trend_df['Closed Claim Count']
)

# These are the series to fit trends to
frequency_series = qtrly_loss_trend_df['Frequency']
severity_series = qtrly_loss_trend_df['Severity']
\`\`\`

**Part 1: Frequency-Severity Analysis**

**MANDATORY METHODOLOGY - LOGEST Regression (NOT Geometric Means):**

Decompose loss trend into component drivers using exponential regression:

\`\`\`python
import numpy as np

def exponential_trend_fit(data_series, n_points):
    """
    Fit exponential trend using least squares (Excel LOGEST method).
    
    CRITICAL: This is LINEAR REGRESSION on LOG-TRANSFORMED data,
    NOT geometric mean of period-to-period changes.
    """
    if len(data_series) < n_points:
        raise ValueError(f"Data series has {len(data_series)} points but {n_points} requested")
    
    if hasattr(data_series, 'values'):
        recent_data = data_series[-n_points:].values
    else:
        recent_data = data_series[-n_points:]
    
    x = np.arange(n_points)  # 0, 1, 2, ..., n-1
    log_y = np.log(recent_data)
    
    # Linear regression on log-transformed data
    coeffs = np.polyfit(x, log_y, 1)
    slope = coeffs[0]
    
    # Convert back from log space
    trend_rate = np.exp(slope) - 1
    
    return trend_rate

# CORRECT: Fit to frequency/severity SERIES
frequency_trend_8pt = exponential_trend_fit(frequency_series, n_points=8)
severity_trend_8pt = exponential_trend_fit(severity_series, n_points=8)

# WRONG APPROACH - DO NOT USE:
# freq_changes = frequency_series.pct_change().dropna()
# freq_trend = ((1 + freq_changes).prod() ** (1/len(freq_changes))) - 1
# This geometric mean of changes gives DIFFERENT results than LOGEST!

# Convert quarterly trends to annual
frequency_annual_8pt = (1 + frequency_trend_8pt) ** 4 - 1
severity_annual_8pt = (1 + severity_trend_8pt) ** 4 - 1

# Combine multiplicatively (pure premium = frequency × severity)
combined_loss_trend_current = (1 + frequency_annual_8pt) * (1 + severity_annual_8pt) - 1
\`\`\`

**Different Trend Rates for Current vs Projected:**

CRITICAL: Use DIFFERENT n_points for current (8-point) vs projected (4-point):

\`\`\`python
# CURRENT loss trend (8-point for historical/stable)
frequency_trend_8pt = exponential_trend_fit(frequency_series, n_points=8)
severity_trend_8pt = exponential_trend_fit(severity_series, n_points=8)

frequency_annual_8pt = (1 + frequency_trend_8pt) ** 4 - 1
severity_annual_8pt = (1 + severity_trend_8pt) ** 4 - 1

step_6_current_loss_trend = (1 + frequency_annual_8pt) * (1 + severity_annual_8pt) - 1

# PROJECTED loss trend (4-point for recent/responsive)
frequency_trend_4pt = exponential_trend_fit(frequency_series, n_points=4)
severity_trend_4pt = exponential_trend_fit(severity_series, n_points=4)

frequency_annual_4pt = (1 + frequency_trend_4pt) ** 4 - 1
severity_annual_4pt = (1 + severity_trend_4pt) ** 4 - 1

step_7_projected_loss_trend = (1 + frequency_annual_4pt) * (1 + severity_annual_4pt) - 1

# These will be DIFFERENT values!
# Example: current = -0.1%, projected = 1.9%
\`\`\`

**Selection Strategy:**

- **8-point for current/historical**: Stable estimate of recent experience (last 8 quarters = 2 years)
- **4-point for prospective**: More responsive to changing patterns (last 4 quarters = 1 year)
- Always fit to QUARTERLY data, then compound to annual
- Do NOT use the same trend rate for both current and projected

**Part 2: Two-Step Trending - MANDATORY FOR ALL LOSS TRENDING METHODS**

**THIS SECTION APPLIES TO:**
- Pure Premium Trending (Option 1)
- Loss Cost Trending (Option 1)  
- Frequency-Severity Trending (Option 2)

MANDATORY when "Two-Step trending" is specified. Do NOT use simple trending.

Apply trend from historical accident year midpoints to future, using DIFFERENT rates for current vs projected.

**CRITICAL STRUCTURE: Trend EACH Accident Year Individually**

YOU MUST apply trending to each accident year separately. Each AY gets its own trend factor based on how far it needs to be trended:
- AY 2011 (oldest) needs MORE trending than AY 2015 (newest)
- NEVER average losses first, then trend the average
- ALWAYS trend each AY's ultimate loss individually, THEN sum

\`\`\`python
# CORRECT: Trend each accident year individually
for ay in accident_years:
    ay_midpoint = datetime(ay, 7, 1).date()
    # Calculate trend factor specific to this AY
    # Apply to this AY's ultimate loss
    
# Sum the trended losses AFTER trending each AY

# WRONG: Do NOT do this!
avg_loss = total_losses / total_exposures
trended_avg = avg_loss * single_trend_factor  # Wrong!
\`\`\`

**CRITICAL: Calculating Future Average Accident Date**

**========================================================================**
**ABSOLUTELY MANDATORY - NO EXCEPTIONS - READ THIS CAREFULLY**
**========================================================================**

YOU MUST USE THE EXISTING FUNCTION FROM THE RATEMAKING PACKAGE.

**DO NOT:**
- Implement your own date calculation
- Write manual datetime arithmetic
- Calculate the date using formulas
- Skip using the ratemaking package

**YOU MUST:**
- Import future_average_accident_date from ratemaking.trending
- Call the function with the three required parameters
- Use the result directly

**THIS IS NON-NEGOTIABLE. IF YOU IMPLEMENT YOUR OWN DATE CALCULATION, YOU ARE MAKING A CRITICAL ERROR.**

**REQUIRED USAGE - COPY THIS EXACTLY:**

\`\`\`python
from datetime import datetime
from ratemaking.trending import future_average_accident_date

# MANDATORY: Use the function from ratemaking package
effective_date = '1/1/2027'
rates_in_effect_months = 12
policy_term_months = 6

future_avg_accident = future_average_accident_date(
    effective_date, 
    rates_in_effect_months, 
    policy_term_months
)
# Result: datetime.date(2027, 10, 1)
\`\`\`

**WHY THIS IS CRITICAL:**
The ratemaking package already has this function implemented correctly with all edge cases handled. Reimplementing it manually WILL produce incorrect results.

**IF YOU ARE TEMPTED TO CALCULATE IT YOURSELF:**
STOP. Go back and read this section again. Import and use the function.

**========================================================================**

# Calculate projected period (same for all accident years)
def calculate_trend_period_years(from_date, to_date):
    delta_days = (to_date - from_date).days
    return delta_days / 365.25

# Setup
accident_years = [2021, 2022, 2023, 2024, 2025]
latest_ay = 2025
current_ay_date = datetime(latest_ay, 7, 1).date()  # Midpoint of latest AY

projected_loss_trend_period = calculate_trend_period_years(current_ay_date, future_avg_accident)

# Build trend factors array
loss_trend_factors = []

for ay in accident_years:
    ay_midpoint = datetime(ay, 7, 1).date()
    
    # Component A: Current period (AY midpoint to latest AY midpoint)
    # Uses CURRENT loss trend (8-point)
    current_period = calculate_trend_period_years(ay_midpoint, current_ay_date)
    current_loss_trend_factor = (1 + step_6_current_loss_trend) ** current_period
    
    # Component B: Projected period (latest AY midpoint to future)
    # Uses PROJECTED loss trend (4-point)
    projected_loss_trend_factor = (1 + step_7_projected_loss_trend) ** projected_loss_trend_period
    
    # Total trend factor (VARIES BY ACCIDENT YEAR)
    total_loss_trend_factor = current_loss_trend_factor * projected_loss_trend_factor
    loss_trend_factors.append(total_loss_trend_factor)

total_loss_trend_factors = np.array(loss_trend_factors)

# Apply to ultimate losses
ultimate_losses_2021_2025 = ultimate_losses[ay_start_idx:]
projected_ultimate_losses = ultimate_losses_2021_2025 * total_loss_trend_factors
\`\`\`

**WRONG APPROACH - Do NOT use simple trending:**

\`\`\`python
# WRONG: Do not use a single trend rate and fixed period
loss_trend_factor = (1 + loss_trend_projected) ** 2.5
trended_losses = ultimate_losses * loss_trend_factor

# This ignores:
# 1. Different trend rates for current vs projected
# 2. Varying trend factors by accident year
# 3. Proper Two-Step methodology
\`\`\`

**Frequency Definition:**

- Claims per unit exposure: \`Claim Count / Earned Exposure\`
- Use consistent exposure base (earned exposures)

**Severity Definition:**

- Average cost per claim: \`Paid Losses / Closed Claim Count\`
- Use closed or reported count depending on availability or user preference
- Must match numerator (paid with closed, incurred with reported)

**When to use:**

- Frequency and severity have different trend patterns
- Need component-level analysis for pricing decisions
- Werner-Modlin and similar methods that separate frequency/severity

**Critical Points:**

- **METHODOLOGY**: Use LOGEST exponential regression (np.polyfit on log data), NOT geometric mean of changes
- **DATA**: Fit to frequency/severity SERIES, not to period-to-period changes
- **ANNUALIZATION**: Quarterly to annual = \`(1+q)^4-1\`, NOT \`q*4\`
- **COMBINATION**: Multiplicative combination: \`(1+f)×(1+s)-1\`, NOT additive \`f+s\`
- **TWO RATES**: Current (8-point) and Projected (4-point) use DIFFERENT trend rates
- **TWO-STEP STRUCTURE**: 
  - Component A (current): Uses 8-point trend, varies by AY
  - Component B (projected): Uses 4-point trend, same for all AYs
  - Total factor varies by accident year
- **DATE FUNCTIONS**: \`future_average_accident_date\` needs policy term; written date doesn't
- **MIDPOINT CONVENTION**: July 1 for calendar/accident years
- Always use 365.25 for year conversion (accounts for leap years)
- **ULAE FACTOR**: Applied after trending, as multiplier on loss ratio

**Common Mistakes to Avoid:**

1. Using geometric mean of period-to-period changes instead of LOGEST regression
2. Fitting trend to changes (pct_change()) instead of to the actual series
3. Using the same trend rate for both current and projected (must use 8-point and 4-point separately)
4. Using simple trending (trend^years) instead of Two-Step when specified
5. Not compounding quarterly trends to annual: must use (1+q)^4-1
6. Adding frequency and severity trends instead of multiplying: (1+f)×(1+s)-1
7. Using fixed trend factor for all accident years (Two-Step produces different factors per AY)
8. Not properly annualizing quarterly trends before combining
9. Using \`future_average_written_date\` instead of \`future_average_accident_date\` for losses
10. Applying trends before calculating ultimate losses (develop first, then trend)
11. **CRITICAL ERROR: Calculating future average accident date incorrectly** - You MUST import and use the future_average_accident_date function from ratemaking.trending package. DO NOT implement your own calculation. DO NOT use manual datetime arithmetic. THE FUNCTION EXISTS - USE IT.
12. **CRITICAL ERROR: Implementing custom date calculation instead of importing the function** - The function is already implemented in ratemaking.trending. Import it. Use it. Period.
13. **Averaging losses first, then trending the average** - MUST trend each accident year individually, then sum`,
	sources: ["Werner & Modlin - Basic Ratemaking", "ratemaking package - trending module"],
	safetyTags: ["actuarial", "ratemaking", "loss", "trending"],
}
