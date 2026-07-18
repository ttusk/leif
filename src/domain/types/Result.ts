/**
 * Result type for better error handling.
 * Represents either a successful value or an error.
 */
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

/**
 * Result factory methods for creating success and error results.
 */
export const Result = {
  /**
   * Creates a successful result with a value.
   */
  ok<T>(value: T): Result<T, never> {
    return { success: true, value };
  },

  /**
   * Creates an error result.
   */
  error<E>(error: E): Result<never, E> {
    return { success: false, error };
  },

  /**
   * Checks if a result is successful.
   */
  isOk<T, E>(result: Result<T, E>): result is { success: true; value: T } {
    return result.success === true;
  },

  /**
   * Checks if a result is an error.
   */
  isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return result.success === false;
  }
};
