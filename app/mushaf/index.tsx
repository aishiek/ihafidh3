import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import MushafViewerScreen from './screens/MushafViewerScreen';

export default function Page() {
  const params = useLocalSearchParams();
  let pageNumber: string | undefined = undefined;
  if (params?.pageNumber) {
    pageNumber = Array.isArray(params.pageNumber) ? params.pageNumber[0] : params.pageNumber;
  }
  return (
  <MushafViewerScreen key={pageNumber} />
  );
}
