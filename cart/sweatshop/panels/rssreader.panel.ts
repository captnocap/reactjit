import { RSSReaderPanel } from '../components/storage/RSSReaderPanel';
import { register } from '../panel-registry';

register({
  id: 'rss-reader',
  title: 'RSS',
  defaultSlot: 'left',
  icon: 'rss',
  component: RSSReaderPanel,
  userVisible: true,
  defaultOpen: false,
});
