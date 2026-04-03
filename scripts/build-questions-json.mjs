import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFilePath), "..");
const readmePath = path.join(repoRoot, "README.md");
const outputPath = path.join(repoRoot, "docs", "questions.json");

function normalizePathForWindows(p) {
  if (process.platform === "win32" && p.startsWith("/")) {
    return p.slice(1);
  }
  return p;
}

function parseQuestions(markdown) {
  const lines = markdown.split(/\r?\n/);
  const questions = [];
  const headingPattern = /^\s*(\d+)\.\s+###\s+(.+)$/;
  const backToTopPattern = /\*\*\[⬆ Back to Top\]\(#table-of-contents\)\*\*/;

  let current = null;

  for (const line of lines) {
    const headingMatch = line.match(headingPattern);

    if (headingMatch) {
      if (current) {
        current.answerMarkdown = current.answerLines.join("\n").trim();
        delete current.answerLines;
        questions.push(current);
      }

      const id = Number(headingMatch[1]);
      const question = headingMatch[2].trim();

      current = {
        id,
        question,
        answerLines: [],
      };

      continue;
    }

    if (!current) {
      continue;
    }

    if (backToTopPattern.test(line)) {
      current.answerMarkdown = current.answerLines.join("\n").trim();
      delete current.answerLines;
      questions.push(current);
      current = null;
      continue;
    }

    current.answerLines.push(line);
  }

  if (current) {
    current.answerMarkdown = current.answerLines.join("\n").trim();
    delete current.answerLines;
    questions.push(current);
  }

  const slugger = new GithubSlugger();
  return questions.map((item) => ({
    ...item,
    slug: slugger.slug(item.question),
  }));
}

async function main() {
  const safeReadmePath = normalizePathForWindows(readmePath);
  const safeOutputPath = normalizePathForWindows(outputPath);

  const markdown = await fs.readFile(safeReadmePath, "utf8");
  const questions = parseQuestions(markdown);

  await fs.mkdir(path.dirname(safeOutputPath), { recursive: true });
  await fs.writeFile(safeOutputPath, `${JSON.stringify(questions, null, 2)}\n`, "utf8");

  console.log(`Generated ${questions.length} interview questions at docs/questions.json`);
}

main().catch((error) => {
  console.error("Failed to generate question data:", error);
  process.exitCode = 1;
});
