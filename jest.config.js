/**
 * Jest configuration
 */

module.exports = {
    // The test environment that will be used for testing
    testEnvironment: 'node',
    
    // The directory where Jest should output its coverage files
    coverageDirectory: 'coverage',
    
    // Specify files to collect coverage from
    collectCoverageFrom: [
      'src/**/*.js',
      '!src/server.js',
      '!src/workers/*.js',
      '!src/scripts/*.js'
    ],
    
    // The paths to modules that run some code to configure or set up the testing framework
    setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
    
    // Indicates whether each individual test should be reported during the run
    verbose: true,
    
    // Automatically clear mock calls and instances between every test
    clearMocks: true,
    
    // A list of paths to directories that Jest should use to search for files in
    roots: ['<rootDir>/tests'],
    
    // Indicates whether the coverage information should be collected while executing the test
    collectCoverage: true,
    
    // The glob patterns Jest uses to detect test files
    testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
    
    // An array of regexp pattern strings that are matched against all test paths
    testPathIgnorePatterns: ['/node_modules/'],
    
    // An array of regexp pattern strings that are matched against all source file paths
    transformIgnorePatterns: ['/node_modules/'],
    
    // A map from regular expressions to paths to transformers
    transform: {}
  };