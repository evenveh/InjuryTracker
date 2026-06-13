import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { initDatabase } from './src/database/db';
import { theme, paperSettings, C, statusBarStyle } from './src/theme';
import TodayScreen from './src/screens/TodayScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ExportScreen from './src/screens/ExportScreen';

const Tab = createBottomTabNavigator();

// React Navigation theme synced to the Paper MD3 colors.
const navTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.onSurface,
    border: theme.colors.outline,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: C.card, elevation: 4, shadowOpacity: 0.3 },
  headerTintColor: C.text,
  headerTitleStyle: { fontWeight: '700' },
  tabBarActiveTintColor: C.accent,
  tabBarInactiveTintColor: C.muted,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
};

const TABS = {
  Today: 'notebook-edit-outline',
  History: 'history',
  Export: 'export-variant',
};

function tabIcon(routeName) {
  return ({ color, size, focused }) => (
    <MaterialCommunityIcons
      name={TABS[routeName]}
      color={color}
      size={focused ? size + 1 : size}
    />
  );
}

// Rendered inside SafeAreaProvider so useSafeAreaInsets() returns real insets.
// The system navigation bar inset is added to the tab bar height/padding, so
// Android's nav bar no longer overlaps the Today/History/Export tabs.
function Tabs() {
  const insets = useSafeAreaInsets();
  const tabBarStyle = {
    backgroundColor: C.card,
    borderTopColor: C.border,
    height: 60 + insets.bottom,
    paddingBottom: 8 + insets.bottom,
    paddingTop: 6,
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          ...screenOptions,
          tabBarStyle,
          tabBarIcon: tabIcon(route.name),
        })}
      >
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Export" component={ExportScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme} settings={paperSettings}>
          <StatusBar style={statusBarStyle} backgroundColor={C.card} />
          <Tabs />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
