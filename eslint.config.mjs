import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  {
    settings: {
      next: {
        rootDir: "apps/web",
      },
    },
  },
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "apps/web/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "apps/web/next-env.d.ts",
    // Generated artifacts and packaged desktop bundle.
    ".vercel/**",
    "coverage/**",
    "archive/**",
    "NexResto  Restaurant &amp; Hotel Digital Menus-win32-x64/**",
    // Non-Next runtime/tooling scripts use CommonJS intentionally.
    "desktop/**",
    "scripts/**",
    "functions/**",
    "apps/api/**",
    "apps/web/app/[storeId]/dashboard/tables/page.tsx",
    "apps/web/app/api/reports/subscription-reminders/route.ts",
    "vite.config.ts",
  ]),
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["__tests__/**/*.ts", "__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx}", "components/**/*.{ts,tsx}", "context/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/refs": "off",
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      "jsx-a11y/alt-text": "off",
      "@next/next/no-html-link-for-pages": "off",
      "prefer-const": "off",
    },
  },
]);

export default eslintConfig;
