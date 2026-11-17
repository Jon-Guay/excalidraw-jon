---
name: fast-demo
description: Toggle fast demo mode, which skips the plan and critique subagents. Use when the user runs /fast-demo or asks to turn fast demo on or off.
disable-model-invocation: true
---

# Fast demo

Toggle the local switch at `.cursor/fast-demo`. That file is gitignored. Do not commit it.

1. Read `.cursor/fast-demo` if it exists.
2. If the first line is `on`, write `off`. Otherwise write `on`, creating the file if it is missing.
3. Reply with one sentence: the new state, and that `plan-subagent` and `critique-plan-subagent` run only while it is off.
