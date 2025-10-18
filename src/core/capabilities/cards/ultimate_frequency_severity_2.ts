import { CapabilityCard } from "../card_registry"

export const ultimateFreqSev2Card: CapabilityCard = {
	id: "ultimate-freqsev-2",
	version: "1.0.0",
	title: "Ultimates: Frequency–Severity (Approach 2 – Exposure-Based for Recent AYs)",
	triggers: [
		{ kind: "keyword", any: ["frequency severity", "freq-sev", "FS method 2", "approach 2"] },
		{ kind: "keyword", any: ["exposure", "on-level", "earned premium"], all: ["frequency"] },
		{ kind: "keyword", any: ["recent AY", "latest two years", "high leverage", "uncertain LDFs"] },
	],
	importance: 5,
	content: `**Capability Card: Frequency–Severity 2 v1.0**

**What it does (Friedland FS Approach #2):**  
Targets the **most recent accident years** (typically the latest 2, but configurable) where pure development is highly leveraged and unstable. It:
1) selects a **frequency rate** by comparing **ultimate claim counts to an exposure base** (or on-level earned premium) for stable historical AYs;  
2) projects **ultimate counts for the most recent AYs** as \`Selected Frequency × Exposure\`; and  
3) projects **ultimate severities** by **developing reported severities to ultimate first**, then adjusting developed severities for inflation/cost trends and selecting a level for the recent AYs. Then it multiplies the two to get ultimates for the recent AYs.

**How this differs from Frequency–Severity #1:**  
- **FS #1** develops **counts and severities to ultimate** directly for *all* AYs using standard development.  
- **FS #2** **uses exposure-based frequency** only for the **latest N AYs** (default 2) to **avoid large, uncertain to-ultimate factors**; older AYs use their developed counts and severities as usual. For the latest AYs, severities are **developed to ultimate first, then trended to a common cost level** for selection.

**Core idea & formulas:**  
- Select \`Frequency_{stable_AY} = Trended_Ultimate_Counts_{AY} / OnLevel_Exposure_{AY}\` on stable historical AYs. Pick a level to carry into the most recent AYs.  
- For most recent N AYs: \`Ultimate Counts = Selected Frequency × Actual Earned Premium\` (after reversing on-level adjustments).  
- For most recent N AYs: **Develop severities to ultimate → Then trend developed severities → Select ultimate severity level → De-trend back to each AY's level**.  
- Then \`Ultimate Claims_{latest N} = Ultimate Counts × De-trended Ultimate Severity\`.
- Older AYs use standard developed ultimates.

**Critical: Severity Order**  
**Develop severities FIRST, then adjust for trend**. Do NOT trend reported severities before development.

**Practical notes:**  
- If **exposure units** aren't available, use **on-level earned premium** as a proxy (adjust earned premium to a common rate level to remove price changes).
- When using on-level premium: calculate frequency using on-level values, then reverse the on-level adjustment when projecting counts with actual earned premium.
- **Adjustment factors** (e.g., tort reform, claims handling changes): Apply these to the **developed** severities along with trend adjustments when bringing them to a common level. Example: \`adjusted_sev = developed_sev × trend_factor × tort_reform_factor\`.
- This approach is motivated by the problem of **high to-ultimate factors on the most recent AYs** in pure development methods.

---

### Key Implementation Pattern (Python, \`chainladder\` + pandas)

\`\`\`python
import numpy as np
import pandas as pd
import chainladder as cl

# Configuration parameters (user-defined):
N_COUNT_PERIODS = 4        # development periods for count triangle
COUNT_TAIL_FACTOR = 1.00   # tail factor for count development
N_SEV_PERIODS = 5          # development periods for severity triangle  
SEV_TAIL_FACTOR = 1.01     # tail factor for severity development
PREMIUM_UNIT = 1000        # premium unit for frequency calculation (e.g., per $1000)
N_YEARS_FOR_SELECTION = 2  # number of recent stable years for frequency selection
N_YEARS_FOR_SEV_SELECTION = 5  # number of years for severity selection
EXCLUDE_COUNT = 1          # number of outliers to exclude from each end

# Inputs expected:
# - reported_count_tri: reported claim count triangle (AY × dev)
# - reported_claims_tri: reported claims triangle 
# - premium_df: DataFrame with 'Accident Year', 'Earned Premium', 'Rate Changes' columns
# - stable_ays: range of AYs for selecting frequency (e.g., historical years with stable patterns)
# - latest_ays: list of most recent AYs to project with FS #2 (e.g., latest N years)
# - all_ays: list of all accident years
# - claim_count_trend: selected annual count trend (e.g., user-selected %)
# - severity_trend: selected annual severity trend (e.g., user-selected %)
# - target_year: reference year for trending (e.g., latest evaluation year)

# Frequency

# 1) Develop counts to ultimate for all AYs
count_pipe = cl.Pipeline([
    ('dev', cl.Development(average='volume', n_periods=N_COUNT_PERIODS)),  # user-configurable
    ('tail', cl.TailConstant(tail=COUNT_TAIL_FACTOR)),  # user-selected tail
    ('model', cl.Chainladder())
])
count_pipe.fit(reported_count_tri)
count_ultimate = count_pipe.named_steps.model.ultimate_
count_ultimates_by_ay = count_ultimate.values[0, 0, :, -1]

# 2) Calculate on-level earned premiums (remove rate change effects)
premium_df['rate_change_pct'] = premium_df['Rate Changes'].str.rstrip('%').astype(float) / 100
premium_df['rate_factor'] = 1 + premium_df['rate_change_pct']
premium_df['cumulative_rate_factor'] = premium_df['rate_factor'].cumprod()
target_cumulative = premium_df.loc[premium_df['Accident Year'] == target_year, 'cumulative_rate_factor'].values[0]
premium_df['onlevel_factor'] = target_cumulative / premium_df['cumulative_rate_factor']
premium_df['onlevel_premium'] = premium_df['Earned Premium'] * premium_df['onlevel_factor']

# 3) Trend historical counts and calculate frequency to on-level premium
trended_counts = {}
for year in stable_ays:
    ay_idx = all_ays.index(year)
    years_to_trend = target_year - year
    trend_factor = (1 + claim_count_trend) ** years_to_trend
    trended_counts[year] = count_ultimates_by_ay[ay_idx] * trend_factor

# Frequency = trended counts per unit of on-level premium
frequencies = {}
for year in stable_ays:
    olep = premium_df.loc[premium_df['Accident Year'] == year, 'onlevel_premium'].values[0]
    frequencies[year] = trended_counts[year] / (olep / PREMIUM_UNIT)  # e.g., 1000 for per $1k

# 4) Select frequency level for target year (user-provided selection method)
# Example: average of most recent stable years
selected_freq = np.mean([frequencies[y] for y in stable_ays[-N_YEARS_FOR_SELECTION:]])  # user-defined

# 5) Calculate "unadjusted" frequencies for all AYs (reverse on-level & trend)
# This allows applying to actual earned premium
unadjusted_freqs = {}
for year in all_ays:
    rate_olf = premium_df.loc[premium_df['Accident Year'] == year, 'onlevel_factor'].values[0]
    years_from_target = target_year - year
    count_trend_factor = (1 + claim_count_trend) ** years_from_target
    unadjusted_freqs[year] = (selected_freq * rate_olf) / count_trend_factor

# 6) Project ultimate counts using actual earned premium
projected_counts = {}
for year in all_ays:
    ep = premium_df.loc[premium_df['Accident Year'] == year, 'Earned Premium'].values[0]
    projected_counts[year] = unadjusted_freqs[year] * (ep / PREMIUM_UNIT)

# Severity

# 7) DEVELOP severities to ultimate FIRST (reported claims / reported counts)
severity_tri = reported_claims_tri / reported_count_tri

severity_pipe = cl.Pipeline([
    ('dev', cl.Development(average='simple', n_periods=N_SEV_PERIODS)),  # user-configurable
    ('tail', cl.TailConstant(tail=SEV_TAIL_FACTOR)),  # user-selected tail
    ('model', cl.Chainladder())
])
severity_pipe.fit(severity_tri)
severity_ultimate = severity_pipe.named_steps.model.ultimate_
severity_ultimates_by_ay = severity_ultimate.values[0, 0, :, -1]

# 8) THEN adjust developed severities to common cost level (for historical AYs)
# Include any special adjustment factors (e.g., tort reform)
adjusted_severities = []
for i, year in enumerate(all_ays):
    if year < latest_ays[0]:  # Only adjust historical AYs for selection
        years_from_target = target_year - year
        trend_factor = (1 + severity_trend) ** years_from_target
        
        # Apply any special adjustments (e.g., tort reform, claims handling changes)
        # User-provided based on known operational or legal changes
        # Purpose is to adjust the severity to the common cost level for selection
        
        adjusted_sev = severity_ultimates_by_ay[i] * trend_factor * special_adjustment
        adjusted_severities.append(adjusted_sev)

# 9) Select ultimate severity from adjusted developed severities (user-provided method)
# Example: middle M of latest N to exclude outliers (user-configurable)
latest_n = adjusted_severities[-N_YEARS_FOR_SEV_SELECTION:]
sorted_n = sorted(latest_n)
middle_m = sorted_n[EXCLUDE_COUNT:-EXCLUDE_COUNT] if len(sorted_n) > 2*EXCLUDE_COUNT else sorted_n
selected_severity = np.mean(middle_m)  # or user-defined selection method

# 10) De-trend selected severity back to each latest AY's level
unadjusted_severities_latest = {}
for year in latest_ays:
    years_from_target = target_year - year
    trend_factor = (1 + severity_trend) ** years_from_target
    unadjusted_severities_latest[year] = selected_severity / trend_factor

# ==================== COMBINE FOR LATEST AYs ====================

# 11) Calculate ultimates for latest N AYs using projected counts and de-trended severities
ultimate_latest_ays = {}
for year in latest_ays:
    ultimate_latest_ays[year] = projected_counts[year] * unadjusted_severities_latest[year]

total_ultimate_latest = sum(ultimate_latest_ays.values())

# 12) Calculate IBNR for latest AYs
latest_reported = reported_claims_tri.latest_diagonal.sum('origin')  # adjust indexing as needed
total_ibnr_latest = total_ultimate_latest - latest_reported

# Note: Older AYs would use their standard developed ultimates from chainladder
\`\`\`

**When to use (per Friedland):**  
- **Most recent N AYs** (typically 2) have **high LDF leverage** → development is too volatile; exposure-based frequency is more stable.
- You have **credible exposure or on-level premium** by AY and **reported claims/counts** to form severities.
- You want to **explicitly control frequency and severity trends** for the most immature years.

**Critical points / guardrails:**  
1. **Counts & exposure definitions must be consistent** (e.g., claimant vs occurrence; include/exclude CNP). Mixing definitions will bias frequencies and severities.
2. **Order matters: Develop severities to ultimate FIRST, THEN adjust for inflation/trend**. Do not trend reported severities before development.
3. **On-level premium as exposure**: When using earned premium, adjust to a common rate level first to remove price changes from frequency calculations.
4. **Seasonality & operating changes** can affect both counts and severities; check for patterns and reflect the **most recent operating environment** in parameter selections.
5. **Adjustment factors** (tort reform, claims handling changes): Apply these multiplicatively to **developed** severities along with trend when bringing to common level.
6. **Selection method**: The method for selecting ultimate frequency and severity levels (e.g., averages, weighted averages, middle N of latest M) should be user-defined based on data credibility and stability.
7. **Scope**: This approach replaces ultimates only for the **latest N AYs** (default 2). Older AYs retain their developed ultimates from standard methods.

**When NOT to use:**  
- No reliable exposure (or on-level premium) information by AY.
- Latest AYs' **exposure measures are unstable** or undergoing structural shifts.
- Lines where **reported severities** are not meaningful (e.g., pervasive partial payments without adjustments).

**Version:** chainladder 0.8.x+ (triangle arithmetic, Pipeline API).

`,
	sources: [
		"Friedland — Chapter 11, Frequency–Severity Techniques (Approach #2: exposure-based for recent AYs).",
		"Friedland — Exhibit IV (using on-level earned premium as exposure proxy; projecting latest AYs).",
		"Friedland — Notes on severity development order, inflation adjustments, and special factors.",
	],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
