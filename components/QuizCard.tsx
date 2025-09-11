import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { HelpCircle } from 'lucide-react-native';
import { useCustomColors } from '@/utils/themeUtils';

interface QuizCardProps {
  memorizedCount: number;
}

export default function QuizCard({ memorizedCount }: QuizCardProps) {
  const router = useRouter();
  const colors = useCustomColors();
  
  const handlePress = () => {
    router.push('/quiz');
  };
  
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        }
      ]}
      onPress={handlePress}
      disabled={memorizedCount === 0}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <HelpCircle size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Revision Quiz</Text>
        </View>
      </View>
      
      <Text style={[styles.description, { color: colors.inactive }]}>
        {memorizedCount > 0
          ? "Test your memorization with random verses from what you've already memorized."
          : "Memorize some verses first to unlock quizzes."}
      </Text>
      
      {memorizedCount > 0 ? (
        <Text style={[styles.startQuiz, { color: colors.primary }]}>
          Start a quiz →
        </Text>
      ) : (
        <Text style={[styles.startQuiz, { color: colors.inactive }]}>
          Quiz locked
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  startQuiz: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
});