/**
 * 新建博客文章脚手架（PHX 简化版）
 *
 * 用法：
 *   pnpm new-post 标题                  # 不带封面：生成 src/content/posts/标题.md
 *   pnpm new-post 标题 --cover          # 带封面：生成 src/content/posts/标题/index.md
 *                                         同时占位 cover.jpg（你需要替换为真实图片）
 *
 * 自动行为：
 *  - frontmatter 自动分配数字 id（扫描已有文章取最大 id + 1），URL 形如 /posts/N/
 *  - frontmatter 只保留 id / title / published / description（image 仅在 --cover 时出现）
 *  - 文件名建议英文小写、连字符分隔（中文也支持但 URL 不受影响，因为 URL 走的是 id）
 */

import fs from "node:fs";
import path from "node:path";

function getDate() {
	const today = new Date();
	const y = today.getFullYear();
	const m = String(today.getMonth() + 1).padStart(2, "0");
	const d = String(today.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * 扫描 src/content/posts/ 下所有 .md / .mdx，从 frontmatter 提取 id，返回当前最大值。
 * 若一篇都没有，返回 0（下一篇分配 1）。
 */
function getCurrentMaxId(postsDir) {
	if (!fs.existsSync(postsDir)) return 0;

	let maxId = 0;
	const idRegex = /^id:\s*(\d+)\s*$/m;

	const walk = (dir) => {
		for (const name of fs.readdirSync(dir)) {
			const full = path.join(dir, name);
			const stat = fs.statSync(full);
			if (stat.isDirectory()) {
				walk(full);
			} else if (/\.(md|mdx)$/i.test(name)) {
				const text = fs.readFileSync(full, "utf-8");
				// 只读 frontmatter 部分（最前面的 --- ... ---）
				const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
				if (!fm) continue;
				const match = fm[1].match(idRegex);
				if (match) {
					const n = Number.parseInt(match[1], 10);
					if (Number.isFinite(n) && n > maxId) maxId = n;
				}
			}
		}
	};

	walk(postsDir);
	return maxId;
}

const argv = process.argv.slice(2);
const withCover = argv.includes("--cover") || argv.includes("-c");
const positional = argv.filter((a) => !a.startsWith("-"));

if (positional.length === 0) {
	console.error(`错误：缺少文章名参数
用法：
  pnpm new-post 文章标题            # 普通文章
  pnpm new-post 文章标题 --cover    # 带封面图的文章`);
	process.exit(1);
}

// Windows / PowerShell / CMD 会按空格拆分参数。
// 因此这里把所有位置参数重新拼回完整标题，避免 `pnpm new-post 我的 标题`
// 只识别成 `我的`。
//
// 注意：英文半角引号 "..." 会被命令行本身吃掉；如果标题中要保留引号，
// 请使用中文引号 “...”，或在 PowerShell 中用单引号包住整段标题。
const title = positional.join(" ").trim();
const slug = title.replace(/\.(md|mdx)$/i, "");
const targetDir = path.resolve("src/content/posts");
const newId = getCurrentMaxId(targetDir) + 1;

let outFile;
let coverHint = "";

if (withCover) {
	const dir = path.join(targetDir, slug);
	if (fs.existsSync(dir)) {
		console.error(`错误：目录已存在 ${dir}`);
		process.exit(1);
	}
	fs.mkdirSync(dir, { recursive: true });
	outFile = path.join(dir, "index.md");
	const placeholder = path.join(dir, "cover.jpg");
	fs.writeFileSync(placeholder, "");
	coverHint = `\n📸 封面图占位：${placeholder}\n   请用你的真实封面替换它（建议 16:9 横图，至少 1200×675）`;
} else {
	outFile = path.join(targetDir, `${slug}.md`);
	if (fs.existsSync(outFile)) {
		console.error(`错误：文件已存在 ${outFile}`);
		process.exit(1);
	}
}

const frontmatter = withCover
	? `---
id: ${newId}
title: ${title}
published: ${getDate()}
description: ''
image: ./cover.jpg
---

`
	: `---
id: ${newId}
title: ${title}
published: ${getDate()}
description: ''
---

`;

fs.writeFileSync(outFile, frontmatter);

console.log(`✅ 已创建：${outFile}`);
console.log(`🔗 上线后 URL：/posts/${newId}/`);
if (coverHint) console.log(coverHint);
console.log(
	`\n下一步：编辑文件 → git add . && git commit -m "post: ${title}" && git push`,
);
