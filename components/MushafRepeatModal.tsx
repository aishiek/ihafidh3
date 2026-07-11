import { logScreenView } from '@/utils/analyticsHelper';
import { useSettingsStore } from '@/store/settingsStore';
import { Infinity as InfinityIcon, RefreshCw } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface MushafRepeatModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function MushafRepeatModal({
  visible, onClose }: MushafRepeatModalProps) {
React.useEffect(() => {
    if (visible) {
      logScreenView('modal_mushafrepeatmodal').catch(() => {});
    }
  }, [visible]);
 
  const { mushafRepeatMode, mushafInfiniteLoop, mushafRepeatScope, setMushafRepeatMode, setMushafInfiniteLoop, setMushafRepeatScope } = useSettingsStore();

  const repeatOptions = [1, 2, 3, 4, 5];

  const handleSelectRepeat = (count: number) => {
    setMushafRepeatMode(count);
    setMushafInfiniteLoop(false);
  };

  const handleToggleInfinite = () => {
    setMushafInfiniteLoop(!mushafInfiniteLoop);
    if (!mushafInfiniteLoop) {
      setMushafRepeatMode(1);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Page Repeat Mode</Text>
            <Text style={styles.subtitle}>How many times to repeat the page audio</Text>
          </View>

          {/* Repeat Scope Selector */}
          <View style={styles.scopeContainer}>
            <Text style={styles.scopeLabel}>Repeat Mode:</Text>
            <View style={styles.scopeButtons}>
              <Pressable
                style={[styles.scopeButton, mushafRepeatScope === 'page' && styles.scopeButtonSelected]}
                onPress={() => setMushafRepeatScope('page')}
              >
                <Text style={[styles.scopeButtonText, mushafRepeatScope === 'page' && styles.scopeButtonTextSelected]}>
                  🔁 Entire Page
                </Text>
              </Pressable>
              <Pressable
                style={[styles.scopeButton, mushafRepeatScope === 'verse' && styles.scopeButtonSelected]}
                onPress={() => setMushafRepeatScope('verse')}
              >
                <Text style={[styles.scopeButtonText, mushafRepeatScope === 'verse' && styles.scopeButtonTextSelected]}>
                  🔂 Each Verse
                </Text>
              </Pressable>
            </View>
            <Text style={styles.scopeDescription}>
              {mushafRepeatScope === 'page' 
                ? 'Plays all verses, then repeats entire page'
                : 'Repeats each verse before moving to next'}
            </Text>
          </View>

          {/* Repeat Count Options */}
          <View style={styles.optionsContainer}>
            {repeatOptions.map((count) => {
              const isSelected = !mushafInfiniteLoop && mushafRepeatMode === count;
              return (
                <Pressable
                  key={count}
                  style={[
                    styles.option,
                    isSelected && styles.optionSelected,
                  ]}
                  onPress={() => handleSelectRepeat(count)}
                >
                  <View style={styles.optionContent}>
                    <RefreshCw size={18} color={isSelected ? '#1a1a1a' : '#FFD700'} />
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {count}x
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Infinite Loop Option */}
          <Pressable
            style={[
              styles.infiniteOption,
              mushafInfiniteLoop && styles.infiniteOptionSelected,
            ]}
            onPress={handleToggleInfinite}
          >
            <InfinityIcon size={20} color={mushafInfiniteLoop ? '#1a1a1a' : '#FFD700'} />
            <Text style={[styles.infiniteText, mushafInfiniteLoop && styles.infiniteTextSelected]}>
              Repeat Forever
            </Text>
          </Pressable>

          {/* Close Button */}
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  scopeContainer: {
    marginBottom: 20,
  },
  scopeLabel: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  scopeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  scopeButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  scopeButtonSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  scopeButtonText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scopeButtonTextSelected: {
    color: '#1a1a1a',
  },
  scopeDescription: {
    color: '#777',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  option: {
    flex: 1,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  optionContent: {
    alignItems: 'center',
    gap: 4,
  },
  optionText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: '#1a1a1a',
  },
  infiniteOption: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  infiniteOptionSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  infiniteText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '700',
  },
  infiniteTextSelected: {
    color: '#1a1a1a',
  },
  closeButton: {
    backgroundColor: '#333',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
