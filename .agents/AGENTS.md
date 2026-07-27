# Agent Coding Rules

The following rules have been established to prevent the AI from breaking existing functionality when making changes. These rules must be strictly adhered to during all execution phases.

## 1. Strict Type Checking Before Deployment
Vite's default build process (`esbuild`) strips TypeScript types without type-checking, which allows fatal `ReferenceErrors` (like missing imports) to compile successfully but crash at runtime.
- **Rule**: NEVER rely solely on `npm run build:frontend` to verify code correctness.
- **Action**: After modifying TypeScript/React code, ALWAYS run full TypeScript compiler checks (`npx tsc --noEmit`) to ensure all imports are valid and there are no type errors before declaring a task complete.

## 2. Explicit Import Verification
When using `multi_replace_file_content` or `replace_file_content` to inject new components, utility functions, or variables into a file:
- **Rule**: Do not assume the import already exists. 
- **Action**: Always explicitly verify that the required `import` statement exists at the top of the file. If it does not, add it in the same tool call.

## 3. Avoid Blind String Replacements
- **Rule**: When replacing text, ensure the `TargetContent` is uniquely identified. 
- **Action**: Include enough surrounding context in `TargetContent` to ensure you aren't accidentally replacing the wrong occurrence of a common variable name.

## 4. Run Linter on Modified Files
- **Rule**: Avoid introducing syntax errors or unused variables.
- **Action**: Run ESLint on modified files to catch obvious code quality issues before passing the changes back to the user.
