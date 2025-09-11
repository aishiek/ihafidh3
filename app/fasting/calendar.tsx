import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useFastingCalendar } from '@/components/fasting/context/FastingCalendarContext';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';
import Calendar from '@/components/fasting/Calendar';
import LocationSelector from '@/components/fasting/LocationSelector';
import { CalendarDay, FastingIntention } from '@/types/fasting';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function CalendarScreen() {
  const router = useRouter();
  const { 
    state, 
    dispatch,
    loadCalendarData, 
    setFastingIntention, 
    updateSettings 
  } = useFastingCalendar();
  const { theme } = useUnifiedTheme();
  
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Helper to remove leading/trailing quotes and whitespace
  const sanitize = (value?: string) => {
    if (!value) return '';
    // Remove leading/trailing quotes, backslashes, and whitespace
    return value
      .trim()
      .replace(/^[\s'"\\]+|[\s'"\\]+$/g, '');
  };

  // Get location display name with better formatting
  const getLocationName = useCallback(() => {
    const loc = state.settings?.location;
    if (!loc) return 'Select Location';

    const city = sanitize(loc.city);
    const country = sanitize(loc.country);
    if (city && country) {
      return `${city}, ${country}`;
    }
    return city || country || 'Selected Location';
  }, [state.settings?.location]);

  // Initial load
  useEffect(() => {
    if (state.currentMonth) {
      loadCalendarData(state.currentMonth);
    }
  }, [state.currentMonth]);

  // Handle month change with error handling
  const handleMonthChange = useCallback(async (month: Date) => {
    try {
      // Update global month so RNCalendar navigates and effect reloads data
      dispatch({ type: 'SET_CURRENT_MONTH', payload: month });
    } catch (error) {
      console.error('Error changing month:', error);
    }
  }, [dispatch]);

  // Handle fasting intention with error handling
  const handleSetIntention = useCallback(async (intention: FastingIntention) => {
    try {
      await setFastingIntention(intention);
    } catch (error) {
      console.error('Error setting fasting intention:', error);
    }
  }, [setFastingIntention]);

  // Handle location change with loading state
  const handleLocationChange = useCallback(async (location: any) => {
    try {
      // Sanitize incoming location fields
      const cleaned = {
        ...location,
        city: sanitize(location?.city),
        country: sanitize(location?.country),
      };
      await updateSettings({ location: cleaned });
      setShowLocationSelector(false);
      
      // Reload calendar data with new location
      if (state.currentMonth) {
        await loadCalendarData(state.currentMonth);
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, [updateSettings, loadCalendarData, state.currentMonth]);

  // Pull to refresh functionality
  const onRefresh = useCallback(async () => {
    if (state.currentMonth) {
      setRefreshing(true);
      try {
        await loadCalendarData(state.currentMonth);
      } catch (error) {
        console.error('Error refreshing calendar:', error);
      } finally {
        setRefreshing(false);
      }
    }
  }, [loadCalendarData, state.currentMonth]);

  // Go to today (current Gregorian month)
  const goToToday = useCallback(() => {
    dispatch({ type: 'SET_CURRENT_MONTH', payload: new Date() });
  }, [dispatch]);

  // Retry function for error states
  const handleRetry = useCallback(async () => {
    if (state.currentMonth) {
      try {
        await loadCalendarData(state.currentMonth);
      } catch (error) {
        console.error('Error retrying calendar load:', error);
      }
    }
  }, [loadCalendarData, state.currentMonth]);

  // Enhanced error message based on error type
  const getErrorMessage = useCallback((error: string) => {
    if (error.includes('rate limit')) {
      return {
        title: 'API Rate Limit Exceeded',
        message: 'Too many requests to the Islamic calendar API. Please wait a few minutes before trying again.',
        buttonText: 'Try Again'
      };
    }
    
    if (error.includes('network')) {
      return {
        title: 'Network Error',
        message: 'Please check your internet connection and try again.',
        buttonText: 'Retry'
      };
    }
    
    if (error.includes('location')) {
      return {
        title: 'Location Error',
        message: 'Unable to get prayer times for your location. Please select a different location.',
        buttonText: 'Select Location'
      };
    }
    
    return {
      title: 'Connection Error',
      message: 'Unable to load calendar data. The app is running in offline mode with basic fasting information.',
      buttonText: 'Retry'
    };
  }, []);

  // Loading state component
  const renderLoading = () => (
    <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
      <View style={[styles.loadingCard, { 
        backgroundColor: theme.surface,
        shadowColor: theme.text 
      }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading Islamic calendar...
        </Text>
        <Text style={[styles.loadingSubtext, { color: theme.textSecondary }]}>
          Fetching prayer times and fasting days
        </Text>
      </View>
    </View>
  );

  // Error state component
  const renderError = () => {
    const errorInfo = getErrorMessage(state.error || '');
    
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.errorContainer}>
          <View style={[styles.errorCard, { 
            backgroundColor: theme.surface,
            shadowColor: theme.text 
          }]}> 
            <View style={[styles.errorIcon, { backgroundColor: theme.error + '20' }]}>
              <Text style={[styles.errorIconText, { color: theme.error }]}>!</Text>
            </View>
            
            <Text style={[styles.errorTitle, { color: theme.error }]}>
              {errorInfo.title}
            </Text>
            
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>
              {errorInfo.message}
            </Text>
            
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={errorInfo.title.includes('Location') 
                ? () => setShowLocationSelector(true) 
                : handleRetry
              }
              activeOpacity={0.8}
            >
              <Text style={[styles.retryButtonText, { color: theme.surface }]}>
                {errorInfo.buttonText}
              </Text>
            </TouchableOpacity>
            
            {/* Secondary action for location errors */}
            {errorInfo.title.includes('Location') && (
              <TouchableOpacity
                style={[styles.secondaryButton, { 
                  backgroundColor: 'transparent',
                  borderColor: theme.primary,
                  borderWidth: 1 
                }]}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  // Main content with calendar
  const renderContent = () => (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      <Calendar 
        days={state.calendarDays || []} 
        currentMonth={state.currentMonth} 
        onMonthChange={handleMonthChange} 
        onSetIntention={handleSetIntention}
      />
    </ScrollView>
  );

  // Determine what to render based on state
  const renderMain = () => {
    if (state.isLoading) {
      return renderLoading();
    }

    if (state.error) {
      return renderError();
    }

    return renderContent();
  };  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}> 
        <Stack.Screen
          options={{
            headerShown: false, // Hide the default header
          }}
        />
        
        {/* Custom Header with Back Arrow */}
        <View style={[styles.customHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.customHeaderRow}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <ArrowLeft size={28} color="#FFD700" />
            </TouchableOpacity>
            <View style={styles.customHeaderTitleContainer}>
              <Text style={[styles.customHeaderTitle, { color: theme.text }]}>
                Sunnah Fastings
              </Text>
            </View>
          </View>
        </View>

        {/* Header with location row and Today row */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {/* Location row (centered) */}
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            onPress={() => setShowLocationSelector(true)}
            style={[styles.locationButton, { backgroundColor: theme.background, borderColor: theme.textSecondary + '30' }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.locationButtonText, { color: theme.primary }]}>📍 {getLocationName()}</Text>
          </TouchableOpacity>
        </View>

        {/* Today button row (right) */}
        <View style={styles.headerBottomRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={goToToday}
            style={[styles.todayButton, { borderColor: '#14B8A6', backgroundColor: 'transparent' }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.todayButtonText, { color: '#14B8A6' }]}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderMain()}
      
      {/* Location Selector Modal */}
      <LocationSelector
        visible={showLocationSelector}
        onClose={() => setShowLocationSelector(false)}
        onLocationSelect={handleLocationChange}
        currentLocation={state.settings.location}
        theme={theme}
      />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  customHeader: {
    paddingTop: 50, // Add top padding to avoid status bar overlap
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  customHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customHeaderTitleContainer: {
    flex: 1,
  },
  customHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerContent: {
    alignItems: 'center',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24, // 3x padding (was 8, now 24)
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    paddingTop: 4,
    paddingRight: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  locationButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: width * 0.6,
    alignItems: 'center',
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 0,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    minWidth: width * 0.7,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  errorCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    width: '100%',
    maxWidth: 350,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '400',
    lineHeight: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: 120,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 120,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  legend: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  legendItems: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 15,
    fontWeight: '500',
  },
});