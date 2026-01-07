import { useState, useEffect } from "react";

const SETTINGS_KEY = "rndc_settings";

export type WsEnvironment = "testing" | "production";

export interface RndcSettings {
  usernameGps: string;
  passwordGps: string;
  usernameRndc: string;
  passwordRndc: string;
  companyNit: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyCity: string;
  numIdGps: string;
  wsUrlProd: string;
  wsUrlTest: string;
  wsEnvironment: WsEnvironment;
  consecutivo: number;
}

const DEFAULT_SETTINGS: RndcSettings = {
  usernameGps: "",
  passwordGps: "",
  usernameRndc: "",
  passwordRndc: "",
  companyNit: "",
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyCity: "",
  numIdGps: "",
  wsUrlProd: "http://rndcws2.mintransporte.gov.co:8080/ws/soap/IBPMServices",
  wsUrlTest: "http://plc.mintransporte.gov.co:8080/soap/IBPMServices",
  wsEnvironment: "testing",
  consecutivo: 1,
};

export function useSettings() {
  const [settings, setSettings] = useState<RndcSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const saveSettings = (newSettings: RndcSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const getActiveWsUrl = () => {
    return settings.wsEnvironment === "production" 
      ? settings.wsUrlProd 
      : settings.wsUrlTest;
  };

  return { settings, saveSettings, getActiveWsUrl };
}
