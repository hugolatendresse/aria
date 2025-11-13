import { CapabilityCard } from "../card_registry"

export const ultimateFreqSev1Card: CapabilityCard = {
	id: "ultimate-freqsev-1",
	version: "1.0.0",
	title: "Ultimates: Frequency-Severity",
	triggers: [
		{
			kind: "keyword",
			any: ["frequency severity", "freq sev", "freq-sev", "frequency-severity", "freqsev", "frequency and severity"],
		},
		{ kind: "keyword", any: ["claim count", "closed with payment", "CWP"], all: ["frequency", "severity"] },
		{ kind: "regex", pattern: "\\b(freq(uency)?[\\s-]sev(erity)?)\\b", flags: "i" },
	],
	content: `**Capability Card: Frequency-Severity 1 v1.0**

**What it does:**  
Projects ultimate claims by developing **frequency** and **severity** to ultimate **separately**, then multiplying. Separates "how many claims" from "how much per claim" to capture different development patterns.

**Core Formula:**  
\`Ultimate = Ultimate Frequency × Ultimate Severity\`

**When to use:**  
- Have claim count data in addition to claim amounts
- Frequency and severity exhibit different development patterns (e.g., counts stabilize faster)
- Want to isolate inflation/settlement trends (severity) from exposure/reporting trends (frequency)

**Key Implementation Pattern:**
\`\`\`python
import chainladder as cl

# Develop frequency (counts) to ultimate
freq_pipe = cl.Pipeline([
    ('dev', cl.Development(average='volume', n_periods=N)),
    ('tail', cl.TailConstant(tail=T1)),
    ('model', cl.Chainladder())
])
freq_pipe.fit(count_tri)
ult_freq = freq_pipe.named_steps.model.ultimate_

# Develop severity (amount/count) to ultimate
severity_tri = claims_tri / count_tri  # Element-wise division
sev_pipe = cl.Pipeline([
    ('dev', cl.Development(average='simple', n_periods=M)),
    ('tail', cl.TailConstant(tail=T2)),
    ('model', cl.Chainladder())
])
sev_pipe.fit(severity_tri)
ult_sev = sev_pipe.named_steps.model.ultimate_

# Multiply frequency by severity at AY level
ult_freq_by_ay = ult_freq.values[0, 0, :, -1]
ult_sev_by_ay = ult_sev.values[0, 0, :, -1]
ult_by_ay = ult_freq_by_ay * ult_sev_by_ay
total_ultimate = ult_by_ay.sum()
\`\`\`

**Critical Points:**

1. **Develop severity directly, not components separately:**
   - Create severity triangle: \`severity_tri = claims_tri / count_tri\`
   - Develop the severity triangle itself (chainladder handles division properly)
   - Do NOT develop claims and counts separately then divide ultimates

2. **Different parameters for frequency vs severity:**
   - User may want to develop frequency and severity using different parameters (e.g. different types of averages)
   - Tail factors typically differ between frequency and severity

3. **Multiple frequency sources:**
   - If you have multiple count triangles (e.g., CWP counts, reported counts), consider averaging them or check with user
   - Example: \`avg_freq = (cwp_ultimate + reported_ultimate) / 2\` by accident year
   - Reported counts go with reported claims, CWP counts go with paid claims

4. **Accident year level multiplication:**
   - Extract ultimate values by accident year: \`.values[0, 0, :, -1]\`
   - Multiply arrays element-wise (frequency × severity for each AY)
   - Sum across AYs for total ultimate

**Common Pitfalls:**
- Using same development assumptions for frequency and severity (they have different patterns)
- Developing claims and counts to ultimate separately, then dividing (loses development correlation)
- Forgetting that severity = claims/counts must use compatible triangles (same basis)

**When NOT to use:**
- Don't have reliable count data
- Counts are reported inconsistently across years
- Severity patterns show no credible trend (too volatile)
- Single-triangle methods (CL, BF, Cape Cod) already produce stable estimates

**Advantages:**
- Captures different development speeds for frequency vs severity
- Can isolate inflation effects in severity
- More granular understanding of reserve drivers
- Can use different data sources for frequency estimates

**Version:** chainladder 0.8.x+ (triangle division, Pipeline API).`,
	sources: ["chainladder-python docs — Triangle arithmetic operations", "Actuarial literature — Frequency-Severity methods"],
	safetyTags: ["actuarial", "IBNR", "triangle-based"],
}
