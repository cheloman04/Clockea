// Canonical TypeScript re-export for type resolution.
// Metro bundler resolves storage.web.ts (web) and storage.native.ts (native) via platform extensions.
// TypeScript resolves this file and gets full types from the implementation.
export * from './storage.web';
