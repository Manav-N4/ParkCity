import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  TextInput,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

// Space kept between the focused field and the top of the keyboard.
const REVEAL_MARGIN = 24;

/**
 * Keeps the focused text field visible above the keyboard inside a ScrollView.
 *
 * With Android edge-to-edge the window is no longer resized when the keyboard
 * opens, so this measures the focused field on screen and scrolls it into view.
 * It works the same way whether or not the window is resized, and on iOS.
 *
 * Usage:
 *   const keyboard = useKeyboardAwareScroll();
 *   <ScrollView ref={keyboard.scrollRef} onScroll={keyboard.handleScroll}
 *     scrollEventThrottle={16}
 *     contentContainerStyle={{ paddingBottom: base + keyboard.keyboardHeight }}>
 *     <TextInput onFocus={keyboard.revealOnFocus} />
 */
export function useKeyboardAwareScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((item) => item !== timer);
      callback();
    }, delay);

    timers.current.push(timer);
  }, []);

  const revealFocusedInput = useCallback(() => {
    const visibleTop = keyboardTop.current;
    const input = TextInput.State.currentlyFocusedInput();

    if (visibleTop == null || !input) {
      return;
    }

    input.measureInWindow((_x, y, _width, height) => {
      const fieldBottom = y + height;
      const visibleBottom = visibleTop - REVEAL_MARGIN;

      if (fieldBottom > visibleBottom) {
        scrollRef.current?.scrollTo({
          y: scrollOffset.current + (fieldBottom - visibleBottom),
          animated: true,
        });
      }
    });
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(
      showEvent,
      (event: KeyboardEvent) => {
        const { height, screenY } = event.endCoordinates;

        keyboardTop.current =
          screenY > 0 ? screenY : Dimensions.get('screen').height - height;
        setKeyboardHeight(height);

        // Let the extra bottom space render before scrolling.
        schedule(revealFocusedInput, Platform.OS === 'ios' ? 250 : 80);
      },
    );

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [revealFocusedInput, schedule]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  // For moving between fields while the keyboard is already open.
  const revealOnFocus = useCallback(() => {
    schedule(revealFocusedInput, 60);
  }, [revealFocusedInput, schedule]);

  return {
    scrollRef,
    keyboardHeight,
    handleScroll,
    revealOnFocus,
  };
}
