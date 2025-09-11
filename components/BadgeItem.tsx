import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Award } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';

interface BadgeItemProps {
  name: string;
  description: string;
  isEarned: boolean;
  progress: number;
}

export default function BadgeItem({ name, description, isEarned, progress }: BadgeItemProps) {
  const colors = useCustomColors();
  
  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: isEarned ? colors.card : colors.inactive + '33',
          borderColor: isEarned ? colors.border : colors.inactive,
        }
      ]}
    >
      <View 
        style={[
          styles.iconContainer, 
          { backgroundColor: isEarned ? colors.primary : colors.inactive }
        ]}
      >
        <Award size={24} color="#fff" />
      </View>
      
      <View style={styles.textContainer}>
        <Text 
          style={[
            styles.name, 
            { color: isEarned ? colors.text : colors.inactive }
          ]}
        >
          {name}
        </Text>
        <Text 
          style={[
            styles.description, 
            { color: isEarned ? colors.inactive : colors.inactive + 'AA' }
          ]}
        >
          {description}
        </Text>
        
        {!isEarned && (
          <View style={styles.progressContainer}>
            <View 
              style={[
                styles.progressBar,
                { 
                  backgroundColor: colors.inactive + '33',
                  width: '100%',
                }
              ]}
            >
              <View 
                style={[
                  styles.progressFill,
                  { 
                    backgroundColor: colors.primary,
                    width: `${progress}%`,
                  }
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.inactive }]}>
              {Math.round(progress)}%
            </Text>
          </View>
        )}
      </View>
      
      {isEarned && (
        <View style={[styles.earnedBadge, { backgroundColor: colors.success }]}>
          <Text style={styles.earnedText}>Earned</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'right',
  },
  earnedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  earnedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});