import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * useOrientationReadMode
 * High-performance orientation listener with Focus-awareness and Navigation Guard.
 * This hook handles jumping from Portrait (read tab) to Landscape (read-mode).
 */
type OrientationReadModeOptions = {
    onLandscape?: () => void;
    onPortraitReturn?: () => void;
};

export const useOrientationReadMode = (config: boolean | OrientationReadModeOptions = true) => {
    const router = useRouter();
    const isFocused = useIsFocused();
    const isExiting = useRef(false);
    const lastActionTime = useRef(0);
    const NAVIGATION_COOLDOWN = 1500; // Prevent "ghost" layering during rapid rotation
    const isEnabled = typeof config === 'boolean' ? config : true;
    const onLandscape = typeof config === 'object' ? config.onLandscape : undefined;
    const onPortraitReturn = typeof config === 'object' ? config.onPortraitReturn : undefined;

    const navigateToReadMode = useCallback(async () => {
        const now = Date.now();
        if (!isFocused || isExiting.current || (now - lastActionTime.current < NAVIGATION_COOLDOWN)) {
            return;
        }

        try {
            lastActionTime.current = now;
            isExiting.current = true;
            if (onLandscape) {
                onLandscape();
            } else {
                router.push('/read-mode');
            }
        } catch (error) {
            console.error('[OrientationHook] Navigation error:', error);
            isExiting.current = false;
        }
    }, [isFocused, onLandscape, router]);

    // 1. Initial Check on Mount OR Focus Gain
    useEffect(() => {
        if (!isEnabled || !isFocused) return;

        let isMounted = true;
        const checkInitial = async () => {
            try {
                const current = await ScreenOrientation.getOrientationAsync();
                
                // If we are ALREADY in landscape when this tab is focused, jump immediately
                if (
                    isMounted && (
                    current === ScreenOrientation.Orientation.LANDSCAPE_LEFT || 
                    current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
                    )
                ) {
                    navigateToReadMode();
                }
            } catch (err) {
                // Silently handle orientation query failures
            }
        };

        // Delay slightly with focus gain to ensure router is settled
        const timer = setTimeout(checkInitial, 150);
        return () => { isMounted = false; clearTimeout(timer); };
    }, [isFocused, isEnabled, navigateToReadMode]);

    // 2. Real-time Listener while Focused
    useEffect(() => {
        if (!isEnabled || !isFocused) return;

        const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
            const orientation = evt.orientationInfo.orientation;

            if (
                orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || 
                orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
            ) {
                navigateToReadMode();
            } else if (
                orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
                orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
            ) {
                onPortraitReturn?.();
            }
        });

        isExiting.current = false;
        return () => {
            subscription.remove();
        };
    }, [isEnabled, isFocused, navigateToReadMode, onPortraitReturn]);

    return { isExiting: isExiting.current };
};
