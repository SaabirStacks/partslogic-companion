import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cx } from '@/ui/cx';
import { depthStyle } from '@/ui/depth';
import { Icon } from '@/ui/icon';
import { EASE_OUT } from '@/ui/motion';
import { Txt } from '@/ui/text';
import { useScheme } from '@/ui/theme';
import type { PartImage } from '@/vendor/partslogic/shared/catalogue';

// One picture per position, the large copy where there is one, in PartsLogic's order.
export function photoList(images: readonly PartImage[]): PartImage[] {
  const best = new Map<number, PartImage>();
  for (const image of images) {
    const held = best.get(image.position);
    if (!held || (held.size === 'thumb' && image.size !== 'thumb')) best.set(image.position, image);
  }
  return [...best.values()].sort((a, b) => a.position - b.position);
}

const HERO_HEIGHT = 240;

// The part's photos first on its card, big enough to recognise the part from: swipe between them, and tap
// one to open it full screen and zoom. With none, a quiet empty frame says so.
export function PartPhotos({ photos, label }: { photos: PartImage[]; label: string }) {
  const scheme = useScheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <View accessible accessibilityLabel="No photo yet" className="h-32 items-center justify-center gap-1.5 rounded-card border-[1.5px] border-dashed border-edge">
        <Icon name="noPhoto" size={30} colour="quiet-ink" />
        <Txt variant="label" ink="text-quiet-ink">
          No photo yet
        </Txt>
      </View>
    );
  }

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={depthStyle('raise', scheme)} className="overflow-hidden rounded-card bg-white" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={photos}
          keyExtractor={(photo) => String(photo.id)}
          onMomentumScrollEnd={settle}
          renderItem={({ item, index: at }) => (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${at + 1} of ${photos.length} of ${label}. Open full screen`}
              onPress={() => setOpen(at)}
              style={{ width, height: HERO_HEIGHT }}
              className="items-center justify-center p-4 active:opacity-80">
              <Image source={{ uri: item.url }} contentFit="contain" transition={160} style={{ width: width - 32, height: HERO_HEIGHT - 32 }} />
            </Pressable>
          )}
        />
      ) : (
        <View style={{ height: HERO_HEIGHT }} />
      )}
      <View pointerEvents="none" className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-[10px] bg-black/5">
        <Icon name="expand" size={16} colour="quiet-ink" />
      </View>
      {photos.length > 1 ? (
        <View pointerEvents="none" className="absolute inset-x-0 bottom-3 flex-row justify-center gap-2">
          {photos.map((photo, at) => (
            <View key={photo.id} className={cx('h-2 rounded-full', at === index ? 'w-5 bg-black/70' : 'w-2 bg-black/20')} />
          ))}
        </View>
      ) : null}
      <PhotoViewer photos={photos} start={open} label={label} onClose={() => setOpen(null)} />
    </View>
  );
}

// Full screen on black: swipe between photos, pinch or double-tap to zoom, drag while zoomed.
function PhotoViewer({ photos, start, label, onClose }: { photos: PartImage[]; start: number | null; label: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const visible = start !== null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onShow={() => setIndex(start ?? 0)} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0c0e' }}>
        <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center justify-between px-4 pb-2">
          <Txt variant="label" ink="text-white" numbers>
            {`${index + 1} of ${photos.length}`}
          </Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photos" onPress={onClose} className="h-12 w-12 items-center justify-center rounded-full bg-white/15 active:bg-white/25">
            <Icon name="close" size={22} colour="on-action" />
          </Pressable>
        </View>
        {visible ? (
          <FlatList
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            initialScrollIndex={start ?? 0}
            getItemLayout={(_, at) => ({ length: width, offset: width * at, index: at })}
            showsHorizontalScrollIndicator={false}
            data={photos}
            keyExtractor={(photo) => String(photo.id)}
            onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index: at }) => (
              <ZoomablePhoto url={item.url} width={width} label={`Photo ${at + 1} of ${photos.length} of ${label}`} onZoom={setZoomed} />
            )}
          />
        ) : null}
        <View style={{ paddingBottom: insets.bottom + 12 }} className="items-center px-4 pt-2">
          <Txt variant="caption" ink="text-white" numberOfLines={1}>
            {label}
          </Txt>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const MAX_ZOOM = 4;

function ZoomablePhoto({ url, width, label, onZoom }: { url: string; width: number; label: string; onZoom: (zoomed: boolean) => void }) {
  const scale = useSharedValue(1);
  const start = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.set(withTiming(1, { duration: 220, easing: EASE_OUT }));
    x.set(withTiming(0, { duration: 220, easing: EASE_OUT }));
    y.set(withTiming(0, { duration: 220, easing: EASE_OUT }));
    scheduleOnRN(onZoom, false);
  };

  // Gesture Handler 3's hooks: the callbacks run on the UI thread, like the animation they drive.
  const pinch = usePinchGesture({
    onActivate: () => {
      start.set(scale.get());
    },
    onUpdate: (event) => {
      scale.set(Math.min(MAX_ZOOM, Math.max(1, start.get() * event.scale)));
    },
    onDeactivate: () => {
      if (scale.get() <= 1.05) reset();
      else scheduleOnRN(onZoom, true);
    },
  });

  const pan = usePanGesture({
    averageTouches: true,
    onActivate: () => {
      fromX.set(x.get());
      fromY.set(y.get());
    },
    onUpdate: (event) => {
      if (scale.get() <= 1) return;
      x.set(fromX.get() + event.translationX);
      y.set(fromY.get() + event.translationY);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: () => {
      if (scale.get() > 1) reset();
      else {
        scale.set(withTiming(2.2, { duration: 220, easing: EASE_OUT }));
        scheduleOnRN(onZoom, true);
      }
    },
  });

  const gestures = useSimultaneousGestures(pinch, pan, doubleTap);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));

  return (
    <GestureDetector gesture={gestures}>
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width }} className="flex-1 items-center justify-center overflow-hidden">
        <Animated.View style={[{ width: width - 32, height: width - 32 }, style]}>
          <Image source={{ uri: url }} contentFit="contain" style={{ flex: 1, backgroundColor: 'white', borderRadius: 16 }} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
