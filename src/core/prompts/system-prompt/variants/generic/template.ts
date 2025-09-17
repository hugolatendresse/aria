import { ACTUARIAL_MCP_TEMPLATE } from "../../../actuarial/templates/mcp-template"
import { SystemPromptSection } from "../../templates/placeholders"

export const baseTemplate = `{{${SystemPromptSection.AGENT_ROLE}}}

{{${SystemPromptSection.TOOL_USE}}}

====

{{${SystemPromptSection.TODO}}}

====

{{${SystemPromptSection.MCP}}}

====

{{${SystemPromptSection.EDITING_FILES}}}

====

{{${SystemPromptSection.ACT_VS_PLAN}}}

====

{{${SystemPromptSection.TASK_PROGRESS}}}

====

{{${SystemPromptSection.CAPABILITIES}}}

====

{{${SystemPromptSection.FEEDBACK}}}

====

{{${SystemPromptSection.RULES}}}

====

{{${SystemPromptSection.SYSTEM_INFO}}}

====

{{${SystemPromptSection.OBJECTIVE}}}

====

{{${SystemPromptSection.USER_INSTRUCTIONS}}}`

export const mcp_template = ACTUARIAL_MCP_TEMPLATE
