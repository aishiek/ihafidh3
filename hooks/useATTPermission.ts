import React, { useEffect } from 'react';
import { initializeTrackingServices, requestTrackingPermission } from '../utils/trackingPermission';

/**
 * ATT Integration Hook for Scenario 2 (With Tracking/AdMob)
 * 
 * Use this in your main App component or _layout.tsx when you need
 * to show ads or track users across apps/websites.
 * 
 * IMPORTANT: Only use this if you actually need tracking!
 * For analytics-only apps, this is NOT required.
 */
export const useATTPermission = () => {
  const [trackingStatus, setTrackingStatus] = React.useState<{
    requested: boolean;
    granted: boolean;
    loading: boolean;
  }>({
    requested: false,
    granted: false,
    loading: true,
  });

  useEffect(() => {
    const setupATT = async () => {
      try {
        // Request tracking permission
        const result = await requestTrackingPermission();
        
        setTrackingStatus({
          requested: true,
          granted: result.canTrack,
          loading: false,
        });

        // Initialize tracking services based on permission
        await initializeTrackingServices();
        
        console.log(`ATT Status: ${result.status}, Can Track: ${result.canTrack}`);
      } catch (error) {
        console.error('ATT setup error:', error);
        setTrackingStatus({
          requested: true,
          granted: false,
          loading: false,
        });
      }
    };

    setupATT();
  }, []);

  return trackingStatus;
};

/**
 * Example usage in app/_layout.tsx:
 * 
 * export default function RootLayout() {
 *   const { granted, loading } = useATTPermission();
 * 
 *   if (loading) {
 *     return <LoadingScreen />;
 *   }
 * 
 *   return (
 *     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
 *       <Stack>
 *         <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
 *         <Stack.Screen name="+not-found" />
 *       </Stack>
 *     </ThemeProvider>
 *   );
 * }
 */
