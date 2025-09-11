import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { FastingLocation } from '@/types/fasting';
import { UnifiedThemeColors } from '@/hooks/useUnifiedTheme';
import { FastingApiService } from '@/services/fasting/apiService';
import { COUNTRIES, getCountriesByRegion } from '@/constants/countries';

interface LocationSelectorProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: FastingLocation) => void;
  currentLocation: FastingLocation;
  theme: UnifiedThemeColors;
}

// Get all cities from all countries
const ALL_CITIES = COUNTRIES.flatMap(country => 
  country.cities.map(city => ({ city, country: country.name }))
);

export default function LocationSelector({
  visible,
  onClose,
  onLocationSelect,
  currentLocation,
  theme
}: LocationSelectorProps) {
  const sanitize = (value?: string) => {
    if (!value) return '';
    return value.trim().replace(/^[\s'"\\]+|[\s'"\\]+$/g, '');
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [filteredCities, setFilteredCities] = useState(ALL_CITIES);
  const [selectedRegion, setSelectedRegion] = useState<string>('All');

  useEffect(() => {
    let citiesToFilter = ALL_CITIES;
    
    // Filter by region if not "All"
    if (selectedRegion !== 'All') {
      const regions = getCountriesByRegion();
      const regionCountries = regions[selectedRegion as keyof typeof regions] || [];
      const regionCountryNames = regionCountries.map(c => c.name);
      citiesToFilter = ALL_CITIES.filter(city => 
        regionCountryNames.includes(city.country)
      );
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      citiesToFilter = citiesToFilter.filter(
        city =>
          city.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
          city.country.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredCities(citiesToFilter);
  }, [searchQuery, selectedRegion]);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const location = await FastingApiService.getCurrentLocation();
      if (location) {
        onLocationSelect(location);
      } else {
        alert('Unable to detect your location. Please select manually.');
      }
    } catch (error) {
      alert('Error detecting location. Please select manually.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleCitySelect = (city: { city: string; country: string }) => {
    onLocationSelect({
      city: sanitize(city.city),
      country: sanitize(city.country),
      latitude: 0, // Default values, will be updated when detecting
      longitude: 0 // Default values, will be updated when detecting
    });
  };

  const renderCityItem = ({ item }: { item: { city: string; country: string } }) => (
    <TouchableOpacity
      style={[
        styles.cityItem,
        { backgroundColor: theme.surface }
      ]}
      onPress={() => handleCitySelect(item)}
    >
      <Text style={[
        styles.cityName,
        { color: theme.text }
      ]}>
        {sanitize(item.city)}
      </Text>
      <Text style={[
        styles.countryName,
        { color: theme.textSecondary }
      ]}>
        {sanitize(item.country)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[
        styles.container,
        { backgroundColor: theme.background }
      ]}>
        <View style={[
          styles.header,
          { 
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            borderBottomWidth: 1
          }
        ]}>
          <Text style={[
            styles.title,
            { color: theme.text }
          ]}>
            Select Location
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={[
              styles.closeButtonText,
              { color: theme.textSecondary }
            ]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[
          styles.content,
          { backgroundColor: theme.background }
        ]}>
          <View style={[
            styles.searchContainer,
            { 
              backgroundColor: theme.surface,
              borderColor: theme.borderLight
            }
          ]}>
            <TextInput
              style={[
                styles.searchInput,
                { 
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: theme.borderLight
                }
              ]}
              placeholder="Search city or country"
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.detectButton,
              { 
                backgroundColor: theme.primary,
                opacity: isDetectingLocation ? 0.7 : 1
              }
            ]}
            onPress={handleDetectLocation}
            disabled={isDetectingLocation}
          >
            {isDetectingLocation ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[
                styles.detectButtonText,
                { color: theme.text }
              ]}>
                Detect
              </Text>
            )}
          </TouchableOpacity>

          <View style={[
            styles.regionFilter,
            { borderBottomColor: theme.border }
          ]}>
            <Text style={[
              styles.sectionTitle,
              { color: theme.text }
            ]}>
              Select Region
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.regionScrollContainer}
            >
              {['All', ...Object.keys(getCountriesByRegion())].map(region => (
                <TouchableOpacity
                  key={region}
                  style={[
                    styles.regionButton,
                    selectedRegion === region && [
                      styles.regionButtonActive,
                      { backgroundColor: theme.primary }
                    ]
                  ]}
                  onPress={() => setSelectedRegion(region)}
                >
                  <Text style={[
                    styles.regionButtonText,
                    selectedRegion === region 
                      ? { color: theme.text }
                      : { color: theme.textSecondary }
                  ]}>
                    {region}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={[
            styles.sectionTitle,
            { color: theme.text }
          ]}>
            Cities ({filteredCities.length})
          </Text>

          <FlatList
            data={filteredCities}
            renderItem={renderCityItem}
            keyExtractor={(item) => `${item.city}-${item.country}`}
            style={styles.citiesList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  regionScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  regionButtonActive: {
    backgroundColor: '#3B82F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  closeButton: {
    padding: 8
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280'
  },
  content: {
    flex: 1,
    padding: 16
  },
  searchContainer: {
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  searchInput: {
    padding: 12,
    fontSize: 16
  },
  detectButton: {
    backgroundColor: '#059669',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20
  },
  detectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12
  },
  regionFilter: {
    marginBottom: 20
  },
  regionButtons: {
    flexDirection: 'row',
    gap: 8
  },
  regionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  regionButtonText: {
    fontSize: 14,
    fontWeight: '500'
  },
  citiesList: {
    flex: 1
  },
  cityItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  cityName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4
  },
  countryName: {
    fontSize: 14
  }
});
