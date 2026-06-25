import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

export default function FadeInView({ children, delay = 0, distance = 14, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }

      Animated.parallel([
        Animated.timing(opacity, {
          delay,
          duration: 420,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          delay,
          duration: 460,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      active = false;
    };
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
