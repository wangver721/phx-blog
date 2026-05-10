/**
 * 把文章里 Typora 风格的本地绝对路径图片，自动复制到文章子目录并改写为相对引用。
 *
 * 应用场景：
 *  在 Typora（或任意编辑器）里写文章，复制粘贴图片后会得到形如：
 *    ![image-20260503224219431](C:\Users\王先生\AppData\Roaming\Typora\typora-user-images\image-20260503224219431.png)
 *    ![demo](C:\Users\王先生\AppData\Roaming\Typora\typora-user-images\demo.gif)
 *  push 后 CF Pages 找不到这个本地路径，会构建失败。
 *  本脚本扫描所有 .md / .mdx，把这种绝对路径图片：
 *    1. 复制到文章对应子目录（必要时把单 .md 自动迁移成 子目录/index.md 形式）
 *    2. 改写 markdown / html 引用为 ./image-xxx.png / ./demo.gif
 *
 * 用法：
 *   node scripts/process-images.mjs            # 处理所有文章
 *   node scripts/process-images.mjs --dry-run  # 只报告，不改文件
 *
 * 集成：
 *   在 simple-git-hooks 的 pre-commit 钩子里调用，提交前自动处理 + git add 新增物
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const POSTS_DIR = path.resolve("src/content/posts");
const DRY_RUN = process.argv.includes("--dry-run");
const FROM_HOOK = process.argv.includes("--from-hook");
const IMAGE_EXTENSIONS = "png|jpe?g|gif|webp|svg|bmp";

// 匹配 Markdown 图片：![alt](路径)
//   路径形式：
//     C:\Users\xxx\foo.gif  或  C:/Users/xxx/foo.gif   （Windows 绝对路径）
//     /Users/xxx/foo.gif                                （macOS 绝对路径）
//     file:///C:/Users/xxx/foo.gif                      （file:// 协议）
// 支持 png / jpg / jpeg / gif / webp / svg / bmp。
// 注意：路径中允许出现空格；用非贪婪匹配直到图片扩展名。
const MD_IMG_RE = new RegExp(
	String.raw`!\[([^\]]*)\]\((file:\/\/\/[^)\n]+?\.(?:${IMAGE_EXTENSIONS})|[A-Za-z]:[\\/][^)\n]+?\.(?:${IMAGE_EXTENSIONS})|\/[A-Za-z][^)\n]*?\.(?:${IMAGE_EXTENSIONS}))(?:\s+"[^"]*")?\)`,
	"gi",
);

// 匹配 HTML <img src="路径" ...>
const HTML_IMG_RE = new RegExp(
	String.raw`<img\s+[^>]*src=["'](file:\/\/\/[^"']+?\.(?:${IMAGE_EXTENSIONS})|[A-Za-z]:[\\/][^"']+?\.(?:${IMAGE_EXTENSIONS})|\/[A-Za-z][^"']*?\.(?:${IMAGE_EXTENSIONS}))["'][^>]*\/?>`,
	"gi",
);

// 把 file:///C:/foo 或 C:\foo 标准化为 Windows 文件系统路径
function normalizeAbsolutePath(p) {
	let s = decodeURI(p);
	if (s.startsWith("file:///")) s = s.slice("file:///".length);
	// 反斜杠转正斜杠，但保留盘符冒号
	s = s.replace(/\\/g, "/");
	// macOS 风格 /Users/... 保留原样
	if (/^[A-Za-z]:\//.test(s)) {
		// Node 的 path 在 Windows 上能正确处理 C:/...
		return path.normalize(s);
	}
	return path.normalize(s);
}

/**
 * 收集一个 .md 文件里所有"需要被处理"的图片引用。
 * 返回 [{ rawMatch, captured, kind }] 数组。
 *  - rawMatch: 原文里的完整匹配字符串（用于全文 replace）
 *  - captured: 原始路径字符串
 *  - kind: 'md' | 'html'
 *  - alt: 仅 md 有
 */
function collectImageRefs(content) {
	const refs = [];
	for (const m of content.matchAll(MD_IMG_RE)) {
		refs.push({
			kind: "md",
			rawMatch: m[0],
			alt: m[1],
			captured: m[2],
		});
	}
	for (const m of content.matchAll(HTML_IMG_RE)) {
		refs.push({
			kind: "html",
			rawMatch: m[0],
			alt: "",
			captured: m[1],
		});
	}
	return refs;
}

/**
 * 把单文件 src/content/posts/foo.md 迁移成 src/content/posts/foo/index.md
 * 返回新的 .md 路径。
 */
function migrateToSubdirectory(mdPath) {
	const base = path.basename(mdPath, path.extname(mdPath));
	const parent = path.dirname(mdPath);
	const dir = path.join(parent, base);
	const target = path.join(dir, "index.md");

	if (fs.existsSync(dir)) {
		throw new Error(
			`想把 ${mdPath} 迁移到 ${dir}/index.md，但目录已存在。请手动处理。`,
		);
	}
	fs.mkdirSync(dir, { recursive: true });
	fs.renameSync(mdPath, target);
	return target;
}

/**
 * 处理单个 .md 文件，返回 { changed, migrated, copies, newPath }
 */
