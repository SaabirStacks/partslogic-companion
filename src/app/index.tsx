import { Redirect } from 'expo-router';

// The app opens on Look up.
export default function Index() {
  return <Redirect href="/lookup" />;
}
