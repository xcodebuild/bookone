/* eslint-disable unicorn/prefer-module */
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testRegex: '(test|spec)\.[jt]sx?$',
	collectCoverageFrom: [
		"src/**/*.{js,jsx,ts,tsx}",
		"!**/node_modules/**",
		"!**/vendor/**"
	]
};
