import nextConfig from "eslint-config-next";
import pinglassPlugin from "./eslint-rules/no-antipatterns.mjs";

const eslintConfig = [
  ...nextConfig.map(config => {
    // Override strict React compiler rules to warnings in the react-hooks config
    if (config.plugins?.["react-hooks"]) {
      return {
        ...config,
        rules: {
          ...config.rules,
          "react-hooks/purity": "warn",
          "react-hooks/set-state-in-effect": "warn",
        },
      };
    }
    return config;
  }),
  {
    ignores: [
      "coverage/**",
      "test-results/**",
      "node_modules/**",
      ".next/**",
    ],
  },
  // PinGlass custom anti-pattern rules
  {
    plugins: {
      "pinglass": pinglassPlugin,
    },
    rules: {
      // Block commit on these
      "pinglass/no-user-status": "error",
      "pinglass/no-wrong-table": "error",
      // Warnings
      "pinglass/no-hardcoded-price": "warn",
      "pinglass/prefer-returning": "warn",
    },
  },
  // Disable strict rules for test files
  {
    files: ["tests/**/*", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "pinglass/no-user-status": "off",
      "pinglass/no-wrong-table": "off",
      "pinglass/no-hardcoded-price": "off",
    },
  },
];

export default eslintConfig;
