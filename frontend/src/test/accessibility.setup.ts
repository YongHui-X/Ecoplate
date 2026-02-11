import { expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

// Extend vitest's expect with axe matchers
expect.extend(matchers);

// Re-export axe for convenience
export { axe } from 'vitest-axe';
export type { AxeMatchers } from 'vitest-axe';
