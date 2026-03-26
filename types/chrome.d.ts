/**
 * Minimal Chrome extension API typings for this project (no @types/chrome dependency).
 */

declare namespace chrome {
  namespace storage {
    interface StorageChange {
      newValue?: unknown;
      oldValue?: unknown;
    }

    const local: {
      get(
        keys: string | string[] | Record<string, unknown> | null,
        callback: (items: Record<string, unknown>) => void,
      ): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
    };

    const onChanged: {
      addListener(
        callback: (
          changes: Record<string, chrome.storage.StorageChange>,
          areaName: 'local' | 'sync' | 'managed' | 'session',
        ) => void,
      ): void;
    };
  }

  namespace runtime {
    const lastError: { message: string } | undefined;
  }
}
