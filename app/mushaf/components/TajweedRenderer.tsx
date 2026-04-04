import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { TAJWEED_COLORS, TajweedConfig, WordWithTajweed } from '../../../types/tajweed';
import { TajweedService } from '../services/tajweedService';

interface TajweedRendererProps {
  words: WordWithTajweed[];
  config: TajweedConfig;
  isCentered?: boolean;
  onWordPress?: (word: WordWithTajweed) => void;
  textColor?: string;
}

export const TajweedRenderer: React.FC<TajweedRendererProps> = ({
  words,
  config,
  isCentered = false,
  onWordPress,
  textColor = '#000',
}) => {
  const renderedWords = useMemo(() => {
    return words.map((word) => {
      if (!config.enabled) {
        return {
          word,
          rules: [],
          backgroundColor: 'transparent',
        };
      }

      const rules = TajweedService.getTajweedRulesFromBitmap(word.tajweed_codes);
      const applicableRules = rules.filter((rule) =>
        config.highlightedRules.includes(rule)
      );

      // Use first applicable rule for background color
      const primaryRule = applicableRules[0];
      const backgroundColor = primaryRule
        ? `${TAJWEED_COLORS[primaryRule].hexColor}${Math.round(config.opacity * 255)
          .toString(16)
          .padStart(2, '0')}`
        : 'transparent';

      return {
        word,
        rules: applicableRules,
        backgroundColor,
      };
    });
  }, [words, config]);

  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        justifyContent: isCentered ? 'center' : 'flex-start',
        paddingVertical: 8,
      }}
    >
      {renderedWords.map((item, idx) => (
        <TouchableOpacity
          key={`${item.word.word_id}-${idx}`}
          style={{
            marginHorizontal: 2,
            marginVertical: 4,
          }}
          onPress={() => onWordPress?.(item.word)}
          activeOpacity={0.7}
        >
          <Text
            style={{
              fontSize: 24,
              textAlign: 'right',
              writingDirection: 'rtl',
              color: textColor,
              backgroundColor: item.backgroundColor,
              paddingHorizontal: 4,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            {`\u200F${item.word.word_text}\u200F`}
            {config.showLabels && item.rules.length > 0 && (
              <Text
                style={{
                  fontSize: 8,
                  marginLeft: 2,
                  color: '#666',
                }}
              >
                {' '}[{item.rules[0].toUpperCase()}]
              </Text>
            )}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default TajweedRenderer;
