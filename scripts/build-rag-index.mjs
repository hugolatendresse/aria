#!/usr/bin/env node
/**
 * Build script to generate the RAG index for the Aria VS Code extension.
 *
 * This script invokes the Python export_index.py script to generate
 * the actuarial-index.json file that will be bundled with the extension.
 *
 * Usage:
 *   node scripts/build-rag-index.mjs [--rebuild]
 *
 *   --rebuild: Force rebuild of the vector database before exporting
 */

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

const rebuild = process.argv.includes("--rebuild")
const outputPath = join(projectRoot, "dist", "actuarial-index.json")

// Check if index already exists (skip in production builds unless --rebuild)
if (!rebuild && existsSync(outputPath)) {
	console.log("[RAG Index] Index already exists, skipping build. Use --rebuild to force regeneration.")
	process.exit(0)
}

console.log("[RAG Index] Building actuarial RAG index...")
console.log("[RAG Index] This requires a GOOGLE_API_KEY environment variable.")

const pythonScript = join(projectRoot, "rag", "export_index.py")

// Check if Python script exists
if (!existsSync(pythonScript)) {
	console.error(`[RAG Index] Error: Python export script not found at ${pythonScript}`)
	process.exit(1)
}

// Run the Python export script
const args = ["export_index.py", "--output", outputPath]
if (rebuild) {
	args.push("--rebuild")
}

const python = spawn("python3", args, {
	cwd: join(projectRoot, "rag"),
	stdio: "inherit",
	env: {
		...process.env,
		// Ensure PYTHONPATH includes the rag directory
		PYTHONPATH: join(projectRoot, "rag"),
	},
})

python.on("error", (err) => {
	console.error("[RAG Index] Failed to start Python process:", err.message)
	console.error("[RAG Index] Make sure Python 3 is installed and available in PATH.")
	process.exit(1)
})

python.on("close", (code) => {
	if (code === 0) {
		console.log("[RAG Index] Index built successfully!")
	} else {
		console.error(`[RAG Index] Python script exited with code ${code}`)
		process.exit(code)
	}
})
