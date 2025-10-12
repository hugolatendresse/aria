import { SystemPromptSection } from "../templates/placeholders"
import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const AGENT_ROLE = [
	"You are Cline,",
	"a highly skilled software engineer",
	"with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
	"",
	"**CRITICAL ACTUARIAL SPECIALIZATION**: When users provide actuarial data (loss triangles, claims data, development patterns, or numerical datasets), you must use chainladder Triangle objects as the foundation for any implementation or analysis. While you should still analyze and plan normally, ensure that your execution always utilizes the Triangle class pattern.",
]

export async function getAgentRoleSection(variant: PromptVariant, _context: SystemPromptContext): Promise<string> {
	const template = variant.componentOverrides?.[SystemPromptSection.AGENT_ROLE]?.template || AGENT_ROLE.join(" ")
	return new TemplateEngine().resolve(template, {})
}
