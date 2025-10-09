import { Platform } from 'react-native';

// Make the ATT dependency optional at compile/runtime to prevent build errors
// if the native module isn't installed in a given environment.
type TrackingPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'restricted';

type ATTModule = {
  getTrackingPermissionsAsync: () => Promise<{ status: TrackingPermissionStatus }>;
  requestTrackingPermissionsAsync: () => Promise<{ status: TrackingPermissionStatus }>;
};

let ATT: Partial<ATTModule> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ATT = require('react-native-app-tracking-transparency');
} catch (_e) {
  // Module not available; we'll gracefully fallback below
}

export interface TrackingPermissionResult {
  status: TrackingPermissionStatus;
  canTrack: boolean;
}

/**
 * Request App Tracking Transparency permission on iOS
 * Returns permission status and whether tracking is allowed
 */
export const requestTrackingPermission = async (): Promise<TrackingPermissionResult> => {
  // ATT is iOS only
  if (Platform.OS !== 'ios') {
    return {
      status: 'granted' as TrackingPermissionStatus,
      canTrack: true
    };
  }

  try {
    // Check current permission status
  const status = (await ATT.getTrackingPermissionsAsync?.())?.status ?? 'undetermined';
    
    if (status === 'undetermined') {
      // Request permission if not determined
      const newStatus = (await ATT.requestTrackingPermissionsAsync?.())?.status ?? 'denied';
      return {
        status: newStatus,
        canTrack: newStatus === 'granted'
      };
    }
    
    return {
      status,
      canTrack: status === 'granted'
    };
  } catch (error) {
    console.error('ATT permission error:', error);
    return {
      status: 'denied' as TrackingPermissionStatus,
      canTrack: false
    };
  }
};

/**
 * Check current tracking permission status without requesting
 */
export const getTrackingPermissionStatus = async (): Promise<TrackingPermissionResult> => {
  if (Platform.OS !== 'ios') {
    return {
      status: 'granted' as TrackingPermissionStatus,
      canTrack: true
    };
  }

  try {
    const status = (await ATT.getTrackingPermissionsAsync?.())?.status ?? 'denied';
    return {
      status,
      canTrack: status === 'granted'
    };
  } catch (error) {
    console.error('ATT status check error:', error);
    return {
      status: 'denied' as TrackingPermissionStatus,
      canTrack: false
    };
  }
};

/**
 * Initialize tracking services based on permission status
 */
export const initializeTrackingServices = async () => {
  const { canTrack } = await getTrackingPermissionStatus();
  
  if (canTrack) {
    // Initialize AdMob, Facebook SDK, or other tracking services
    console.log('🎯 Tracking permission granted - initializing ad services');
    
    // Example: Initialize AdMob
    // await AdMobService.initialize();
    
    // Example: Enable enhanced analytics
    // await analytics().setAnalyticsCollectionEnabled(true);
    
    return true;
  } else {
    console.log('🚫 Tracking permission denied - using privacy-focused mode');
    
    // Use analytics without IDFA
    // await analytics().setAnalyticsCollectionEnabled(true); // Still allowed without IDFA
    
    return false;
  }
};
