const {
    defineConfig,
} = require('eslint/config');

const tsParser = require('@typescript-eslint/parser');
const typescriptEslintEslintPlugin = require('@typescript-eslint/eslint-plugin');
const promise = require('eslint-plugin-promise');
const optimizeRegex = require('eslint-plugin-optimize-regex');
const globals = require('globals');
const js = require('@eslint/js');

const {
    FlatCompat,
} = require('@eslint/eslintrc');

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
        sourceType: 'module',

        parserOptions: {
            project: './tsconfig.json',
        },

        globals: {
            ...globals.node,
            ...globals.jest,
        },
    },

    plugins: {
        '@typescript-eslint': typescriptEslintEslintPlugin,
        promise,
        'optimize-regex': optimizeRegex,
    },

    extends: compat.extends(
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:promise/recommended',
        'prettier',
    ),

    rules: {
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',

        'no-duplicate-imports': ['error', {
            includeExports: true,
        }],

        curly: ['error', 'all'],
        eqeqeq: 'error',

        'no-else-return': ['error', {
            allowElseIf: false,
        }],

        'no-labels': 'error',
        'no-return-await': 'error',
        'no-self-compare': 'error',

        'array-bracket-newline': ['error', {
            multiline: true,
        }],

        'comma-dangle': ['error', 'only-multiline'],
        'comma-style': 'error',
        'no-unneeded-ternary': 'error',
        'promise/always-return': 'off',
        'promise/prefer-await-to-then': 'off',
        'optimize-regex/optimize-regex': 'warn',
        '@typescript-eslint/prefer-for-of': 'warn',

        'quotes': ['error', 'single', {
            avoidEscape: true,
            allowTemplateLiterals: true,
        }],
    },
}]);
