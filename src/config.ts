import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

// 站点全局配置
export const siteConfig: SiteConfig = {
	title: "Blog.iPHX.io",
	subtitle: "在忘记前记下",
	lang: "zh_CN", // 站点语言：zh_CN / en / ja / ...
	themeColor: {
		// 主题色 hue（0-360）：
		// 0 = 正赤、20 = 琥珀、45 = 金棕、200 = 蓝青、250 = 紫青、345 = 粉
		// 极简编辑风：黑白为主，赤红只作点缀
		hue: 25,
		fixed: true, // 极简风隐藏调色器，保持黑白红三色纪律
	},
	banner: {
		enable: false, // 极简编辑风：无大横幅，排版即视觉
		// 路径相对 /src 目录；以 / 开头则相对 /public
		// 暗夜赤焰横幅，与头像气场呼应
		src: "assets/images/banner.png",
		position: "center", // top / center / bottom
		credit: {
			enable: false, // 是否在横幅角落显示作者署名
			text: "",
			url: "",
		},
	},
	toc: {
		enable: true, // 文章右侧目录
		depth: 3, // 标题深度 1-3
	},
	favicon: [
		// 由 scripts/build-favicon.mjs 从 logo-source.png 自动生成；多尺寸响应不同设备
		{ src: "/favicon/favicon-16.png", sizes: "16x16" },
		{ src: "/favicon/favicon-32.png", sizes: "32x32" },
		{ src: "/favicon/favicon-48.png", sizes: "48x48" },
		{ src: "/favicon/favicon-64.png", sizes: "64x64" },
		// iOS 主屏 / 安卓桌面 / PWA
		{ src: "/favicon/apple-touch-icon.png", sizes: "180x180" },
		{ src: "/favicon/icon-192.png", sizes: "192x192" },
		{ src: "/favicon/icon-512.png", sizes: "512x512" },
	],
};

// 顶部导航栏
export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{
			name: "iPHX.io",
			url: "https://iphx.io",
			external: true,
		},
		{
			name: "GitHub",
			url: "https://github.com/wangver721",
			external: true,
		},
	],
};

// 个人侧边栏卡片
export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.png", // 你的头像
	name: "PHX",
	bio: "开发者 · 创业者 · IDC 与网络基础设施",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/wangver721",
		},
		{
			name: "Telegram",
			icon: "fa6-brands:telegram",
			url: "https://t.me/PHX_poster",
		},
		{
			name: "iPHX.io",
			icon: "fa6-solid:globe",
			url: "https://iphx.io",
		},
		{
			name: "RSS",
			icon: "fa6-solid:rss",
			url: "/rss.xml",
		},
	],
};

// 文章版权许可
// CC BY-NC-ND 4.0 = 必须署名、禁止商用、禁止改编（保留作者最大权益）
// 文章末尾的大块版权框已关闭；版权说明在 about 页 + footer 集中展示
export const licenseConfig: LicenseConfig = {
	enable: false,
	name: "CC BY-NC-ND 4.0",
	url: "https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh-hans",
};

// Giscus 评论系统配置（基于 GitHub Discussions，免费）
// 部署步骤：见 README.md "启用评论"
export const giscusConfig = {
	enable: true,
	repo: "wangver721/phx-blog",
	repoId: "R_kgDOSTCaIA",
	category: "Announcements",
	categoryId: "DIC_kwDOSTCaIM4C8PcG",
	mapping: "pathname", // pathname / url / title / og:title
	strict: "0",
	reactionsEnabled: "1",
	emitMetadata: "0",
	inputPosition: "top", // top / bottom
	// Giscus 主题：跟随站点明暗（Comments.astro 内动态同步）
	// 其它可选：dark / dark_dimmed / transparent_dark / noborder_gray / cobalt
	theme: "noborder_light",
	lang: "zh-CN",
	loading: "lazy",
};

// Cloudflare Web Analytics
// 在 Cloudflare Dashboard → Analytics & Logs → Web Analytics 创建后获得 token
export const cloudflareAnalyticsConfig = {
	enable: true,
	token: "6c90cfbec0ba4eb08eb4ca13dd10cd50",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	lightTheme: "github-light",
	darkTheme: "github-dark",
};
