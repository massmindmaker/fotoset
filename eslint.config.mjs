import nextConfig from "eslint-config-next";

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
    ],
  },
];

export default eslintConfig;
