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

    function sendMessage(
      message: unknown,
      responseCallback?: (response: any) => void,
    ): void;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: any,
          sendResponse: (response?: any) => void,
        ) => boolean | void,
      ): void;
    };
  }

  namespace permissions {
    function request(
      permissions: { origins?: string[]; permissions?: string[] },
      callback?: (granted: boolean) => void,
    ): void;
  }
}
