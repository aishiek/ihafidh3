import { EnhancedHamburgerMenu } from '@/components/EnhancedHamburgerMenu';
import OccasionHeaderIcon from '@/components/OccasionHeaderIcon';
import { useThemeColor } from "@/utils/useThemeColor";
import { Tabs } from "expo-router";
import { BarChart, BookOpen, Brain, Home, RefreshCw, Settings as SettingsIcon } from "lucide-react-native";
import React from "react";
import { Platform, View } from 'react-native';

export default function TabLayout() {
  const { primary } = useThemeColor();

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
            height: Platform.OS === 'android' ? 70 : 60,
            paddingBottom: Platform.OS === 'android' ? 12 : 8,
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
          options={{
            title: "Recite",
            tabBarIcon: ({ color, size }) => <BookOpen size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="quiz"
          options={{
            title: "Quiz",
            tabBarIcon: ({ color, size }) => <Brain size={22} color={color} />,
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
      </Tabs>

      {/* Inline headerRight renders menu on all tabs; no absolute overlay needed */}
    </>
  );
}