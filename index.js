import {AppRegistry, LogBox} from 'react-native'; // Tambahkan LogBox
import App from './App';
import {name as appName} from './app.json';

// --- TAMBAHKAN BARIS INI ---
LogBox.ignoreLogs([
  'Firestore (12.6.0): Could not reach Cloud Firestore backend',
  'Network request failed',
  'Possible Unhandled Promise Rejection'
]);
// ---------------------------

AppRegistry.registerComponent(appName, () => App);