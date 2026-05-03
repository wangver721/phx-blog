/**
 * 从一张高分辨率 logo 源图，批量生成所有 favicon 尺寸到 public/favicon/
 * 用法：node scripts/build-favicon.mjs [源图路径]
 *
 * 默认源图：assets/logo-source.png（项目外的素材目录）
 * 输出尺寸：16 / 32 / 48 / 64 / 180（apple）/ 192 / 512
 *
 * 注意：脚本会先把源图按短边居中裁成正方形，再缩到目标尺寸；
 *      sharp 不直接产 .ico，但现代浏览器都接受 png 作为 favicon。
 */
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// 源图：优先用命令行第一个参数，否则用项目同级 assets/logo-source.png
const srcArg = process.argv[2];
const defaultSrc = resolve(
	projectRoot,
	"..",
	"..",
	"..",
	".cursor",
	"projects",
	"c-Users-Desktop-Cursor-PHX-Blog",
	"assets",
	"logo-source.png",
);
const srcPath = srcArg ? resolve(srcArg) : defaultSrc;

if (!existsSync(srcPath)) {
	console.error(`❌ 源图不存在：${srcPath}`);
	process.exit(1);
}

const outDir = resolve(projectRoot, "public", "favicon");
mkdirSync(outDir, { recursive: true });

// 读取源图，按短边裁正方形（trim 透明边后再裁，避免边距太大）
const baseBuffer = await sharp(srcPath)
	.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
	.toBuffer();
const meta = await sharp(baseBuffer).metadata();
const side = Math.min(meta.width ?? 0, meta.height ?? 0);
const square = await sharp(baseBuffer)
	.resize({
		width: side,
		height: side,
		fit: "cover",
		position: "center",
	})
	.toBuffer();

// 输出尺寸表（[尺寸, 文件名, 是否需要 light/dark 双色]）
const targets = [
	[16, "favicon-16.png"],
	[32, "favicon-32.png"],
	[48, "favicon-48.png"],
	[64, "favicon-64.png"],
	[180, "apple-touch-icon.png"], // iOS 主屏图标
	[192, "icon-192.png"], // Android / PWA
	[512, "icon-512.png"], // PWA 大图
];

console.log(`📦 源图：${srcPath}`);
console.log(`📁 输出目录：${outDir}\n`);

for (const [size, name] of targets) {
	const outPath = resolve(outDir, name);
	await sharp(square)
		.resize(size, size, { fit: "cover" })
		.png({ compressionLevel: 9, quality: 95 })
		.toFile(outPath);
	console.log(`  ✓ ${name} (${size}×${size})`);
}

// 顶级 favicon.png（浏览器默认会请求 /favicon.ico，但许多框架兼容 .png）
await sharp(square)
	.resize(64, 64, { fit: "cover" })
	.png()
	.toFile(resolve(projectRoot, "public", "favicon.png"));
console.log("  ✓ /favicon.png (64×64)");

console.log("\n✅ 全部生成完毕。");
