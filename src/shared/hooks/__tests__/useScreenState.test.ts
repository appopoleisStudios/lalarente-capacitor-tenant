import { renderHook, act } from '@testing-library/react-native';
import { useScreenState } from '../useScreenState';

describe('useScreenState', () => {
  it('starts with null data, not loading, no error', () => {
    const { result } = renderHook(() => useScreenState(() => Promise.resolve('value')));
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets data on successful fetch', async () => {
    const { result } = renderHook(() => useScreenState(() => Promise.resolve('hello')));
    await act(() => result.current.refetch());
    expect(result.current.data).toBe('hello');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failed fetch', async () => {
    const { result } = renderHook(() =>
      useScreenState(() => Promise.reject(new Error('network failure')))
    );
    await act(() => result.current.refetch());
    expect(result.current.error).toBe('network failure');
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets generic message for non-Error throws', async () => {
    const { result } = renderHook(() => useScreenState(() => Promise.reject('oops')));
    await act(() => result.current.refetch());
    expect(result.current.error).toBe('An unexpected error occurred.');
  });

  describe('concurrent refresh protection', () => {
    it('only commits data from the latest request when two resolve in order', async () => {
      let resolveA!: (v: string) => void;
      let resolveB!: (v: string) => void;
      const promiseA = new Promise<string>((r) => (resolveA = r));
      const promiseB = new Promise<string>((r) => (resolveB = r));
      let call = 0;
      const { result } = renderHook(() =>
        useScreenState(() => (call++ === 0 ? promiseA : promiseB))
      );

      // Fire both refreshes without awaiting
      act(() => {
        result.current.refetch();
      });
      act(() => {
        result.current.refetch();
      });

      // B resolves first with newer data
      await act(async () => {
        resolveB('from-B');
      });
      // A resolves after with stale data
      await act(async () => {
        resolveA('from-A');
      });

      // Only B's result should be committed
      expect(result.current.data).toBe('from-B');
    });

    it('does not overwrite success with a later-arriving error from an older request', async () => {
      let rejectA!: (e: Error) => void;
      let resolveB!: (v: string) => void;
      const promiseA = new Promise<string>((_, r) => (rejectA = r));
      const promiseB = new Promise<string>((r) => (resolveB = r));
      let call = 0;
      const { result } = renderHook(() =>
        useScreenState(() => (call++ === 0 ? promiseA : promiseB))
      );

      act(() => {
        result.current.refetch();
      });
      act(() => {
        result.current.refetch();
      });

      // B succeeds
      await act(async () => {
        resolveB('good-data');
      });
      // A fails after B already committed
      await act(async () => {
        rejectA(new Error('stale error'));
      });

      expect(result.current.data).toBe('good-data');
      expect(result.current.error).toBeNull();
    });

    it('clears isLoading only when the latest request settles', async () => {
      let resolveA!: (v: string) => void;
      let resolveB!: (v: string) => void;
      const promiseA = new Promise<string>((r) => (resolveA = r));
      const promiseB = new Promise<string>((r) => (resolveB = r));
      let call = 0;
      const { result } = renderHook(() =>
        useScreenState(() => (call++ === 0 ? promiseA : promiseB))
      );

      act(() => {
        result.current.refetch();
      });
      act(() => {
        result.current.refetch();
      });

      // A resolves — isLoading should stay true because B is still pending
      await act(async () => {
        resolveA('from-A');
      });
      expect(result.current.isLoading).toBe(true);

      // B resolves — now loading should clear
      await act(async () => {
        resolveB('from-B');
      });
      expect(result.current.isLoading).toBe(false);
    });
  });
});
