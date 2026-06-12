import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent kaller AppRegistry.registerComponent('main', () => App)
// og setter opp miljøet riktig for både Expo Go og native bygg.
registerRootComponent(App);