function processOne(mdPath) {
	const original = fs.readFileSync(mdPath, "utf-8");
	const refs = collectImageRefs(original);
	const absoluteRefs = refs.filter((r) => {
		const p = r.captured;
		return /^file:\/\/\//.test(p) || /^[A-Za-z]:[\\/]/.test(p) || /^\/[A-Za-z]/.test(p);
	});

	if (absoluteRefs.length === 0) {
		return { changed: false, migrated: false, copies: [], newPath: mdPath };
	}

	// 决定文章资源目录：
	//  - 子目录模式（foo/index.md）：直接用 dirname
	//  - 单文件模式（foo.md）：迁移到 foo/index.md
	let workingPath = mdPath;
	let migrated = false;
	const isIndexMd = path.basename(mdPath).match(/^index\.(md|mdx)$/i);
	if (!isIndexMd) {
		if (DRY_RUN) {
			console.log(`  ⚠ 单文件 → 需要迁移到子目录：${mdPath}`);
		} else {
			workingPath = migrateToSubdirectory(mdPath);
			migrated = true;
			console.log(`  📦 已迁移：${path.basename(mdPath)} → ${path.relative(POSTS_DIR, workingPath)}`);
		}
	}

	const articleDir = path.dirname(workingPath);

	let updated = fs.readFileSync(workingPath, "utf-8");
	const copies = [];
	const failed = [];

	for (const ref of absoluteRefs) {
		const srcAbs = normalizeAbsolutePath(ref.captured);
		if (!fs.existsSync(srcAbs)) {
			failed.push({ ref, reason: "源图不存在" });
			console.warn(`  ✗ 源图不存在：${srcAbs}`);
			continue;
		}

		const filename = path.basename(srcAbs);
		const dest = path.join(articleDir, filename);

		// 如果目标已存在但不一样，加时间戳避免覆盖
		let finalDest = dest;
		if (fs.existsSync(dest)) {
			const a = fs.readFileSync(srcAbs);
			const b = fs.readFileSync(dest);
			if (!a.equals(b)) {
				const ext = path.extname(filename);
				const stem = path.basename(filename, ext);
				finalDest = path.join(articleDir, `${stem}-${Date.now()}${ext}`);
			}
		}

		if (!DRY_RUN) {
			fs.copyFileSync(srcAbs, finalDest);
		}
		copies.push({ from: srcAbs, to: finalDest });

		const relPath = `./${path.basename(finalDest)}`;
		// 替换原引用
		const replaced =
			ref.kind === "md"
				? `![${ref.alt}](${relPath})`
				: ref.rawMatch.replace(ref.captured, relPath);
		updated = updated.split(ref.rawMatch).join(replaced);
		console.log(`  ✓ ${path.basename(srcAbs)} → ${path.relative(POSTS_DIR, finalDest)}`);
	}

	if (!DRY_RUN && updated !== fs.readFileSync(workingPath, "utf-8")) {
		fs.writeFileSync(workingPath, updated);
	}

	return {
		changed: true,
		migrated,
		copies,
		failed,
		newPath: workingPath,
		originalPath: mdPath,
	};
}

/**
 * 递归收集所有 .md / .mdx 文件
 */
function collectMarkdownFiles(dir) {
	const out = [];
	if (!fs.existsSync(dir)) return out;
	for (const name of fs.readdirSync(dir)) {
		const full = path.join(dir, name);
		const stat = fs.statSync(full);
		if (stat.isDirectory()) {
			out.push(...collectMarkdownFiles(full));
		} else if (/\.(md|mdx)$/i.test(name)) {
			out.push(full);
		}
	}
	return out;
}

// === main ===
console.log(`🔍 扫描 ${POSTS_DIR} ${DRY_RUN ? "(dry-run)" : ""}`);
const files = collectMarkdownFiles(POSTS_DIR);

let totalChanged = 0;
let totalMigrated = 0;
const newFilesToStage = [];

for (const file of files) {
	const result = processOne(file);
	if (result.changed) {
		totalChanged++;
		if (result.migrated) totalMigrated++;
		newFilesToStage.push(result.newPath);
		// 迁移后的文章原始路径已删除，需要 git rm 它
		if (result.migrated) newFilesToStage.push(result.originalPath);
		// 复制的图片
		for (const c of result.copies) newFilesToStage.push(c.to);
	}
}

if (totalChanged === 0) {
	console.log("✓ 没有需要处理的图片，全部已经是相对路径或外链。");
} else {
	console.log(`\n📊 共处理 ${totalChanged} 篇文章${totalMigrated > 0 ? `（其中 ${totalMigrated} 篇自动迁移到子目录）` : ""}`);
}

// 如果是从 git hook 调用，自动把变更加进暂存区
if (FROM_HOOK && !DRY_RUN && newFilesToStage.length > 0) {
	console.log("\n🔗 自动 git add 处理后的文件...");
	for (const f of newFilesToStage) {
		try {
			execSync(`git add "${f}"`, { stdio: "ignore" });
		} catch {
			// 文件已删除（迁移源）→ git add 会失败，改用 git rm
			try {
				execSync(`git rm -- "${f}"`, { stdio: "ignore" });
			} catch {
				/* ignore */
			}
		}
	}
	console.log("✓ 完成");
}
