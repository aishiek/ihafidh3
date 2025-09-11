import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions
} from 'react-native';
import { CalendarDay, FastingIntention } from '@/types/fasting';
import { FASTING_INFO } from '@/constants/fastingInfo';
import { FastingLogic } from '@/services/fasting/fastingLogic';
import { useUnifiedTheme } from '@/hooks/useUnifiedTheme';

const { width, height } = Dimensions.get('window');

interface DayDetailModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string | null;
  calendarDays: CalendarDay[];
  fastingIntentions: Record<string, FastingIntention>;
  onSetIntention: (intention: FastingIntention) => void;
}

export default function DayDetailModal({
  visible,
  onClose,
  selectedDate,
  calendarDays,
  fastingIntentions,
  onSetIntention,
}: DayDetailModalProps) {
  const { theme } = useUnifiedTheme();
  const [intention, setIntention] = useState<'will_fast' | 'completed' | 'none'>('none');
  const [notes, setNotes] = useState('');

  const dayData = calendarDays.find(d => d.date === selectedDate);
  const currentIntention = selectedDate ? fastingIntentions[selectedDate] : null;

  React.useEffect(() => {
    if (currentIntention) {
      setIntention(currentIntention.intention);
      setNotes(currentIntention.notes || '');
    } else {
      setIntention('none');
      setNotes('');
    }
  }, [currentIntention]);

  const handleSaveIntention = () => {
    if (!selectedDate) return;

    const newIntention: FastingIntention = {
      date: selectedDate,
      intention,
      notes: notes.trim() || undefined
    };

    onSetIntention(newIntention);
    Alert.alert('Success', 'Fasting intention saved!');
    onClose();
  };

  const getFastingDescription = () => {
    if (!dayData || dayData.fastingTypes.length === 0) {
      return 'No recommended fasting today';
    }
    return FastingLogic.getFastingDescription(dayData.fastingTypes);
  };

  const getFastingBenefits = () => {
    if (!dayData || dayData.fastingTypes.length === 0) {
      return [];
    }
    return FastingLogic.getFastingBenefits(dayData.fastingTypes);
  };

  const renderFastingTypes = () => {
    if (!dayData) return null;
    
    if (dayData.fastingTypes.length === 0) {
      return (
        <View style={[styles.fastingTypesContainer, { backgroundColor: theme.surface }]}>
          <Text style={[styles.noFastingText, { color: theme.textMuted }]}>
            No recommended fasting for this day
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.fastingTypesContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Recommended Fasting
        </Text>
        {dayData.fastingTypes.map((type) => {
          const info = FASTING_INFO[type];
          return (
            <View 
              key={type} 
              style={[
                styles.fastingTypeItem, 
                { 
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderLeftColor: info.color
                }
              ]}
            >
              <View style={styles.fastingTypeIndicator}>
                <View style={[styles.fastingTypeDot, { backgroundColor: info.color }]} />
              </View>
              <View style={styles.fastingTypeInfo}>
                <Text style={[styles.fastingTypeName, { color: theme.text }]}>{info.name}</Text>
                <Text style={[styles.fastingTypeDescription, { color: theme.textSecondary }]}>
                  {info.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderBenefits = () => {
    const benefits = getFastingBenefits();
    if (benefits.length === 0) return null;

    return (
      <View style={[styles.benefitsContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Spiritual Benefits
        </Text>
        {benefits.map((benefit, index) => (
          <View key={index} style={[styles.benefitItem, { backgroundColor: theme.surfaceElevated }]}>
            <View style={[styles.benefitBullet, { backgroundColor: theme.primary }]} />
            <Text style={[styles.benefitText, { color: theme.textSecondary }]}>
              {benefit}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderIntentionSection = () => {
    if (!dayData) return null;

    return (
      <View style={[styles.intentionContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Your Intention
        </Text>
        
        <View style={styles.intentionButtons}>
          <TouchableOpacity
            style={[
              styles.intentionButton,
              intention === 'will_fast' && styles.intentionButtonActive,
              {
                borderColor: theme.primary,
                backgroundColor: intention === 'will_fast' ? theme.primary : 'transparent',
              },
            ]}
            onPress={() => setIntention('will_fast')}
            activeOpacity={0.7}
          >
            <Text 
              style={[
                styles.intentionButtonText,
                { 
                  color: intention === 'will_fast' ? '#fff' : theme.primary,
                }
              ]}
            >
              I will fast
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.intentionButton,
              intention === 'completed' && styles.intentionButtonActive,
              {
                borderColor: theme.primary,
                backgroundColor: intention === 'completed' ? theme.primary : 'transparent',
              },
            ]}
            onPress={() => setIntention('completed')}
            activeOpacity={0.7}
          >
            <Text 
              style={[
                styles.intentionButtonText,
                { 
                  color: intention === 'completed' ? '#fff' : theme.primary,
                }
              ]}
            >
              I completed fasting
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!dayData) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{dayData?.gregorianDate.date}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{dayData?.hijriDate.day} {dayData?.hijriDate.month.en} {dayData?.hijriDate.year} AH</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.descriptionContainer, { backgroundColor: theme.surface }]}>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                {getFastingDescription()}
              </Text>
            </View>

            {renderFastingTypes()}
            {renderBenefits()}
            {renderIntentionSection()}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSaveIntention}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Save Intention</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  dateContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  hijriText: {
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  descriptionContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  fastingTypesContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  fastingTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  fastingTypeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  fastingTypeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fastingTypeInfo: {
    flex: 1,
  },
  fastingTypeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fastingTypeDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  noFastingText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  benefitsContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
  },
  benefitBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  intentionContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  intentionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  intentionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  intentionButtonActive: {
    backgroundColor: '#4CAF50',
  },
  intentionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
