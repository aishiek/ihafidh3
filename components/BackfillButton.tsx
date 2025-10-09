import { debugVerseActivityCounts, forceBackfillNow } from '@/database/QuranDatabase';
import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';

export const BackfillButton = () => {
  const [loading, setLoading] = useState(false);

  const handleBackfill = async () => {
    setLoading(true);
    try {
      // Show initial message
      Alert.alert(
        'Updating Activity Data',
        'This will update your activity graphs with historical data. This may take a moment...',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setLoading(false)
          },
          {
            text: 'Debug First',
            onPress: async () => {
              try {
                await debugVerseActivityCounts();
                Alert.alert('Debug Complete', 'Check the console/logs for debug information.');
              } catch (error) {
                Alert.alert('Debug Error', 'Failed to run debug check.');
              } finally {
                setLoading(false);
              }
            }
          },
          {
            text: 'Continue',
            onPress: async () => {
              try {
                await forceBackfillNow();
                await debugVerseActivityCounts();
                
                Alert.alert(
                  'Success!',
                  'Your activity graphs have been updated with historical memorization data. Check your Stats page to see the improvements!',
                  [{ text: 'OK' }]
                );
              } catch (error) {
                console.error('Backfill failed:', error);
                Alert.alert(
                  'Error',
                  'There was an issue updating your data. Please try again or contact support.',
                  [{ text: 'OK' }]
                );
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to start backfill process.');
    }
  };

  return (
    <TouchableOpacity
      onPress={handleBackfill}
      disabled={loading}
      style={{
        backgroundColor: loading ? '#333333' : '#2196F3',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
      }}
      activeOpacity={0.7}
    >
      <Text style={{ 
        color: loading ? '#888888' : '#ffffff', 
        fontWeight: '600',
        fontSize: 15
      }}>
        {loading ? 'Updating...' : 'Update Now'}
      </Text>
    </TouchableOpacity>
  );
};