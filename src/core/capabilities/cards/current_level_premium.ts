import { CapabilityCard } from "../card_registry"

export const currentLevelPremiumCard: CapabilityCard = {
	id: "current-level-premium",
	version: "1.0.0",
	title: "On-Level Premium Adjustment (Rate Changes)",
	triggers: [
		{
			kind: "keyword",
			any: ["on-level", "onlevel", "on level", "rate level"],
		},
		{
			kind: "regex",
			pattern: "\\b(rate\\s+level|on[- ]?level)\\b",
			flags: "i",
		},
	],
	content: `**Capability Card: On-Level Premium Adjustment v1.0**

**What it does:**
Adjusts historical premiums to a current (target) rate level by applying cumulative rate change factors. This ensures premiums from different periods are comparable at a consistent rate level, which is essential for expected-loss methods that use premium as exposure.

**When to use:**
- Cape Cod method: Exposure (premium) must be on-leveled before use
- Bornhuetter-Ferguson with exposure: When using premium as \`sample_weight\`, on-level first
- Loss Ratio / ELR calculations: When comparing losses to premiums across years with rate changes
- Any analysis requiring premiums and losses at the same rate level
- Ratemaking: Adjusting historical experience to current rates

**Canonical Implementation:**
\`\`\`python
import pandas as pd
import numpy as np

# Input: DataFrame with accident_year and rate_change columns
# rate_change: decimal format (e.g., 0.05 for +5%, -0.02 for -2%)
rate_data = pd.DataFrame({
    'accident_year': [2000, 2001, 2002, 2003, 2004, 2005],
    'rate_change': [0.00, 0.05, 0.03, -0.02, 0.10, 0.07],
    'earned_premium': [1000000, 1100000, 1250000, 1350000, 1500000, 1650000]
})

# Step 1: Convert rate changes to rate factors (1 + rate_change)
rate_data['rate_factor'] = 1 + rate_data['rate_change']

# Step 2: Calculate cumulative rate factor using cumprod
# This gives the cumulative effect of all rate changes up to each year
rate_data['cumulative_factor'] = rate_data['rate_factor'].cumprod()

# Step 3: Calculate on-level factors to target year (typically latest year)
# Formula: target_year_factor / historical_year_factor
target_year = rate_data['accident_year'].max()
target_factor = rate_data.loc[rate_data['accident_year'] == target_year, 'cumulative_factor'].values[0]

rate_data['onlevel_factor_to_current'] = target_factor / rate_data['cumulative_factor']

# Step 4: Apply on-level factors to premium
rate_data['onlevel_premium'] = rate_data['earned_premium'] * rate_data['onlevel_factor_to_current']

print(rate_data[['accident_year', 'rate_change', 'rate_factor', 'cumulative_factor', 
                 'onlevel_factor_to_current', 'earned_premium', 'onlevel_premium']])

# Total on-level premium for use in Cape Cod or other methods
total_onlevel_premium = rate_data['onlevel_premium'].sum()
\`\`\`

**Example Calculation:**
\`\`\`
Year  Rate Change  Rate Factor  Cumulative Factor  OnLevel Factor (to 2005)
2000    0.0%         1.00          1.000              1.277
2001   +5.0%         1.05          1.050              1.217
2002   +3.0%         1.03          1.082              1.181
2003   -2.0%         0.98          1.060              1.205
2004  +10.0%         1.10          1.166              1.095
2005   +7.0%         1.07          1.277              1.000

Premium 2000: $1,000,000 × 1.277 = $1,277,000 (on-level to 2005)
Premium 2005: $1,650,000 × 1.000 = $1,650,000 (already at 2005 level)
\`\`\`

**Input / Output:**
- **Input:** DataFrame with \`accident_year\`, \`rate_change\` (decimal), and \`earned_premium\`
- **Output:** DataFrame with additional columns: \`rate_factor\`, \`cumulative_factor\`, \`onlevel_factor_to_current\`, \`onlevel_premium\`

**Critical Points:**
- **Rate change format:** Ensure rate changes are in decimal format (5% = 0.05, not 5). Convert percentages by dividing by 100.
- **First year baseline:** The first year typically has rate_change = 0.0 (no change from itself), serving as the baseline. Its rate_factor = 1.0.
- **Cumulative product order:** Use \`.cumprod()\` to calculate cumulative factors in chronological order. This compounds rate changes sequentially.
- **On-level direction:** To on-level TO a target year: \`target_factor / historical_factor\`. To on-level FROM a target year back: \`historical_factor / target_factor\`.
- **When to apply:** On-level premiums BEFORE using them in Cape Cod, BF (when using premium as exposure), or any ELR/loss ratio calculation. Do NOT on-level after the fact.
- **Chainladder integration:** Create a Triangle from on-leveled premiums, then use \`.latest_diagonal\` as \`sample_weight\` in Cape Cod or BF methods.
- **Parallelogram method:** This card covers simple rate change adjustments. For more complex mid-year rate changes with triangular data, use chainladder's \`ParallelogramOLF\` class which handles rate changes by effective date.

**Alternative: Using chainladder ParallelogramOLF for complex cases:**
\`\`\`python
import chainladder as cl

# For mid-year rate changes or when you have rate effective dates
rate_history = pd.DataFrame({
    'eff_date': ['2000-01-01', '2000-07-01', '2001-03-15', '2002-01-01'],
    'rate_change': [0.00, 0.03, 0.05, -0.02]
})
rate_history['eff_date'] = pd.to_datetime(rate_history['eff_date'])

# Apply parallelogram on-level factors to premium triangle
olf = cl.ParallelogramOLF(rate_history=rate_history, change_col='rate_change', date_col='eff_date')
premium_onlevel = olf.fit_transform(premium_tri)
\`\`\`

**Version:** Tested with pandas standard operations; chainladder ParallelogramOLF available in 0.8.x+`,
	sources: [
		"CAS Basic Ratemaking - On-Level Premium Techniques",
		"Friedland - Estimating Unpaid Claims Using Basic Techniques (Rate Level Adjustment)",
		"chainladder-python docs - ParallelogramOLF",
	],
	safetyTags: ["actuarial", "ratemaking", "premium-adjustment"],
}
