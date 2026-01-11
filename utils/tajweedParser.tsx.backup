import React from 'react';
import { Text, TextStyle } from 'react-native';

// Tajweed color codes mapping
const TAJWEED_COLORS: Record<string, string> = {
  'h': '#FF6B6B',     // Red - Ghunnah (Nasalization)
  'l': '#4ECDC4',     // Teal - Qalqalah (Echoing sound)
  'n': '#45B7D1',     // Blue - Noon and Meem Mushaddad
  'p': '#96CEB4',     // Light Green - Idgham (Merging)
  'm': '#FFD700',     // Bright Yellow - Madd (Prolongation)
  'u': '#DDA0DD',     // Plum - Iqlab/Hamza (Converting)
  'g': '#A0A0A0',     // Gray - Silent letters
  'c': '#74B9FF',     // Light Blue - Ikhfa (Concealing)
  'q': '#FD79A8',     // Pink - Qalb/Qaf (Converting)
  's': '#FDCB6E',     // Orange - Special rules
  'o': '#E17055',     // Terra Cotta - Other rules
  'f': '#A29BFE',     // Light Purple - Fatha/Other
  'w': '#00CEC9',     // Cyan - Waw rules
  'i': '#81ECEC',     // Light Cyan - Ikhfa Shafawi
};

const TAJWEED_RULES: Record<string, string> = {
  'h': 'Ghunnah',
  'l': 'Qalqalah', 
  'n': 'Noon/Meem',
  'p': 'Idgham',
  'm': 'Madd',
  'u': 'Hamza/Iqlab',
  'g': 'Silent',
  'c': 'Ikhfa',
  'q': 'Qaf/Qalb',
  's': 'Special',
  'o': 'Other',
  'f': 'Fatha',
  'w': 'Waw',
  'i': 'Ikhfa Shafawi',
};

export interface TajweedSegment {
  text: string;
  color?: string;
  rule?: string;
}

/**
 * Advanced parser for complex Tajweed patterns from AlQuran.cloud API
 * Handles patterns like: [l][o], [l]h:5267], [l]s], etc.
 */
export function parseTajweedText(tajweedText: string): TajweedSegment[] {
  if (!tajweedText) return [];
  
  const segments: TajweedSegment[] = [];
  let currentIndex = 0;
  
  // Clean up the text first - remove any malformed patterns
  let cleanText = tajweedText;
  
  // Step 1: Find all bracket patterns and their positions
  const patterns: Array<{
    start: number;
    end: number;
    ruleCode: string;
    content: string;
    type: string;
  }> = [];
  
  // Match various bracket patterns:
  // [rule] - simple rule
  // [rule:number] - rule with number
  // [rule][content] - rule with content
  // [rule]content] - malformed but common
  // [rule]h:number] - mixed patterns
  const bracketRegex = /\[([a-z])(?::?\d*)?\](?:\[([^\]]*)\]|([^[\]]*?)(?=\[|$))?/g;
  
  let match;
  while ((match = bracketRegex.exec(cleanText)) !== null) {
    const ruleCode = match[1];
    const bracketedContent = match[2]; // Content in [content]
    const followingContent = match[3]; // Content after ]
    
    patterns.push({
      start: match.index,
      end: match.index + match[0].length,
      ruleCode: ruleCode,
      content: bracketedContent || followingContent || '',
      type: bracketedContent ? 'bracketed' : 'following'
    });
  }
  
  // Step 2: Process text segments between patterns
  let lastEnd = 0;
  
  for (const pattern of patterns) {
    // Add plain text before this pattern
    if (pattern.start > lastEnd) {
      const plainText = cleanText.substring(lastEnd, pattern.start);
      if (plainText.trim()) {
        segments.push({ text: plainText.trim() });
      }
    }
    
    // Add the colored segment
    if (pattern.content.trim()) {
      segments.push({
        text: pattern.content.trim(),
        color: TAJWEED_COLORS[pattern.ruleCode] || '#FFFFFF',
        rule: TAJWEED_RULES[pattern.ruleCode] || 'Unknown'
      });
    }
    
    lastEnd = pattern.end;
  }
  
  // Add any remaining text
  if (lastEnd < cleanText.length) {
    const remainingText = cleanText.substring(lastEnd).trim();
    if (remainingText) {
      segments.push({ text: remainingText });
    }
  }
  
  // Step 3: If no patterns found, try alternative parsing
  if (patterns.length === 0) {
    return parseAlternativeFormat(cleanText);
  }
  
  // Step 4: Post-process to handle consecutive rules
  const finalSegments: TajweedSegment[] = [];
  let activeRule: string | null = null;
  let pendingText = '';
  
  for (const segment of segments) {
    if (segment.color && segment.color !== '#FFFFFF') {
      // This is a colored segment
      if (pendingText) {
        // Apply the previous active rule to pending text
        finalSegments.push({
          text: pendingText,
          color: activeRule ? (TAJWEED_COLORS[activeRule] || '#FFFFFF') : '#FFFFFF',
          rule: activeRule ? (TAJWEED_RULES[activeRule] || 'Unknown') : undefined
        });
        pendingText = '';
      }
      
      finalSegments.push(segment);
      activeRule = Object.keys(TAJWEED_COLORS).find(key => 
        TAJWEED_COLORS[key] === segment.color
      ) || null;
    } else {
      // This is plain text - might need coloring from active rule
      if (activeRule && segment.text.length <= 10) { // Short text segments likely belong to previous rule
        finalSegments.push({
          text: segment.text,
          color: TAJWEED_COLORS[activeRule],
          rule: TAJWEED_RULES[activeRule]
        });
      } else {
        finalSegments.push(segment);
        activeRule = null; // Reset rule for long text segments
      }
    }
  }
  
  // Add any remaining pending text
  if (pendingText) {
    finalSegments.push({ text: pendingText });
  }
  
  return finalSegments.length > 0 ? finalSegments : [{ text: tajweedText }];
}

