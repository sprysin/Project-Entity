import { useCallback, useEffect, useRef } from 'react';

type TimeoutId = ReturnType<typeof setTimeout>;

/** Schedules component-owned timers and clears every pending callback on unmount. */
export const useManagedTimeout = () => {
    const timers = useRef(new Set<TimeoutId>());

    useEffect(() => () => {
        timers.current.forEach(clearTimeout);
        timers.current.clear();
    }, []);

    return useCallback((callback: () => void, delay: number) => {
        const timeout = setTimeout(() => {
            timers.current.delete(timeout);
            callback();
        }, delay);
        timers.current.add(timeout);
        return timeout;
    }, []);
};
