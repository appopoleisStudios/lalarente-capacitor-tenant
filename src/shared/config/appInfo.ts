import Constants from 'expo-constants';

const version = Constants.expoConfig?.version || 'unknown';
const nativeBuild =
  Constants.expoConfig?.ios?.buildNumber?.toString() ||
  Constants.expoConfig?.android?.versionCode?.toString() ||
  '';

export const APP_INFO = {
  name: Constants.expoConfig?.name || 'Lalarente',
  version,
  versionLabel: nativeBuild ? `Version ${version} (build ${nativeBuild})` : `Version ${version}`,
};
