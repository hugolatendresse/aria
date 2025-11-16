import { Anthropic } from "@anthropic-ai/sdk"
import * as fs from "fs"
import * as path from "path"

export interface ConversationTurn {
	timestamp: string
	userMessage?: string | Array<Anthropic.ContentBlockParam>
	systemPrompt?: string
	assistantThinking?: string
	assistantResponse?: string
	toolUses?: Array<{
		name: string
		input: any
	}>
	toolResults?: Array<{
		name: string
		result: string
	}>
}

export class ConversationLogger {
	private turns: ConversationTurn[] = []
	private currentTurn: ConversationTurn | null = null
	private taskId: string
	private debugDir: string

	constructor(taskId: string, cwd: string) {
		this.taskId = taskId
		this.debugDir = path.join(cwd, ".cline-debug", "conversations")
		this.ensureDebugDir()
	}

	private ensureDebugDir() {
		if (!fs.existsSync(this.debugDir)) {
			fs.mkdirSync(this.debugDir, { recursive: true })
		}
	}

	startTurn() {
		this.currentTurn = {
			timestamp: new Date().toISOString(),
		}
	}

	logUserMessage(content: string | Array<Anthropic.ContentBlockParam>) {
		if (!this.currentTurn) {
			this.startTurn()
		}
		this.currentTurn!.userMessage = content
	}

	logSystemPrompt(prompt: string) {
		if (!this.currentTurn) {
			this.startTurn()
		}
		this.currentTurn!.systemPrompt = prompt
	}

	logAssistantThinking(thinking: string) {
		if (!this.currentTurn) {
			this.startTurn()
		}
		if (!this.currentTurn!.assistantThinking) {
			this.currentTurn!.assistantThinking = ""
		}
		this.currentTurn!.assistantThinking += thinking
	}

	logAssistantResponse(response: string) {
		if (!this.currentTurn) {
			this.startTurn()
		}
		if (!this.currentTurn!.assistantResponse) {
			this.currentTurn!.assistantResponse = ""
		}
		this.currentTurn!.assistantResponse += response
	}

	logToolUse(name: string, input: any) {
		if (!this.currentTurn) {
			this.startTurn()
		}
		if (!this.currentTurn!.toolUses) {
			this.currentTurn!.toolUses = []
		}
		this.currentTurn!.toolUses.push({ name, input })
	}

	logToolResult(name: string, result: string) {
		if (!this.currentTurn) {
			this.startTurn()
		}
		if (!this.currentTurn!.toolResults) {
			this.currentTurn!.toolResults = []
		}
		this.currentTurn!.toolResults.push({ name, result })
	}

	endTurn() {
		if (this.currentTurn) {
			this.turns.push(this.currentTurn)
			this.saveToDisk()
			this.currentTurn = null
		}
	}

	private formatContent(content: string | Array<Anthropic.ContentBlockParam>): string {
		if (typeof content === "string") {
			return content
		}
		return content
			.map((block) => {
				if (block.type === "text") {
					return block.text
				} else if (block.type === "image") {
					return `[Image: ${block.source.type}]`
				} else if (block.type === "tool_use") {
					return `[Tool Use: ${block.name}]`
				} else if (block.type === "tool_result") {
					return `[Tool Result: ${block.tool_use_id}]`
				}
				return ""
			})
			.join("\n")
	}

	private formatTurn(turn: ConversationTurn, index: number): string {
		const lines: string[] = []

		lines.push("=".repeat(80))
		lines.push(`TURN ${index + 1} - ${turn.timestamp}`)
		lines.push("=".repeat(80))
		lines.push("")

		if (turn.userMessage) {
			lines.push("--- USER MESSAGE ---")
			lines.push(this.formatContent(turn.userMessage))
			lines.push("")
		}

		if (turn.systemPrompt) {
			lines.push("--- SYSTEM PROMPT ---")
			lines.push(`Length: ${turn.systemPrompt.length} characters`)
			lines.push("")
			lines.push(turn.systemPrompt)
			lines.push("")
		}

		if (turn.assistantThinking) {
			lines.push("--- AI (THINKING) ---")
			lines.push(turn.assistantThinking)
			lines.push("")
		}

		if (turn.assistantResponse) {
			lines.push("--- AI (SAID TO USER) ---")
			lines.push(turn.assistantResponse)
			lines.push("")
		}

		if (turn.toolUses && turn.toolUses.length > 0) {
			lines.push("--- TOOL USES ---")
			turn.toolUses.forEach((tool, i) => {
				lines.push(`Tool ${i + 1}: ${tool.name}`)
				lines.push(JSON.stringify(tool.input, null, 2))
				lines.push("")
			})
		}

		if (turn.toolResults && turn.toolResults.length > 0) {
			lines.push("--- TOOL RESULTS ---")
			turn.toolResults.forEach((result, i) => {
				lines.push(`Result ${i + 1}: ${result.name}`)
				lines.push(result.result.substring(0, 500) + (result.result.length > 500 ? "..." : ""))
				lines.push("")
			})
		}

		return lines.join("\n")
	}

	private saveToDisk() {
		try {
			const now = new Date()
			const timestamp = now.toISOString().replace(/[:.]/g, "-")
			const filename = `conversation_${timestamp}.txt`
			const filepath = path.join(this.debugDir, filename)

			const lines: string[] = []
			lines.push("CONVERSATION DEBUG LOG")
			lines.push(`Task ID: ${this.taskId}`)
			lines.push(`Generated: ${now.toISOString()}`)
			lines.push("")
			lines.push("")

			this.turns.forEach((turn, index) => {
				lines.push(this.formatTurn(turn, index))
				lines.push("")
			})

			fs.writeFileSync(filepath, lines.join("\n"), "utf8")
			console.log(`[CONVERSATION DEBUG] Saved to: ${filepath}`)
		} catch (error) {
			console.error("[CONVERSATION DEBUG] Failed to save:", error)
		}
	}

	getLatestFilePath(): string | null {
		try {
			const files = fs
				.readdirSync(this.debugDir)
				.filter((f) => f.startsWith("conversation_") && f.endsWith(".txt"))
				.map((f) => ({
					name: f,
					path: path.join(this.debugDir, f),
					mtime: fs.statSync(path.join(this.debugDir, f)).mtime,
				}))
				.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

			return files.length > 0 ? files[0].path : null
		} catch {
			return null
		}
	}
}
