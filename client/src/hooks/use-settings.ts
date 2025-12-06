import { useState, useEffect } from "react";

const SETTINGS_KEY = "rndc_settings";

export interface RndcSettings {
  usernameGps: string;
  passwordGps: string;
  companyNit: string;
}

const DEFAULT_SETTINGS: RndcSettings = {
  usernameGps: "usuariogps",
  passwordGps: "passwordgps",
  companyNit: "9999999999",
};

export function useSettings() {
  const [settings, setSettings] = useState<RndcSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const saveSettings = (newSettings: RndcSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  return { settings, saveSettings };
}
