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

export const mcp_template = `MCP SERVERS

The Model Context Protocol (MCP) enables communication between the system and locally running MCP servers that provide additional tools and resources to extend your capabilities.

# Connected MCP Servers

When a server is connected, you can use the server's tools via the \`use_mcp_tool\` tool, and access the server's resources via the \`access_mcp_resource\` tool.

## Actuarial Analysis Protocol

**CRITICAL**: When the user presents actuarial problems, insurance questions, or requests involving actuarial analysis, you MUST automatically cross-reference the available actuarial documents using the RAG MCP service tools:

- **search_friedland_paper**: Use for Friedland paper specific queries
- **search_werner_modlin_paper**: Use for Werner-Modlin paper specific queries  
- **search_both_papers**: Use for comprehensive actuarial analysis

**Trigger Conditions**: Automatically use these tools when encountering:
- Actuarial calculations or methods
- Insurance loss reserving questions
- Risk assessment problems
- Actuarial standard references
- Insurance industry terminology
- Loss development triangles
- Reserve adequacy discussions

**Workflow**: 
1. Identify actuarial context in user request
2. Use appropriate RAG tool(s) to retrieve relevant information
3. Incorporate findings into your response
4. Provide both theoretical context from papers and practical application

{{MCP_SERVERS_LIST}}`
