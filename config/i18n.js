const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware');
const i18nextFsBackend = require('i18next-fs-backend');
const path = require('path');

const setupI18n = () => {
  i18next
    .use(i18nextFsBackend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
      debug: process.env.NODE_ENV === 'development',
      fallbackLng: 'en',
      supportedLngs: ['en', 'es', 'fr'],
      backend: {
        loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
      },
      ns: ['common', 'auth', 'events', 'notifications'],
      defaultNS: 'common',
      detection: {
        // Prioritize query parameter over header for easier testing
        order: ['querystring', 'header', 'cookie'],
        lookupQuerystring: 'lng',
        lookupHeader: 'accept-language',
        lookupCookie: 'i18next',
        caches: ['cookie'],
      },
    });

  return i18nextMiddleware.handle(i18next);
};

module.exports = setupI18n;