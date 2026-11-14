import { t } from '../../i18n';

/**
 * Footer shared by the public pages (discovery and the business entry page). Built per call so
 * nothing is shared between server-rendered requests.
 */
export function siteFooter() {
  return {
    tagline: t('footer.tagline'),
    copyright: t('footer.copyright', { year: new Date().getFullYear() }),
    columns: [
      {
        title: t('footer.participants'),
        links: [
          { label: t('footer.participants.discover'), to: '/discover' },
          { label: t('footer.participants.signin'), to: '/signin' },
          { label: t('footer.participants.signup'), to: '/signup' },
        ],
      },
      {
        title: t('footer.business'),
        links: [
          { label: t('footer.business.overview'), to: '/business' },
          { label: t('footer.business.register'), to: '/business/register' },
          { label: t('footer.business.signin'), to: '/business/signin' },
        ],
      },
      {
        title: t('footer.support'),
        links: [
          { label: t('footer.support.help'), to: '/help' },
          { label: t('footer.support.report'), to: '/report-abuse' },
        ],
      },
    ],
  };
}
