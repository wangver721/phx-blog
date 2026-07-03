/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme")
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue,mjs}"],
  darkMode: "class", // allows toggling dark mode manually
  theme: {
    extend: {
      fontFamily: {
        // 正文：英文 Roboto + 中文思源黑体
        sans: [
          "Roboto",
          '"Noto Sans SC Variable"',
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "sans-serif",
          ...defaultTheme.fontFamily.sans,
        ],
        // 标题展示：思源宋体，编辑刊物气质
        display: [
          '"Noto Serif SC Variable"',
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Songti SC"',
          "SimSun",
          "serif",
        ],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
