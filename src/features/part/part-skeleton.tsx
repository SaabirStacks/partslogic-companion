import { View } from 'react-native';

import { Breathing } from '@/ui/placeholder';

// The part card's own shape while it loads: the photo, the brand and number, the stock card with its
// three tiles, then the bins and prices.
export function PartSkeleton() {
  return (
    <View className="flex-1 bg-ground px-4 pt-3">
      <Breathing label="Loading part">
        <View className="gap-3">
          <View className="h-60 rounded-card bg-rule" />
          <View className="gap-2 px-1 pt-1">
            <View className="h-3.5 w-16 rounded-full bg-rule" />
            <View className="h-9 w-48 rounded-[8px] bg-rule" />
            <View className="h-4 w-28 rounded-full bg-rule" />
          </View>
          <View className="gap-3 rounded-card border border-edge bg-surface p-4">
            <View className="flex-row items-start justify-between">
              <View className="h-7 w-24 rounded-chip bg-rule" />
              <View className="h-8 w-10 rounded-[8px] bg-rule" />
            </View>
            <View className="flex-row gap-1.5">
              <View className="h-16 flex-1 rounded-card bg-rule" />
              <View className="h-16 flex-1 rounded-card bg-rule" />
              <View className="h-16 flex-1 rounded-card bg-rule" />
            </View>
            <View className="h-12 rounded-card bg-rule" />
          </View>
          <View className="h-14 rounded-card bg-rule" />
        </View>
      </Breathing>
    </View>
  );
}
