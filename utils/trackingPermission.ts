import { Platform } from 'react-native';
import {
    getTrackingPermissionsAsync,
    requestTrackingPermissionsAsync,
    TrackingPermissionStatus
} from 'react-native-app-tracking-transparency';

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
    const { status } = await getTrackingPermissionsAsync();
    
    if (status === 'undetermined') {
      // Request permission if not determined
      const { status: newStatus } = await requestTrackingPermissionsAsync();
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
    const { status } = await getTrackingPermissionsAsync();
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
