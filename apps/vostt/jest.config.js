module.exports = {
  name: 'vostt',
  preset: '../../jest.config.js',
  coverageDirectory: '../../coverage/apps/vostt',
  snapshotSerializers: [
    'jest-preset-angular/AngularSnapshotSerializer.js',
    'jest-preset-angular/HTMLCommentSerializer.js'
  ]
};
