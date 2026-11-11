import HomeV2 from './HomeV2';
import HomeOriginal from './HomeOriginal';
import { HOME_VERSION } from '../lib/config';

export default function Home() {
  return HOME_VERSION === 'v2' ? <HomeV2 /> : <HomeOriginal />;
}
