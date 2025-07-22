#!/usr/bin/env node
/**
 * Скрипт: отправляет Claude краткое описание проекта и просит
 * найти потенциальные проблемы (линт, типы, 0G-SDK вызовы и т. д.)
 */
import fs from "fs/promises"
import { claude } from "../lib/claude/client.js"

async function main() {
  // 1) быстрый «контекст» (package.json + tsconfig + last git diff)
  const pkg = await fs.readFile("./package.json", "utf8")
  const diff = (await import("child_process"))
               .execSync("git diff -U0 --no-color", {encoding:"utf8"})
               .slice(0, 30_000)          // не забываем лимит токенов

  const system = `You are Claude Code — senior full-stack auditor.
  Project: Next.js 14 + wagmi + 0G SDK. TASK: review diff → suggest fixes.`

  const user = `package.json:
  \`\`\`json\n${pkg}\n\`\`\`

  Last diff:
  \`\`\`diff\n${diff}\n\`\`\`

  Please:
  1. List critical TS/ESLint errors.
  2. Check 0G Storage & Compute calls for wrong params.
  3. Return unified diffs to fix issues.`

  const stream = await claude.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 8000,
    temperature: 0,
    system,
    messages: [{ role: "user", content: user }],
    stream: true,
  })

  // выводим поток в терминал
  for await (const delta of stream) process.stdout.write(delta.content ?? "")
}

main().catch(e => { console.error(e); process.exit(1) })
