import { computed } from 'vue';
import { t } from '../../../i18n';
import { HOME } from '../constants';
import { useAuth } from './useAuth';

/** The signed-in account's dashboard route, or null when nobody is signed in. */
export function useHomeLink() {
  const { session } = useAuth();
  return computed(() => (session.value ? HOME[session.value.user.accountType] : null));
}

/**
 * Where the "back" button on a campaign's unavailable screen leads: a signed-in person's dashboard,
 * or the public campaign list for a visitor.
 */
export function useUnavailableExit() {
  const home = useHomeLink();
  return computed(() =>
    home.value
      ? { to: home.value, label: t('common.backToDashboard') }
      : { to: '/discover', label: t('quiz.back') },
  );
}
