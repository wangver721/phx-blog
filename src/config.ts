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
	title: "iPHX.io",
	subtitle: "在忘记前记下",
	lang: "zh_CN", // 站点语言：zh_CN / en / ja / ...
	themeColor: {
		// 主题色 hue（0-360）：
		// 0 = 正赤、20 = 琥珀、45 = 金棕、200 = 蓝青、250 = 紫青、345 = 粉
		// 0 = 浓郁纯正的赤红，与头像气场更同频
		hue: 0,
		fixed: false, // true 则隐藏右上角主题色调节器
	},
	banner: {
		enable: true, // 启用首页大横幅
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
	enable: false, // 完成 Giscus 配置后改为 true
	repo: "wangver721/phx-blog", // 仓库 owner/name（部署后按实际仓库改）
	repoId: "", // 在 https://giscus.app 生成
	category: "Announcements", // Discussions 分类名
	categoryId: "", // 在 https://giscus.app 生成
	mapping: "pathname", // pathname / url / title / og:title
	strict: "0",
	reactionsEnabled: "1",
	emitMetadata: "0",
	inputPosition: "top", // top / bottom
	theme: "preferred_color_scheme", // light / dark / preferred_color_scheme
	lang: "zh-CN",
	loading: "lazy",
};

// Cloudflare Web Analytics
// 在 Cloudflare Dashboard → Analytics & Logs → Web Analytics 创建后获得 token
export const cloudflareAnalyticsConfig = {
	enable: false, // 拿到 token 后改为 true
	token: "",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// 注意：部分样式（如背景色）会被 astro.config.mjs 中的覆盖项替换
	// 请选择深色主题，因为本博客主题目前仅支持深色代码背景
	theme: "github-dark",
};
