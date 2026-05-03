/**
 * 新建博客文章脚手架（PHX 简化版）
 *
 * 用法：
 *   pnpm new-post 标题                  # 不带封面：生成单文件 src/content/posts/标题.md
 *   pnpm new-post 标题 --cover          # 带封面：生成子目录 src/content/posts/标题/index.md
 *                                         同时占位 cover.jpg（你需要替换为真实图片）
 *
 * 说明：
 *  - frontmatter 只保留 title / published / description（image 仅在 --cover 时出现）
 *  - 分类与标签已被全站关闭，不再生成
 *  - 文件名建议英文小写、连字符分隔（中文也支持但 URL 会被 encode）
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

const slug = positional[0].replace(/\.(md|mdx)$/i, "");
const targetDir = path.resolve("src/content/posts");

let outFile;
let coverHint = "";

if (withCover) {
	// 子目录模式：src/content/posts/<slug>/index.md + cover.jpg
	const dir = path.join(targetDir, slug);
	if (fs.existsSync(dir)) {
		console.error(`错误：目录已存在 ${dir}`);
		process.exit(1);
	}
	fs.mkdirSync(dir, { recursive: true });
	outFile = path.join(dir, "index.md");
	// 留一个空 cover.jpg 占位（0 字节）提醒你替换
	const placeholder = path.join(dir, "cover.jpg");
	fs.writeFileSync(placeholder, "");
	coverHint = `\n📸 封面图占位：${placeholder}\n   请用你的真实封面替换它（建议 16:9 横图，最少 1200×675）`;
} else {
	// 单文件模式
	outFile = path.join(targetDir, `${slug}.md`);
	if (fs.existsSync(outFile)) {
		console.error(`错误：文件已存在 ${outFile}`);
		process.exit(1);
	}
}

const frontmatter = withCover
	? `---
title: ${positional[0]}
published: ${getDate()}
description: ''
image: ./cover.jpg
---

`
	: `---
title: ${positional[0]}
published: ${getDate()}
description: ''
---

`;

fs.writeFileSync(outFile, frontmatter);

console.log(`✅ 已创建：${outFile}${coverHint}`);
console.log(`\n下一步：编辑文件 → git add . && git commit -m "post: ${positional[0]}" && git push`);
