/**
 * Copy for the web app's own pages (the shared UI library keeps its words in packages/ui). Same
 * rules (UI-CPY-01..06): plain language, active voice, say what happened and what to do next,
 * verb + object on buttons, "Business" not "Tenant", errors never blame the user and never reveal
 * whether an account exists. Keys are i18n-ready (ADR-F007).
 */
export const en = {
  // navigation
  'nav.discover': 'Discover',
  'nav.forBusinesses': 'For businesses',
  'nav.signin': 'Sign in',
  'nav.signup': 'Create account',

  // validation (mirrors the server rules; the server is authoritative)
  'validation.email.required': 'Enter your email address.',
  'validation.email.invalid': 'Enter an email address like name@company.com.',
  'validation.name.required': 'Enter your full name.',
  'validation.name.tooLong': 'Use 120 characters or fewer.',
  'validation.businessName.required': 'Enter your business name.',
  'validation.businessName.tooLong': 'Use 160 characters or fewer.',
  'validation.password.required': 'Enter your password.',
  'validation.password.tooLong': 'Use 128 characters or fewer.',
  'validation.password.rules': 'Meet all the password requirements below.',
  'validation.password.rule.length': 'At least {min} characters',
  'validation.password.rule.emailName': 'Does not contain your email name',
  'validation.password.rule.variety': 'Is not one repeated character',

  // sign in
  'signin.title': 'Welcome back',
  'signin.subtitle': 'Sign in to manage your campaigns.',
  'signin.badge': 'Business sign in',
  'signin.email': 'Email address',
  'signin.password': 'Password',
  'signin.submit': 'Sign in',
  'signin.submitting': 'Signing in...',
  'signin.noAccount': "Don't have an account?",
  'signin.createAccount': 'Create an account',
  'signin.invalid': 'Invalid email or password. Check your details and try again.',
  'signin.unverified.title': 'Verify your email first',
  'signin.unverified.body':
    'We sent a verification link when you created your account. Open it, then sign in.',
  'common.waitCountdown': 'You can try again when the timer ends.',
  'signin.sessionNote': 'For your security, your session ends after 30 minutes of inactivity.',

  // sign up (step 1)
  'steps.account': 'Your account',
  'steps.business': 'Your business',
  'signup.title': 'Create your account',
  'signup.subtitle': 'Start building interactive campaigns for your business.',
  'signup.name': 'Full name',
  'signup.email': 'Work email',
  'signup.emailHint': 'We will send a link to verify it.',
  'signup.password': 'Create password',
  'signup.passwordBreached':
    'That password has appeared in a known data breach. Choose a different password.',
  'signup.passwordRejected': 'That password cannot be used. Choose a different password.',
  'signup.passwordHint': 'We also check passwords against known data breaches.',
  'signup.continue': 'Continue',
  'signup.haveAccount': 'Already have an account?',
  'signup.signin': 'Sign in',
  'signup.aside.title': 'What you can do',
  'signup.aside.campaigns.title': 'Quizzes, polls, surveys and giveaways',
  'signup.aside.campaigns.body': 'Build the experience once and publish it to a shareable page.',
  'signup.aside.draws.title': 'Draws you can verify',
  'signup.aside.draws.body': 'Every draw publishes its snapshot, seed commitment and proof.',
  'signup.aside.privacy.title': 'Privacy by design',
  'signup.aside.privacy.body':
    'Participants consent explicitly and you control how long data is kept.',

  // business registration (step 2)
  'business.title': 'Register your business',
  'business.subtitle': 'Tell us who this account is for.',
  'business.accountFor': 'Creating an account for',
  'business.change': 'Change',
  'business.name': 'Business name',
  'business.nameHint': 'Shown to your team and on your campaign pages.',
  'business.agreementLegend': 'Agreement',
  'business.agreement':
    'I represent this business and accept the Terms of Service and the Data Processing Addendum',
  'business.agreementError': 'Accept the agreement to create your account.',
  'business.submit': 'Create business account',
  'business.submitting': 'Creating your account...',

  // check email
  'checkEmail.title': 'Check your email',
  'checkEmail.badge': 'Verification link sent',
  'checkEmail.body':
    'If {email} is not registered yet, we sent it a verification link. Open the link to activate your account. If you already have an account, sign in instead.',
  'checkEmail.bodyNoEmail':
    'We sent a verification link. Open it to activate your account. If you already have an account, sign in instead.',
  'checkEmail.dev': 'Development only: the verification link is printed in the API console.',
  'checkEmail.signin': 'Go to sign in',

  // verify email
  'verify.working': 'Verifying your email',
  'verify.ok.title': 'Email verified',
  'verify.ok.body': 'Your account is ready. Sign in to continue.',
  'verify.bad.title': 'This link did not work',
  'verify.bad.body':
    'It may have expired or already been used. Sign in to continue, or create your account again.',
  'verify.signin': 'Sign in',
  'verify.signup': 'Create your account',

  // discovery
  'discover.title': 'Discover live campaigns',
  'discover.subtitle':
    'Take part in quizzes, polls and giveaways run by businesses on the platform.',
  'discover.search': 'Search campaigns',
  'discover.type': 'Campaign type',
  'discover.count.one': '1 campaign',
  'discover.count.other': '{n} campaigns',
  'discover.sample.title': 'Sample data',
  'discover.sample.body':
    'These campaigns are examples for development. Live campaigns appear here once businesses publish them.',
  'discover.empty.title': 'No campaigns match',
  'discover.empty.body': 'Try a different search, or clear the filters.',
  'discover.empty.clear': 'Clear filters',
  'discover.none.title': 'No campaigns are live right now',
  'discover.none.body': 'Check back soon.',
  'discover.how.title': 'How entries stay fair',
  'discover.how.verified.title': 'Verified entries',
  'discover.how.verified.body':
    'Campaigns that give prizes confirm each entry with a one-time code.',
  'discover.how.draws.title': 'Draws with proof',
  'discover.how.draws.body': 'Winners are picked by a published method you can check yourself.',
  'discover.how.privacy.title': 'Clear consent',
  'discover.how.privacy.body': 'We ask only what a campaign needs, and tell you why.',
  'type.all': 'All campaigns',
  'type.quiz': 'Quizzes',
  'type.poll': 'Polls',
  'type.survey': 'Surveys',
  'type.vote': 'Voting',
  'type.giveaway': 'Giveaways',
  'type.quiz.one': 'Quiz',
  'type.poll.one': 'Poll',
  'type.survey.one': 'Survey',
  'type.vote.one': 'Vote',
  'type.giveaway.one': 'Giveaway',
  'time.left.day': '1 day left',
  'time.left.days': '{n} days left',
  'time.left.hour': '1 hour left',
  'time.left.hours': '{n} hours left',
  'time.left.soon': 'Ending soon',
  'time.ended': 'Ended',
  'prize.label': 'Prize',

  // dashboard
  'app.title': 'Overview',
  'app.welcome': 'Welcome, {name}',
  'app.business': 'Active business',
  'app.role': 'Your role',
  'app.switch': 'Switch business',
  'app.logout': 'Sign out',
  'app.loggingOut': 'Signing out...',
  'app.soon': 'Campaign tools are coming soon.',
  'app.nav.overview': 'Overview',
} as const;

export type AppTextKey = keyof typeof en;
