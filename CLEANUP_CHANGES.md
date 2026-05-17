# Complete Cleanup Guide for Standalone Deployment

## What We're Doing:
1. **Remove lovable-tagger** (development dependency only)
2. **Replace all lovable.app domain references** with configurable base URLs
3. **Remove AI gateway dependence** from the /run endpoint  
4. **Keep all core API functionality** for agents to use

## Why: Make the project completely standalone without external AI dependencies

## Changes Required

### 1. vite.config.ts (Remove lovable-tagger)
```typescript
// REMOVE line 4:
- import { componentTagger }