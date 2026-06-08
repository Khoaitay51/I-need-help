import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { SPACING } from "../theme";

/**
 * KMA Logo Component
 * Displays full KMA logo (circular with book icon)
 */
const KMALogo = ({ size = "normal", showText = false }) => {
  const isSmall = size === "small";
  const logoSize = isSmall ? 32 : 44;

  return (
    <View style={styles.logoContainer}>
      {/* KMA Logo - Full circular logo */}
      <Image
        source={require("../../assets/kma.png")}
        style={[styles.logo, { width: logoSize, height: logoSize }]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    justifyContent: "flex-start",
  },

  logo: {
    aspectRatio: 1,
    borderRadius: 999,
  },
});

export default KMALogo;
