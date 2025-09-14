import { Redirect } from 'expo-router';

// Redirect root route to the tabs home screen
export default function RootIndex() {
  return <Redirect href="/(tabs)" />;
}
