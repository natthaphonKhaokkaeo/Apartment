import tseslint from "typescript-eslint";

// Fast, deterministic static checks for all tracked TypeScript/TSX source.
// Type-aware security checks remain a separate P7 follow-up gate.
export default tseslint.config(
  {ignores:["**/node_modules/**","**/dist/**","**/coverage/**","apps/api/drizzle/**"]},
  ...tseslint.configs.recommended,
  {
    files:["apps/**/*.{ts,tsx}","packages/**/*.{ts,tsx}"],
    rules:{
      // Existing DTO/tests legitimately handle unknown provider payloads.
      "@typescript-eslint/no-explicit-any":"off",
      // P5 Billing Batch is concurrently being implemented; never auto-fix it from this QA pass.
      "prefer-const":"warn",
      // Surface dead code without blocking unrelated existing project work.
      "@typescript-eslint/no-unused-vars":["warn",{argsIgnorePattern:"^_",varsIgnorePattern:"^_"}]
    }
  }
);
