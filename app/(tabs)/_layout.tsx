import { EnhancedHamburgerMenu } from '@/components/EnhancedHamburgerMenu';
import OccasionHeaderIcon from '@/components/OccasionHeaderIcon';
import { useThemeColor } from "@/utils/useThemeColor";
import { logAnalyticsEvent } from '@/utils/analyticsHelper';
import { Tabs, router } from "expo-router";
import { BarChart, BookOpen, Brain, HelpCircle, Home, RefreshCw, Settings as SettingsIcon, Mic } from "lucide-react-native";
import React from "react";
import { Platform, View, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { primary } = useThemeColor();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: primary,
          tabBarInactiveTintColor: "#888888",
          tabBarAllowFontScaling: false, // Prevent labels from growing too large
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: -4,
            marginBottom: Platform.OS === 'android' ? 6 : 4,
          },
          tabBarStyle: {
            backgroundColor: "#1a1a1a",
            borderTopColor: "#333333",
            height: Platform.OS === 'android' ? 60 + insets.bottom : 60,
            paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 8,
            paddingTop: Platform.OS === 'android' ? 8 : 0,
          },
          headerStyle: {
            backgroundColor: "#1a1a1a",
          },
          headerTintColor: "#ffffff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
              {/* Dynamic occasion icon placed between title and hamburger; centered vertically */}
              <OccasionHeaderIcon />
              <TouchableOpacity
                onPress={() => {
                  logAnalyticsEvent('help_viewed');
                  router.push('/(tabs)/help');
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: 'rgba(212,175,55,0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(212,175,55,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <HelpCircle size={16} color="#D4AF37" />
              </TouchableOpacity>
              <EnhancedHamburgerMenu inline />
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="read"
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              const state = navigation.getState();
              const currentRoute = state.routes[state.index];
              const isFocused = currentRoute?.name === 'read';

              if (isFocused) {
                const params = currentRoute.params as any;
                if (params?.fromDuas === 'true') {
                  e.preventDefault();
                  router.replace('/read');
                }
              }
            },
          })}
          options={{
            title: "Recite",
            tabBarIcon: ({ color, size }) => <BookOpen size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="quiz"
          options={{
            title: "Quiz",
            tabBarIcon: ({ color, size }) => (
              <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                <Mic size={22} color={color} />
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  backgroundColor: '#FFD700',
                  borderRadius: 4,
                  paddingHorizontal: 3,
                  paddingVertical: 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
                  shadowRadius: 1,
                  elevation: 2,
                }}>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#000' }}>AI</Text>
                </View>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="revision"
          options={{
            title: "Revise",
            tabBarIcon: ({ color, size }) => <RefreshCw size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color, size }) => <BarChart size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Setup",
            tabBarIcon: ({ color, size }) => <SettingsIcon size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="badges"
          options={{
            title: "Badges",
            href: null, // This hides it from the tab bar
          }}
        />
        <Tabs.Screen
          name="duas"
          options={{
            title: "Quranic Duas",
            href: null, // This hides it from the tab bar
          }}
        />
        <Tabs.Screen
          name="help"
          options={{
            title: "Feature Guide",
            href: null,
          }}
        />
      </Tabs>

      {/* Inline headerRight renders menu on all tabs; no absolute overlay needed */}
    </>
  );
}