/**
 * Alternative parser for different formats
 */
function parseAlternativeFormat(text: string): TajweedSegment[] {
  // Try to split on any bracket and alternate coloring
  const parts = text.split(/(\[[a-z](?::?\d*)?\])/);
  const segments: TajweedSegment[] = [];
  let currentRule: string | null = null;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (!part) continue;
    
    const ruleMatch = part.match(/\[([a-z])(?::?\d*)?\]/);
    
    if (ruleMatch) {
      // This is a rule marker
      currentRule = ruleMatch[1];
    } else if (part.trim()) {
      // This is text content
      segments.push({
        text: part.trim(),
        color: currentRule ? (TAJWEED_COLORS[currentRule] || '#FFFFFF') : '#FFFFFF',
        rule: currentRule ? (TAJWEED_RULES[currentRule] || 'Unknown') : undefined
      });
    }
  }
  
  return segments;
}

/**
 * Render Tajweed text with color coding
 */
export const TajweedText: React.FC<{
  text: string;
  style?: TextStyle;
  fallbackText?: string;
  fontSize?: number;
  showDebug?: boolean;
}> = ({ text, style, fallbackText, fontSize = 20, showDebug = false }) => {
  const segments = parseTajweedText(text || fallbackText || '');
  
  if (showDebug) {
    console.log('=== TAJWEED DEBUG ===');
    console.log('Original text:', text);
    console.log('Parsed segments:', segments);
    console.log('==================');
  }
  
  if (segments.length === 0) {
    return (
      <Text style={[style, { fontSize, color: '#FFFFFF' }]}>
        {fallbackText || 'No text available'}
      </Text>
    );
  }
  
  return (
    <Text style={[style, { fontSize, lineHeight: fontSize * 1.5 }]}>
      {segments.map((segment, index) => {
        const hasColor = segment.color && segment.color !== '#FFFFFF';
        return (
          <Text
            key={index}
            style={{
              color: segment.color || '#FFFFFF',
              fontWeight: hasColor ? '600' : 'normal',
              backgroundColor: hasColor ? `${segment.color}25` : 'transparent',
              borderRadius: 3,
              paddingHorizontal: hasColor ? 2 : 0,
            }}
          >
            {segment.text}
            {index < segments.length - 1 ? ' ' : ''}
          </Text>
        );
      })}
    </Text>
  );
};

/**
 * Simple test component to validate parsing
 */
export const TajweedTest: React.FC = () => {
  const testCases = [
    "إِذْ يُوحِى رَبُّكَ إِلَى [l][o]ٱلْمَلَٰٓئِكَةِ",
    "[l]h:5267] الملائكة [l]h:5268] الذين",
    "[l]s] كفروا [l]h:2312]",
  ];
  
  return (
    <>
      {testCases.map((testCase, index) => (
        <TajweedText 
          key={index}
          text={testCase}
          showDebug={true}
          style={{ marginVertical: 10, textAlign: 'right' }}
        />
      ))}
    </>
  );
};

/**
 * Tajweed Legend Component
 */
export const TajweedLegend: React.FC<{
  style?: TextStyle;
}> = ({ style }) => {
  return (
    <Text style={[{ fontSize: 12, color: '#CCCCCC' }, style]}>
      Tajweed Colors: {Object.entries(TAJWEED_RULES).map(([code, rule]) => (
        `${rule} `
      )).join('• ')}
    </Text>
  );
};

export { TAJWEED_COLORS, TAJWEED_RULES };
