import { create } from "zustand";

interface AuthState {
  isLoggedIn: boolean;
  token: string | null;
  username: string | null;
  login: (username: string, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  token: null,
  username: null,
  login: (username: string, token: string) =>
    set({ isLoggedIn: true, username, token }),
  logout: () => set({ isLoggedIn: false, username: null, token: null }),
}));

interface FeishuConfig {
  appId: string;
  appSecret: string;
  baseToken: string;
  accountTableId: string;
  articleTableId: string;
}

interface SettingsState {
  feishu: FeishuConfig;
  setFeishu: (config: Partial<FeishuConfig>) => void;
  isConfigured: () => boolean;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  feishu: {
    appId: "",
    appSecret: "",
    baseToken: "",
    accountTableId: "tbloLzUPoKoBOHti",
    articleTableId: "tblQ9Jj095axnoQF",
  },
  setFeishu: (config) =>
    set((state) => ({ feishu: { ...state.feishu, ...config } })),
  isConfigured: () => {
    const { appId, baseToken } = get().feishu;
    return appId.length > 0 && baseToken.length > 0;
  },
}));
