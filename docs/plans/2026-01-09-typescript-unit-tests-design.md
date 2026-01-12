# TypeScript + Unit Tests Design
*Created: 2026-01-09*

## Overview

Add TypeScript to critical paths and set up unit testing with Jest + React Testing Library. This enables safer refactoring and catches bugs earlier.

**Estimated time:** 12-18 hours

**Recommended order:**
1. TypeScript setup + migrate utilities (easiest, immediate benefit)
2. Jest setup
3. Unit tests for utilities
4. Migrate hooks to TypeScript
5. Unit tests for hooks
6. Migrate API routes (optional, lower priority)

## Part 1: TypeScript Setup (~2h)

### Installation

```bash
npm install --save-dev typescript @types/react @types/node
```

### Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "ES2020"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Migrate Utilities First

Start with `src/app/lib/` since these are pure functions with no React dependencies:

```typescript
// src/app/lib/validation.ts
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const ENS_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.eth$/;

export function isValidAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

export function isValidENS(name: string): boolean {
  return ENS_NAME_REGEX.test(name);
}

export function isValidAddressOrENS(input: string): boolean {
  return isValidAddress(input) || isValidENS(input);
}

export function validateAddressParam(address: string): Response | null {
  if (!address) {
    return new Response(
      JSON.stringify({ error: 'Missing query param: address' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
  if (!isValidAddressOrENS(address)) {
    return new Response(
      JSON.stringify({ error: 'Invalid address format' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
  return null;
}

export function isValidEventId(id: string): boolean {
  return /^\d+$/.test(id);
}
```

```typescript
// src/app/lib/concurrency.ts
export async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing = new Set<Promise<R>>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const promise = processor(item, i).then((result) => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}
```

```typescript
// src/app/lib/address-utils.ts
export function shortenAddress(
  address: string | null | undefined,
  prefixLen = 4,
  suffixLen = 4
): string {
  if (!address || address.length < prefixLen + suffixLen + 3) {
    return address || '';
  }
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}
```

### Type Definitions

```typescript
// src/types/index.ts

export interface Collection {
  contract: string;
  network: string;
  name: string;
  symbol?: string;
  imageUrl?: string;
  tokenType?: 'ERC721' | 'ERC1155';
}

export interface KindredSpirit {
  address: string;
  sharedCount: number;
  sharedCollections?: Collection[];
  ensName?: string;
  farcasterProfile?: FarcasterProfile;
}

export interface FarcasterProfile {
  username: string;
  pfpUrl: string;
  followerCount: number;
  followingCount: number;
}

export interface AnalysisProgress {
  phase: string;
  current: number;
  total: number;
}

export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}
```

---

## Part 2: Jest Setup (~2h)

### Installation

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest ts-jest
```

### Configuration

```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{js,ts}',
  ],
};

module.exports = createJestConfig(customJestConfig);
```

```javascript
// jest.setup.js
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## Part 3: Unit Tests for Utilities (~2-3h)

```typescript
// src/app/lib/__tests__/validation.test.ts
import {
  isValidAddress,
  isValidENS,
  isValidAddressOrENS,
  validateAddressParam,
  isValidEventId,
} from '../validation';

describe('isValidAddress', () => {
  it('accepts valid Ethereum addresses', () => {
    expect(isValidAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    expect(isValidAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isValidAddress('')).toBe(false);
    expect(isValidAddress('0x123')).toBe(false);
    expect(isValidAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
    expect(isValidAddress('0xGGGG567890abcdef1234567890abcdef12345678')).toBe(false);
  });
});

describe('isValidENS', () => {
  it('accepts valid ENS names', () => {
    expect(isValidENS('vitalik.eth')).toBe(true);
    expect(isValidENS('my-wallet.eth')).toBe(true);
    expect(isValidENS('sub.domain.eth')).toBe(true);
  });

  it('rejects invalid ENS names', () => {
    expect(isValidENS('')).toBe(false);
    expect(isValidENS('vitalik')).toBe(false);
    expect(isValidENS('.eth')).toBe(false);
    expect(isValidENS('vitalik.com')).toBe(false);
  });
});

describe('validateAddressParam', () => {
  it('returns null for valid address', () => {
    expect(validateAddressParam('0x1234567890abcdef1234567890abcdef12345678')).toBeNull();
  });

  it('returns null for valid ENS', () => {
    expect(validateAddressParam('vitalik.eth')).toBeNull();
  });

  it('returns error Response for empty address', async () => {
    const result = validateAddressParam('');
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(400);
    const body = await result?.json();
    expect(body.error).toContain('Missing');
  });

  it('returns error Response for invalid format', async () => {
    const result = validateAddressParam('invalid');
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(400);
    const body = await result?.json();
    expect(body.error).toContain('Invalid');
  });
});

describe('isValidEventId', () => {
  it('accepts numeric strings', () => {
    expect(isValidEventId('123')).toBe(true);
    expect(isValidEventId('999999')).toBe(true);
  });

  it('rejects non-numeric strings', () => {
    expect(isValidEventId('')).toBe(false);
    expect(isValidEventId('abc')).toBe(false);
    expect(isValidEventId('12.34')).toBe(false);
  });
});
```

