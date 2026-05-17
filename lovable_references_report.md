# Lovable Website/Service References in Agent.Feed Codebase

## Summary
The codebase contains references to "lovable" domains and packages in 7 files across 14 locations. These fall into three main categories:

1. **lovable.app** - The production/hosting domain
2. **lovable.dev** - External AI API gateway
3. **lovable-tagger** - A TypeScript utility package

## Complete List of References

### 1. Package Dependencies

#### package.json (line 84)
```json
"lovable-tagger": "^1.1.13"
```

#### package-lock.json
Multiple entries showing the lovable-tagger dependency and its transitive dependencies

### 2. Configuration Files

#### vite.config.ts (line 4, 15)
```typescript
import { componentTagger }