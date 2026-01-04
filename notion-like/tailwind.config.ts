import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Notion color palette
        notion: {
          bg: "#FFFFFF",
          border: "#E9E9E7",
          hover: "#EFEFEF",
          text: "#37352F",
          lighttext: "#6F6D66",
        },
      },
    },
  },
  plugins: [],
};

export default config;
