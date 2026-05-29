import React, { forwardRef, useMemo, useCallback } from "react";
import { StyleSheet } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetModalProps,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useAppTheme } from "@theme";
import { BorderRadius } from "@shared/components/TokenRegistry";

type Props = {
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  onDismiss?: () => void;
  /** Override the sheet panel color. Defaults to the (semi-transparent) surfaceCard token. */
  backgroundColor?: string;
} & Pick<BottomSheetModalProps, "enableDynamicSizing" | "enablePanDownToClose">;

export const TrezoBottomSheet = forwardRef<BottomSheetModal, Props>(
  (
    {
      snapPoints,
      children,
      onDismiss,
      backgroundColor,
      enableDynamicSizing = true,
      enablePanDownToClose = true,
    },
    ref,
  ) => {
    const { theme } = useAppTheme();
    const points = useMemo(() => snapPoints ?? ["50%"], [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.6}
          pressBehavior="close"
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={points}
        enableDynamicSizing={enableDynamicSizing}
        enablePanDownToClose={enablePanDownToClose}
        onDismiss={onDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: backgroundColor ?? theme.colors.surfaceCard,
          borderTopLeftRadius: BorderRadius.xl,
          borderTopRightRadius: BorderRadius.xl,
        }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      >
        <BottomSheetView style={styles.body}>{children}</BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
});
