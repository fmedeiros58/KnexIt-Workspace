/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/core", "<rootDir>/ai-system-anm-rag-qis"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^franc-min$": "<rootDir>/core/assistant/language/__mocks__/franc-min.ts",
  },
  modulePathIgnorePatterns: ["<rootDir>/backups/", "<rootDir>/.next/", "<rootDir>/.next-build/"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
};
