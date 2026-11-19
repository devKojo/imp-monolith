import type { NavItem } from '@imp/ui/app/components/UiSidebarNav.vue';
import { t } from '../../i18n';

export type ConsoleSection = 'overview' | 'campaigns' | 'participants' | 'rewards';

/** The business console navigation. One definition, so every console page shows the same menu. */
export function consoleNav(current: string): NavItem[] {
  const items: Array<{ id: ConsoleSection; to: string; icon: NavItem['icon'] }> = [
    { id: 'overview', to: '/app', icon: 'grid' },
    { id: 'campaigns', to: '/app/campaigns', icon: 'rocket' },
    { id: 'participants', to: '/app/participants', icon: 'users' },
    { id: 'rewards', to: '/app/rewards', icon: 'gift' },
  ];
  return items.map((i) => ({
    label: t(`console.nav.${i.id}` as const),
    to: i.to,
    ...(i.icon ? { icon: i.icon } : {}),
    current: i.id === current,
  }));
}