```typescript
// src/app/lib/__tests__/concurrency.test.ts
import { processWithConcurrency } from '../concurrency';

describe('processWithConcurrency', () => {
  it('processes all items', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await processWithConcurrency(items, 2, async (n) => n * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('respects concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const items = [1, 2, 3, 4, 5, 6];
    await processWithConcurrency(items, 2, async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('handles empty array', async () => {
    const results = await processWithConcurrency([], 4, async (n) => n);
    expect(results).toEqual([]);
  });

  it('passes index to processor', async () => {
    const items = ['a', 'b', 'c'];
    const results = await processWithConcurrency(items, 2, async (item, idx) => `${item}${idx}`);
    expect(results).toEqual(['a0', 'b1', 'c2']);
  });
});
```

```typescript
// src/app/lib/__tests__/address-utils.test.ts
import { shortenAddress } from '../address-utils';

describe('shortenAddress', () => {
  it('shortens long addresses', () => {
    expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678'))
      .toBe('0x12...5678');
  });

  it('uses custom prefix/suffix lengths', () => {
    expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678', 6, 4))
      .toBe('0x1234...5678');
  });

  it('returns short addresses unchanged', () => {
    expect(shortenAddress('0x1234')).toBe('0x1234');
  });

  it('handles null/undefined', () => {
    expect(shortenAddress(null)).toBe('');
    expect(shortenAddress(undefined)).toBe('');
  });
});
```

---

## Part 4: Migrate Hooks to TypeScript (~2-3h)

After component refactoring creates hooks, migrate them to TypeScript:

```typescript
// src/app/hooks/useCollections.ts
import { useState, useEffect, useCallback } from 'react';
import type { Collection } from '@/types';

interface UseCollectionsResult {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  progress: { current: number; total: number };
  refetch: () => Promise<void>;
}

export function useCollections(
  address: string | null,
  client: any // Replace with proper AlchemyMultichainClient type
): UseCollectionsResult {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const fetchCollections = useCallback(async () => {
    if (!address || !client) return;
    // ... implementation
  }, [address, client]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  return { collections, loading, error, progress, refetch: fetchCollections };
}
```

---

## Part 5: Unit Tests for Hooks (~4-6h)

```typescript
// src/app/hooks/__tests__/useCollections.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useCollections } from '../useCollections';

const mockClient = {
  getCollectionsForOwner: jest.fn(),
};

describe('useCollections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches collections on mount', async () => {
    mockClient.getCollectionsForOwner.mockResolvedValue([
      { contract: '0x123', network: 'eth', name: 'Test NFT' },
    ]);

    const { result } = renderHook(() =>
      useCollections('0xabc', mockClient)
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.collections).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles errors', async () => {
    mockClient.getCollectionsForOwner.mockRejectedValue(new Error('API failed'));

    const { result } = renderHook(() =>
      useCollections('0xabc', mockClient)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('API failed');
    expect(result.current.collections).toHaveLength(0);
  });

  it('does nothing without address', () => {
    renderHook(() => useCollections(null, mockClient));
    expect(mockClient.getCollectionsForOwner).not.toHaveBeenCalled();
  });
});
```

---

## Checklist

### Phase 1: TypeScript Setup (2h)
- [ ] Install TypeScript dependencies
- [ ] Create `tsconfig.json`
- [ ] Rename `src/app/lib/*.js` to `.ts`
- [ ] Add types to utility functions
- [ ] Create `src/types/index.ts`
- [ ] Verify build passes

### Phase 2: Jest Setup (2h)
- [ ] Install Jest dependencies
- [ ] Create `jest.config.js`
- [ ] Create `jest.setup.js`
- [ ] Add test scripts to `package.json`
- [ ] Run `npm test` to verify setup

### Phase 3: Utility Tests (2-3h)
- [ ] Create `src/app/lib/__tests__/validation.test.ts`
- [ ] Create `src/app/lib/__tests__/concurrency.test.ts`
- [ ] Create `src/app/lib/__tests__/address-utils.test.ts`
- [ ] Achieve 100% coverage on utilities

### Phase 4: Hook Migration (2-3h)
- [ ] Migrate `useCollections.js` to `.ts`
- [ ] Migrate `useOwnerCounts.js` to `.ts`
- [ ] Migrate `useCollectionFilters.js` to `.ts`
- [ ] Migrate `useKindredAnalysis.js` to `.ts`

### Phase 5: Hook Tests (4-6h)
- [ ] Create tests for `useCollections`
- [ ] Create tests for `useOwnerCounts`
- [ ] Create tests for `useCollectionFilters`
- [ ] Create tests for `useKindredAnalysis`
- [ ] Achieve 80%+ coverage on hooks

## Success Criteria

- TypeScript compiles without errors
- `npm test` passes
- 80%+ code coverage on `lib/` and `hooks/`
- No runtime regressions
- Build still works
