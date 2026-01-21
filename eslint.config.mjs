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
];

export default eslintConfig;
