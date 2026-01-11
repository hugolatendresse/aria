
# Aria

Meet Aria, your **A**I for **R**eserving, **I**ndications, and **A**nalysis—an AI agent built for actuarial tasks.

Aria can answer simple questions ("When should I use the BF method over the development method?") as well as perform complex tasks ("Use the provided assumptions, loss and exposure data to calculate the indicated rate change."). Aria can create and edit files, explore large projects, use the browser, and execute terminal commands. It has access to an extensive library of actuarial knowledge that it consults before making decisions.

Aria is a VS Code Extension that writes, edits, and runs code for you when needed. It is not strictly necessary to know programming to use Aria, though that might be helpful for more complex tasks. Simpler tasks can be executed fully independently. 

---

<img align="right" width="340" src="https://github.com/user-attachments/assets/3cf21e04-7ce9-4d22-a7b9-ba2c595e88a4">

### Use any API and Model

Aria supports API providers like OpenRouter, Anthropic, OpenAI, Google Gemini, AWS Bedrock, Azure, GCP Vertex, Cerebras and Groq. You can also configure any OpenAI compatible API, or use a local model through LM Studio/Ollama. If you're using OpenRouter, the extension fetches their latest model list, allowing you to use the newest models as soon as they're available.

The extension also keeps track of total tokens and API usage cost for the entire task loop and individual requests, keeping you informed of spend every step of the way.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="left" width="370" src="https://github.com/user-attachments/assets/81be79a8-1fdb-4028-9129-5fe055e01e76">

### Run Commands in Terminal

Thanks to the new [shell integration updates in VSCode v1.93](https://code.visualstudio.com/updates/v1_93#_terminal-shell-integration-api), Aria can execute commands directly in your terminal and receive the output. This allows to perform a wide range of tasks, from installing packages and running build scripts to deploying applications, managing databases, and executing tests, all while adapting to your dev environment & toolchain to get the job done right.

For long running processes, use the "Proceed While Running" button to let Aria continue in the task while the command runs in the background. Aria will be notified of any new terminal output along the way and will react to issues that may come up, such as compile-time errors when editing files.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="right" width="400" src="https://github.com/user-attachments/assets/c5977833-d9b8-491e-90f9-05f9cd38c588">

### Create and Edit Files

Aria creates and edits files in the directory opened in VS Code. You can edit or revert Aria's changes directly in the diff view editor, or provide feedback in chat until you're satisfied with the result. 

All changes made by Aria are recorded in your file's Timeline, providing an easy way to track and revert modifications if needed.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="left" width="370" src="https://github.com/user-attachments/assets/bc2e85ba-dfeb-4fe6-9942-7cfc4703cbe5">

### Use the Browser

With Claude Sonnet's new [Computer Use](https://www.anthropic.com/news/3-5-models-and-computer-use) capability, Aria can launch a browser, click elements, type text, and scroll, capturing screenshots and console logs at each step. This allows for general web use.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="right" width="350" src="https://github.com/user-attachments/assets/ac0efa14-5c1f-4c26-a42d-9d7c56f5fadd">

### "add a tool that..."

Thanks to the [Model Context Protocol](https://github.com/modelcontextprotocol), Aria can extend its capabilities through custom tools. You can use [community-made servers](https://github.com/modelcontextprotocol/servers). Aria can also create and install tools tailored to your specific workflow. Just ask Aria to "add a tool" and it will handle everything, from creating a new MCP server to installing it into the extension. These custom tools then become part of Aria's toolkit, ready to use in future tasks.

-   "add a tool that fetches Jira tickets": Retrieve tickets and put Aria to work
-   "add a tool that manages AWS EC2s": Check server metrics and scale instances up or down

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="left" width="360" src="https://github.com/user-attachments/assets/7fdf41e6-281a-4b4b-ac19-020b838b6970">

### Add Context

**`@url`:** Paste in a URL for the extension to fetch and convert to markdown

**`@problems`:** Add workspace errors and warnings ('Problems' panel) for Aria to fix

**`@file`:** Adds a file's contents so you don't have to waste API requests approving read file (+ type to search files)

**`@folder`:** Adds folder's files all at once to speed up your workflow even more

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="right" width="350" src="https://github.com/user-attachments/assets/140c8606-d3bf-41b9-9a1f-4dbf0d4c90cb">

### Checkpoints: Compare and Restore

As Aria works through a task, the extension takes a snapshot of your workspace at each step. You can use the 'Compare' button to see a diff between the snapshot and your current workspace, and the 'Restore' button to roll back to that point.

For example, when working with a local web server, you can use 'Restore Workspace Only' to quickly test different versions of your app, then use 'Restore Task and Workspace' when you find the version you want to continue building from. This lets you safely explore different approaches without losing progress.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

## Testing

Aria is tested through a test harness that ask actuarial questions and tests whether Aria can correctly answer them. The questions come from actuarial textbooks and exams. The test harness is in a separate repository (and can be used with any VS Code chatbot extension). See https://github.com/hugolatendresse/actuarial-test-harness/.

## Cline

Aria is a fork of Cline. See https://github.com/cline/cline.
