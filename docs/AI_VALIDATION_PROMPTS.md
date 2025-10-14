# 🤖 AI Validation Prompts

## Overview
These prompts help ensure AI-generated code follows project standards and prevents errors. Use these prompts when working with AI to validate code quality.

## 🔍 **Pre-Generation Validation Prompts**

### **Before Writing Any Code:**
```
Before generating code, please:
1. Run `npx tsc --noEmit` to check for existing TypeScript errors
2. Run `npm run lint` to check for existing ESLint errors
3. Check the database schema using Supabase MCP
4. Review existing similar code in the codebase
5. Confirm the requirements are clear and complete

Only proceed with code generation if all checks pass.
```

### **For Database Operations:**
```
Before writing database code, please:
1. Use Supabase MCP to verify the table structure
2. Check existing RLS policies
3. Verify the data types match the schema
4. Ensure proper error handling is included
5. Confirm the query follows security best practices

Show me the table structure before writing the query.
```

### **For UI Components:**
```
Before creating UI components, please:
1. Check existing component patterns in src/components
2. Verify mobile-first design principles
3. Ensure proper TypeScript interfaces
4. Include accessibility features
5. Add data-testid attributes for testing

Show me similar existing components first.
```

## ✅ **Post-Generation Validation Prompts**

### **After Code Generation:**
```
After generating the code, please:
1. Run `npx tsc --noEmit` to validate TypeScript
2. Run `npm run lint` to validate ESLint rules
3. Check for any console errors or warnings
4. Verify the code follows project patterns
5. Confirm all requirements are met

Show me the validation results before proceeding.
```

### **For Type Safety:**
```
Please validate this code for type safety:
- Are all variables properly typed?
- Are there any `any` types that should be replaced?
- Are null/undefined checks included where needed?
- Are function return types explicit?
- Are interface definitions complete?

Fix any type issues before finalizing.
```

### **For React Best Practices:**
```
Please validate this React code:
- Are all hooks used correctly?
- Are dependency arrays complete?
- Are keys provided for list items?
- Is error handling included?
- Are loading states handled?
- Is the component accessible?

Fix any React issues before finalizing.
```

## 🚨 **Error Prevention Prompts**

### **When AI Suggests Problematic Code:**
```
I notice this code might have issues:
- [Specific concern]

Please:
1. Check the TypeScript configuration
2. Verify against ESLint rules
3. Review the database schema
4. Test the functionality
5. Provide a corrected version

Don't proceed until all issues are resolved.
```

### **For Breaking Changes:**
```
This change might affect existing functionality:
- [List potential impacts]

Please:
1. Identify all affected files
2. Check for breaking changes
3. Provide migration steps
4. Include rollback instructions
5. Test the changes thoroughly

Confirm the impact before implementing.
```

## 📋 **Quality Assurance Prompts**

### **Code Review Checklist:**
```
Please review this code against our standards:
- [ ] TypeScript: No errors, proper types, no `any`
- [ ] ESLint: No errors, follows project rules
- [ ] React: Proper hooks, error handling, accessibility
- [ ] Database: Type-safe queries, proper error handling
- [ ] UI/UX: Mobile-first, consistent styling, loading states
- [ ] Testing: data-testid attributes, testable code
- [ ] Documentation: Clear comments, proper interfaces

Mark each item as complete or provide fixes.
```

### **Performance Check:**
```
Please check this code for performance issues:
- Are there any unnecessary re-renders?
- Are expensive operations memoized?
- Are database queries optimized?
- Are images and assets optimized?
- Is the bundle size reasonable?

Optimize any performance issues found.
```

## 🔧 **Debugging Prompts**

### **When Code Doesn't Work:**
```
This code isn't working as expected:
- [Describe the issue]

Please:
1. Check for TypeScript errors
2. Check for runtime errors
3. Verify the database schema
4. Test the functionality step by step
5. Provide a working solution

Don't guess - verify each step.
```

### **For Database Issues:**
```
The database operation is failing:
- [Describe the error]

Please:
1. Check the table structure
2. Verify RLS policies
3. Check data types
4. Test the query manually
5. Provide a corrected version

Show me the exact error and the fix.
```

## 📚 **Learning Prompts**

### **For Understanding Patterns:**
```
I want to understand how [feature] works in this project:
- Show me existing implementations
- Explain the patterns used
- Identify best practices
- Point out potential improvements
- Provide examples

Help me learn the project's conventions.
```

### **For Best Practices:**
```
What are the best practices for [specific task] in this project?
- Show me examples from the codebase
- Explain the reasoning
- Identify common mistakes
- Provide guidelines
- Share resources

Help me follow project standards.
```

## 🎯 **Success Validation Prompts**

### **Final Check:**
```
Before considering this task complete, please confirm:
- [ ] All TypeScript errors are resolved
- [ ] All ESLint errors are resolved
- [ ] The functionality works as expected
- [ ] The code follows project patterns
- [ ] All requirements are met
- [ ] Documentation is updated
- [ ] Tests are included (if applicable)

Provide a summary of what was accomplished.
```

### **Deployment Readiness:**
```
Is this code ready for deployment?
- [ ] Passes all validation checks
- [ ] No breaking changes
- [ ] Proper error handling
- [ ] Mobile compatibility
- [ ] Performance optimized
- [ ] Security reviewed
- [ ] Documentation complete

Confirm deployment readiness or list remaining tasks.
```

## 🚀 **Usage Instructions**

### **How to Use These Prompts:**
1. **Copy the relevant prompt** for your situation
2. **Customize the details** with your specific requirements
3. **Paste it in your AI conversation** before or after code generation
4. **Wait for validation** before proceeding
5. **Address any issues** that are identified

### **When to Use Each Prompt:**
- **Pre-Generation**: Before asking AI to write code
- **Post-Generation**: After AI provides code
- **Error Prevention**: When you suspect issues
- **Quality Assurance**: For final validation
- **Debugging**: When code doesn't work
- **Learning**: To understand project patterns

### **Best Practices:**
- **Always validate** before accepting code
- **Don't skip steps** in the validation process
- **Ask for explanations** when you don't understand
- **Request examples** from existing codebase
- **Verify functionality** before finalizing

---

**These prompts ensure AI-generated code meets our high standards and prevents the error accumulation cycle!** 🛡️
