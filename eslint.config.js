import js from '@eslint/js';
import ts from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  { ignores: ['dist', 'scripts/assets/.python/**'] },
  {
    // math + scripts must stay Phaser/DOM free
    files: ['src/math/**', 'scripts/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['phaser', '**/scenes/*', '**/game/*'] }],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage'],
    },
  },
];
