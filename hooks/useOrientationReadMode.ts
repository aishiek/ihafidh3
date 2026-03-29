import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef } from 'react';

export interface UseOrientationReadModeProps {
    onLandscape: () => void;
    onPortraitReturn: () => void;
}

export function useOrientationReadMode({
    onLandscape,
    onPortraitReturn,
}: UseOrientationReadModeProps) {
    const subscriptionRef = useRef<ScreenOrientation.Subscription | null>(null);
    // Ref-sync pattern: subscription registers once, callbacks always stay current
    const onLandscapeRef = useRef(onLandscape);
    const onPortraitReturnRef = useRef(onPortraitReturn);

    useEffect(() => { onLandscapeRef.current = onLandscape; }, [onLandscape]);
    useEffect(() => { onPortraitReturnRef.current = onPortraitReturn; }, [onPortraitReturn]);

    useEffect(() => {
        ScreenOrientation.unlockAsync().catch(() => {});

        const subscription = ScreenOrientation.addOrientationChangeListener(
            (evt: ScreenOrientation.OrientationChangeEvent) => {
                const orientation = evt.orientationInfo.orientation;

                const isLandscape =
                    orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                    orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
                const isPortrait =
                    orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
                    orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN;

                if (isLandscape) {
                    onLandscapeRef.current?.();
                } else if (isPortrait) {
                    onPortraitReturnRef.current?.();
                }
            }
        );

        subscriptionRef.current = subscription;

        // Single cleanup — do NOT add a second useEffect for cleanup
        return () => {
            subscriptionRef.current?.remove();
            subscriptionRef.current = null;
            ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.PORTRAIT_UP
            ).catch(() => {});
        };
    }, []); // empty — intentional, callbacks are accessed via refs above
}
