# Actuarial Prompts Module

This module provides modular, reusable actuarial expertise components that can be easily integrated into AI systems for reserving and ratemaking applications.

## Overview

The actuarial prompts module extracts specialized actuarial knowledge from the main Cline system prompts, making them available as standalone components. This also enables other AI tools to add an actuarial expertise layer.

## Components

### MCP Component (`mcp.ts`)
- **ACTUARIAL_MCP_TEMPLATE**: Basic MCP server template with actuarial analysis protocol
- **renderActuarialMcpTemplate()**: Function to render template with server list

### Rules Component (`rules.ts`) 
- **ACTUARIAL_RULES_SECTION**: Mandatory requirement for RAG tool usage on actuarial queries
- **getActuarialRulesSection()**: Function to retrieve actuarial rules

### Chainladder Component (`chainladder.ts`) 
- **CHAINLADDER_INSTRUCTIONS**: Simple chainladder-python Triangle creation instructions  
- **getChainladderInstructions()**: Function to retrieve chainladder instructions

### Templates (`templates/`)
- **ACTUARIAL_MCP_TEMPLATE**: Combines RAG research with chainladder Triangle creation

## Usage

```typescript
import { 
  ACTUARIAL_RULES_SECTION,
  CHAINLADDER_INSTRUCTIONS,
  ACTUARIAL_MCP_TEMPLATE 
} from "@/core/prompts/actuarial"

// Use template with both RAG and coding capabilities
const myPrompt = `My AI System Instructions

${ACTUARIAL_RULES_SECTION}

${ACTUARIAL_MCP_TEMPLATE.replace("{{MCP_SERVERS_LIST}}", serversList)}`

// Or use components individually
const codingOnlyPrompt = `My AI System Instructions
${CHAINLADDER_INSTRUCTIONS}`
```

## Features

### Actuarial Analysis Protocol
- Automatic detection of actuarial terminology
- Mandatory RAG tool usage for insurance queries  
- Support for Friedland and Werner-Modlin paper searches
- Comprehensive trigger conditions for actuarial contexts

### Trigger Conditions
- Actuarial calculations or methods
- Insurance loss reserving questions  
- Risk assessment problems
- Actuarial standard references
- Insurance industry terminology
- Loss development triangles
- Reserve adequacy discussions

### RAG Tools Integration
- **search_friedland_paper**: Friedland paper specific queries
- **search_werner_modlin_paper**: Werner-Modlin paper specific queries
- **search_both_papers**: Comprehensive actuarial analysis

