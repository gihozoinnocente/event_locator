const http = require('http');

/**
 * Simple script to test internationalization directly
 * Run this script with Node.js to test different languages
 */

const testLanguages = ['en', 'es', 'fr'];
const baseUrl = 'http://localhost:5000/api/auth/i18n-test';

// Test using Accept-Language header
console.log('\n=== Testing with Accept-Language header ===\n');
testLanguages.forEach(lang => {
  console.log(`Testing language: ${lang}`);
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/i18n-test',
    method: 'GET',
    headers: {
      'Accept-Language': lang
    }
  };
  
  const req = http.request(options, res => {
    let data = '';
    
    res.on('data', chunk => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log(`- Detected language: ${result.detectedLanguage}`);
        console.log(`- Welcome message: ${result.message}`);
        console.log(`- Events title: ${result.translations.events.title}`);
        console.log('');
      } catch (e) {
        console.error('Error parsing response:', e);
        console.log(data);
      }
    });
  });
  
  req.on('error', error => {
    console.error('Error:', error);
  });
  
  req.end();
});

// Test using query parameter
console.log('\n=== Testing with query parameter ===\n');
testLanguages.forEach(lang => {
  console.log(`Testing language: ${lang}`);
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/auth/i18n-test?lng=${lang}`,
    method: 'GET'
  };
  
  const req = http.request(options, res => {
    let data = '';
    
    res.on('data', chunk => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log(`- Detected language: ${result.detectedLanguage}`);
        console.log(`- Welcome message: ${result.message}`);
        console.log(`- Events title: ${result.translations.events.title}`);
        console.log('');
      } catch (e) {
        console.error('Error parsing response:', e);
        console.log(data);
      }
    });
  });
  
  req.on('error', error => {
    console.error('Error:', error);
  });
  
  req.end();
});