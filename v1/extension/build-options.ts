import { resolve } from 'node:path';

export interface ExtensionBuildPlan {
  input: Record<string, string>;
  inlineDynamicImports: boolean;
  emptyOutDir: boolean;
}

export function buildEntryPlan(
  contentOnly: boolean,
  extensionRoot: string
): ExtensionBuildPlan {
  if (contentOnly) {
    return {
      input: {
        'content/index': resolve(extensionRoot, 'content/index.ts'),
      },
      inlineDynamicImports: true,
      emptyOutDir: true,
    };
  }

  return {
    input: {
      'background/service-worker': resolve(
        extensionRoot,
        'background/service-worker.ts'
      ),
      'popup/index': resolve(extensionRoot, 'popup/index.ts'),
      'settings/index': resolve(extensionRoot, 'settings/index.ts'),
    },
    inlineDynamicImports: false,
    emptyOutDir: false,
  };
}
