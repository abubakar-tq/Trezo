import { Feather } from "@expo/vector-icons";
import React, {
  MutableRefObject,
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type PasswordInputProps = Omit<TextInputProps, "secureTextEntry"> & {
  containerStyle?: StyleProp<ViewStyle>;
  iconColor?: string;
};

const ICON_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

const PasswordInput = forwardRef<TextInput, PasswordInputProps>(
  (
    {
      containerStyle,
      iconColor = "#9ca3af",
      style,
      autoCapitalize,
      textContentType,
      autoCorrect,
      autoComplete,
      spellCheck,
      keyboardType,
      onChangeText,
      ...rest
    },
    ref,
  ) => {
    const [isVisible, setIsVisible] = useState(false);
    const inputRef = useRef<TextInput | null>(null);

    const flattenedStyle = useMemo(() => StyleSheet.flatten(style) ?? {}, [style]);

    const inputStyle: TextStyle = useMemo(() => {
      const paddingRight = (() => {
        if (typeof flattenedStyle.paddingRight === "number") return flattenedStyle.paddingRight;
        if (typeof flattenedStyle.paddingHorizontal === "number") return flattenedStyle.paddingHorizontal;
        return 16;
      })();

      return {
        ...flattenedStyle,
        paddingRight: paddingRight + 32,
      } satisfies TextStyle;
    }, [flattenedStyle]);

    const handleChangeText = useCallback(
      (text: string) => {
        onChangeText?.(text);
      },
      [onChangeText],
    );

    return (
      <View style={[styles.wrapper, containerStyle]}>
        <TextInput
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref && "current" in ref) {
              (ref as MutableRefObject<TextInput | null>).current = node;
            }
          }}
          {...rest}
          style={inputStyle}
          autoCapitalize={autoCapitalize ?? "none"}
          textContentType={textContentType ?? "password"}
          autoCorrect={autoCorrect ?? false}
          autoComplete={autoComplete ?? "password"}
          spellCheck={spellCheck ?? false}
          keyboardType={keyboardType ?? "default"}
          secureTextEntry={!isVisible}
          onChangeText={handleChangeText}
          importantForAutofill="yes"
          disableFullscreenUI
          caretHidden={false}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isVisible ? "Hide password" : "Show password"}
          hitSlop={ICON_HIT_SLOP}
          style={styles.iconButton}
          onPress={() => {
            setIsVisible((prev) => !prev);
            inputRef.current?.focus();
          }}
        >
          <Feather name={isVisible ? "eye-off" : "eye"} size={18} color={iconColor} />
        </Pressable>
      </View>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export type { PasswordInputProps };
export default PasswordInput;

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    position: "relative",
    justifyContent: "center",
  },
  iconButton: {
    position: "absolute",
    right: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
