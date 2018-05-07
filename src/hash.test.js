const hash = require('./hash');

describe('hash.js', () => {
  describe('getHash', () => {
    it('should get a hash', () => {
      const res = hash.getHash('foobar');
      expect(typeof res).toBe('string');
    });
  });
  describe('getStoredHash', () => {
    it('should get a stored hash', () => {
      const res = hash.getStoredHash('/foo/bar', [
        {
          filePath: '/foo/bar',
          fileHash: 'hashy'
        }
      ]);
      expect(res).toBe('hashy');
    });
    it('should return null', () => {
      const res = hash.getStoredHash('/foo/bar', [
        {
          filePath: '/bar/foo',
          fileHash: 'hashy'
        }
      ]);
      expect(res).toBe(null);
    });
    it('should return null', () => {
      const res = hash.getStoredHash('/foo/bar', [
        {
          filePath: '/bar/foo',
          fileHash: 'smashy'
        },
        {
          filePath: '/foo/bar',
          fileHash: 'hashy'
        }
      ]);
      expect(res).toBe('hashy');
    });
  });
});
