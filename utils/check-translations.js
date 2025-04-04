const fs = require('fs');
const path = require('path');

/**
 * This script checks for missing translations across language files
 * It compares all translations against English (en) as the reference
 */

// Paths to translation files
const localesDir = path.join(__dirname, '../locales');
const languages = ['en', 'es', 'fr'];
const namespaces = ['common', 'auth', 'events', 'notifications'];

// Function to get all keys from an object (including nested keys)
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = [...keys, ...getAllKeys(obj[key], newKey)];
    } else {
      keys.push(newKey);
    }
  }
  return keys;
}

// Function to check if all files exist
function checkFilesExist() {
  console.log('Checking if all translation files exist...');
  
  let allExist = true;
  
  languages.forEach(lang => {
    namespaces.forEach(ns => {
      const filePath = path.join(localesDir, lang, `${ns}.json`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`Missing file: ${filePath}`);
        allExist = false;
      }
    });
  });
  
  if (allExist) {
    console.log('All translation files exist.');
  }
  
  return allExist;
}

// Function to check for missing translations
function checkMissingTranslations() {
  console.log('\nChecking for missing translations...\n');
  
  namespaces.forEach(ns => {
    console.log(`Checking namespace: ${ns}`);
    
    // Reference file (English)
    const enPath = path.join(localesDir, 'en', `${ns}.json`);
    
    if (!fs.existsSync(enPath)) {
      console.log(`Reference file doesn't exist: ${enPath}`);
      return;
    }
    
    const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const enKeys = getAllKeys(enTranslations);
    
    // Check other languages
    languages.filter(lang => lang !== 'en').forEach(lang => {
      const langPath = path.join(localesDir, lang, `${ns}.json`);
      
      if (!fs.existsSync(langPath)) {
        console.log(`Translation file doesn't exist: ${langPath}`);
        return;
      }
      
      const langTranslations = JSON.parse(fs.readFileSync(langPath, 'utf8'));
      const langKeys = getAllKeys(langTranslations);
      
      const missingKeys = enKeys.filter(key => !langKeys.includes(key));
      
      if (missingKeys.length > 0) {
        console.log(`  Missing in ${lang}:`);
        missingKeys.forEach(key => console.log(`    - ${key}`));
      } else {
        console.log(`  All keys present in ${lang}`);
      }
    });
    
    console.log('');
  });
}

// Execute checks
(function main() {
  console.log('Translation Check Script\n');
  
  console.log('Languages:', languages);
  console.log('Namespaces:', namespaces);
  console.log('Locales Directory:', localesDir);
  console.log('');
  
  const filesExist = checkFilesExist();
  
  if (filesExist) {
    checkMissingTranslations();
  }
})();