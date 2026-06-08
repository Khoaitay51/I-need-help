/**
 * KMA AI Mobile - Theme & Colors
 * Matching client design with KMA brand colors
 */

export const COLORS = {
  // KMA Brand Colors
  primary: "#c2185b",
  primaryDark: "#880e4f",
  primaryLight: "#e91e63",
  primary50: "rgba(194, 24, 91, 0.05)",
  primary10: "rgba(194, 24, 91, 0.1)",
  primary20: "rgba(194, 24, 91, 0.2)",

  // Accent
  accent: "#7c4dff",
  accentLight: "#b388ff",
  accent50: "rgba(124, 77, 255, 0.05)",

  // Surfaces
  surface: "#fafbfd",
  surfaceBright: "#ffffff",
  surfaceSecondary: "#ffffff",
  surfaceTertiary: "#f8fafc",
  surfaceDim: "#f0f2f7",

  // Text
  onSurface: "#0f1419",
  onSurfaceVariant: "#536471",

  // Outlines
  outline: "#8899a6",
  outlineVariant: "#e1e8ed",

  // Status
  success: "#4caf50",
  warning: "#ff9800",
  error: "#f44336",
  info: "#2196f3",

  // Neutral
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",

  // Shadows
  shadowXs: "rgba(0, 0, 0, 0.03)",
  shadowSm: "rgba(0, 0, 0, 0.05)",
  shadowMd: "rgba(0, 0, 0, 0.08)",
  shadowLg: "rgba(0, 0, 0, 0.1)",
};

export const TYPOGRAPHY = {
  // Font families would be handled by expo-font
  fontFamily: {
    display: "System",
    body: "System",
    mono: "monospace",
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
  },

  // Font weights
  fontWeight: {
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const commonStyles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  button: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryButton: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },

  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceSecondary,
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    padding: SPACING.lg,
    marginVertical: SPACING.md,
  },

  shadow: {
    elevation: 3,
    shadowColor: COLORS.shadowMd,
  },
};

export default {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  commonStyles,
};
