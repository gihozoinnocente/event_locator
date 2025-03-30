const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

// Initialize i18next with backend and middleware
const initializeI18n = () => {
  const i18n = i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
      backend: {
        loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
      },
      fallbackLng: 'en',
      supportedLngs: ['en', 'es', 'fr', 'de'],
      preload: ['en', 'es', 'fr', 'de'],
      ns: ['translation'],
      defaultNS: 'translation',
      detection: {
        // order of detection methods
        order: ['querystring', 'cookie', 'header'],
        // cookie settings
        caches: ['cookie'],
        lookupQuerystring: 'lng',
        lookupCookie: 'i18next',
        lookupHeader: 'accept-language',
      },
      debug: process.env.NODE_ENV === 'development',
    });

  return i18n;
};

module.exports = { initializeI18n };