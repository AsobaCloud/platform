# AI Coding Guidelines for Ona Energy Management Platform

## Core Principles

### 1. EXPLORE > PLAN > CODE > VALIDATE > DEPLOY
**NEVER write code without following this exact sequence:**

1. **EXPLORE**: Thoroughly examine the codebase to understand existing patterns, functions, and architecture
2. **PLAN**: Write out a detailed plan of what needs to be changed and how
3. **CODE**: Implement only the minimal changes necessary
4. **VALIDATE**: Run safety checker and test functionality
5. **DEPLOY**: Only deploy after validation passes

### 2. Codebase Continuity
- **Think harder and thoroughly examine similar areas of the codebase** to ensure your proposed approach fits seamlessly with the established patterns and architecture
- **Aim to make only minimal and necessary changes**, avoiding any disruption to the existing design
- **Whenever possible, take advantage of components, utilities, or logic that have already been implemented** to maintain consistency, reduce duplication, and streamline integration with the current system

### 3. Function Management
- **ALWAYS search for existing functions before creating new ones**
- **MODIFY existing functions instead of duplicating them**
- **Maintain a mental inventory of what already exists**
- **Use proper search/replace with sufficient context**

### 4. Validation Requirements
- **Run safety checker before every deployment**
- **Address ALL safety checker warnings** - do not ignore or modify the checker
- **Test functionality after changes**
- **Commit changes only after validation passes**

## Pre-Code Checklist

Before writing ANY code, answer these questions:

1. **What already exists?** (Search the codebase)
2. **What needs to be changed?** (Identify specific functions/files)
3. **How does this fit with existing patterns?** (Understand architecture)
4. **What's the minimal change needed?** (Avoid over-engineering)
5. **Have I checked for duplicates?** (Prevent function conflicts)

## Code Quality Standards

- **No duplicate functions** - Always modify existing functions
- **Consistent naming** - Follow established patterns
- **Proper error handling** - Use try/catch blocks
- **Clean code** - Avoid unnecessary complexity
- **Documentation** - Comment complex logic

## Deployment Protocol

1. **Safety Check**: `node js-safety-checker.js` must pass
2. **Function Check**: No duplicate function definitions
3. **Test**: Verify functionality works as expected
4. **Deploy**: Only after all checks pass
5. **Commit**: Document changes with clear commit messages

## Common Anti-Patterns to Avoid

- ❌ Adding new functions without checking if they exist
- ❌ Ignoring safety checker warnings
- ❌ Making changes without understanding existing code
- ❌ Over-engineering simple solutions
- ❌ Breaking existing functionality
- ❌ Creating duplicate code

## Success Metrics

- ✅ Safety checker passes without warnings
- ✅ No duplicate function definitions
- ✅ Minimal code changes
- ✅ Existing functionality preserved
- ✅ New functionality works as expected
- ✅ Code follows established patterns

---

**Remember: The goal is to maintain and enhance the existing system, not rebuild it from scratch.**