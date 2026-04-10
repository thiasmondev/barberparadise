import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4EAADB",
          50: "#EBF5FB",
          100: "#D6EBF7",
          200: "#ADD7EF",
          300: "#85C3E7",
          400: "#5CB0DF",
          500: "#4EAADB",
          600: "#2B8FC4",
          700: "#216E97",
          800: "#174D6A",
          900: "#0D2C3D",
        },
        dark: {
          DEFAULT: "#252525",
          50: "#F5F5F5",
          100: "#E0E0E0",
          200: "#BDBDBD",
          300: "#9E9E9E",
          400: "#757575",
          500: "#616161",
          600: "#424242",
          700: "#353535",
          800: "#252525",
          900: "#181818",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Montserrat", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
