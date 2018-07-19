import babel from 'rollup-plugin-babel'

export default {
  entry: 'src/index.js',
  dest: 'dist/bundle.js',
  format: 'cjs',
  external: ['babel-polyfill', 'ramda', 'reselect'],
  plugins: [
    babel({
      exclude: 'node_modules/**',
    }),
  ],
}
