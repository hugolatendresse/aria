import { CapabilityCard } from "../card_registry"

export const lossTrendingFrequencySeverityCard: CapabilityCard = {
	id: "ratemaking-loss-trending-freqsev",
	version: "1.0.0",
	title: "Ratemaking: Loss Trending via Frequency-Severity (Two-Step)",
	triggers: [
		{
			kind: "keyword",
			any: ["frequency trend", "severity trend", "pure premium trend", "frequency severity", "two-step loss trend"],
		},
		{ kind: "regex", pattern: "\\b(frequency[\\s-]?severity|freq[\\s-]?sev|loss[\\s-]?trend)\\b", flags: "i" },
	],
	content: `**Capability Card: Loss Trending (Frequency-Severity) v1.0**

**What it does:**
Trends historical ultimate losses to future policy periods by separately analyzing claim frequency and severity components, then applying Two-Step trending to project from historical accident years to future average accident date.

**Part 1: Frequency-Severity Analysis**

Decompose loss trend into component drivers:
\`\`\`python
import numpy as np

# From quarterly regional/state data
df['Frequency'] = df['Closed Claim Count'] / df['Earned Exposure']
df['Severity'] = df['Paid Losses'] / df['Closed Claim Count']

# Fit exponential trends separately (using exponential_trend_fit from premium card)
freq_trend_qtrly = exponential_trend_fit(df['Frequency'], n_points=8)
sev_trend_qtrly = exponential_trend_fit(df['Severity'], n_points=8)

# Convert quarterly to annual
freq_annual = (1 + freq_trend_qtrly) ** 4 - 1
sev_annual = (1 + sev_trend_qtrly) ** 4 - 1

# Combine multiplicatively (pure premium = frequency × severity)
combined_loss_trend = (1 + freq_annual) * (1 + sev_annual) - 1
\`\`\`

**Selection Strategy:**
- **8-point for current/historical**: Stable estimate of recent experience
- **4-point for prospective**: More responsive to changing patterns
- If fit to QUARTERLY data, compound to annual if needed

**Part 2: Two-Step Trending for Losses**

Apply trend from historical accident year midpoints to future:
\`\`\`python
from datetime import datetime
from ratemaking.trending import future_average_accident_date

# Setup
accident_years = [2021, 2022, 2023, 2024, 2025]
latest_ay = 2025
current_ay_date = datetime(latest_ay, 7, 1).date()  # Midpoint of latest AY

# Future average accident date
effective_date = '1/1/2027'
rates_in_effect_months = 12
policy_term_months = 6

future_avg_accident = future_average_accident_date(
    effective_date, 
    rates_in_effect_months, 
    policy_term_months
)
# Returns: datetime.date(2027, 10, 1)

# Calculate trend period in years
def calculate_trend_period_years(from_date, to_date):
    delta_days = (to_date - from_date).days
    return delta_days / 365.25

# For each accident year
for ay in accident_years:
    ay_midpoint = datetime(ay, 7, 1).date()
    
    # Component 1: Current period (AY midpoint to latest AY midpoint)
    current_period = calculate_trend_period_years(ay_midpoint, current_ay_date)
    current_factor = (1 + current_loss_trend) ** current_period
    
    # Component 2: Projected period (latest AY midpoint to future)
    projected_period = calculate_trend_period_years(current_ay_date, future_avg_accident)
    projected_factor = (1 + projected_loss_trend) ** projected_period
    
    # Total trend factor
    total_loss_trend_factor = current_factor * projected_factor

# Apply to ultimate losses
projected_ultimate_losses = ultimate_losses * total_loss_trend_factors
\`\`\`

**Frequency Definition:**
- Claims per unit exposure: \`Claim Count / Earned Exposure\`

**Severity Definition:**
- Average cost per claim: \`Paid Losses / Closed Claim Count\`
- Use closed or reported count depending on what is available or based on the user's preference

**When to use:**
- Frequency and severity have different trend patterns
- Need component-level analysis for pricing decisions

**Critical Points:**
- Multiplicative combination: \`(1+f)×(1+s)-1\`, not additive
- Two-step: Current brings AYs to common point; projected goes to future
- Midpoint convention: July 1 for calendar/accident years
- \`future_average_accident_date\` needs policy term; written date doesn't`,
	sources: ["Werner & Modlin - Basic Ratemaking", "ratemaking package - trending module"],
	safetyTags: ["actuarial", "ratemaking", "loss", "trending"],
}
