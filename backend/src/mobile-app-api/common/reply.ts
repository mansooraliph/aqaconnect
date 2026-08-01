/**
 * Mirrors the legacy Laravel `App\Helper\Reply` class byte-for-byte, so every
 * Mobile App API response uses the exact same envelope shape the old mobile
 * clients already expect: {status, message, data?} / {status, error_name, data, message}.
 */
export const Reply = {
  success(message: string) {
    return { status: 'success', message };
  },

  successWithData(message: string, data: Record<string, unknown>) {
    return { ...Reply.success(message), ...data };
  },

  error(message: string, errorName: string | null = null, errorData: unknown = []) {
    return { status: 'fail', error_name: errorName, data: errorData, message };
  },

  dataOnly<T extends Record<string, unknown>>(data: T) {
    return data;
  },
};
