import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
  async getTokens() {
    const [accessToken, refreshToken] = await Promise.all([
      AsyncStorage.getItem("accessToken"),
      AsyncStorage.getItem("refreshToken"),
    ]);
    return { accessToken, refreshToken };
  },

  async setTokens(accessToken, refreshToken) {
    await Promise.all([
      AsyncStorage.setItem("accessToken", accessToken),
      AsyncStorage.setItem("refreshToken", refreshToken || ""),
    ]);
  },

  async getUser() {
    const value = await AsyncStorage.getItem("userInfo");
    return value ? JSON.parse(value) : null;
  },

  async setUser(user) {
    await AsyncStorage.setItem("userInfo", JSON.stringify(user));
  },

  async clearSession() {
    await Promise.all([
      AsyncStorage.removeItem("accessToken"),
      AsyncStorage.removeItem("refreshToken"),
      AsyncStorage.removeItem("userInfo"),
    ]);
  },
};
