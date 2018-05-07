const restlet = require('../nscabinet/FileCabinet/SuiteScripts/nscabinet/nscabinet-restlet');

const nlapiSearchRecordResult = { id: 'id', getValue: id => `${ id }.txt` };

beforeEach(() => {
  global.nlapiDeleteFile = jest.fn();
  global.nlapiLogExecution = jest.fn();
  global.nlapiSearchRecord = jest.fn().mockReturnValue([ nlapiSearchRecordResult ]);
  global.nlobjSearchColumn = jest.fn().mockImplementation(col => col);
  global.nlapiDeleteFile = jest.fn();
});

describe('nscabinet-restlet.js', () => {
  describe('post', () => {
    it('should route the request', () => {
      const res = restlet.post({ action: 'deleteFiles', files: [] });
      expect(res).toEqual({ gotDeleted: [], withError: [] });
    });
    it('should return error object', () => {
      const res = restlet.post({ action: 'deleteFiles' });
      expect(res).toEqual({ error: { code: 500, datain: {}, message: 'Error processing "deleteFiles", Cannot read property \'replace\' of undefined' } });
    });
    it('should return error object if method not correct', () => {
      const res = restlet.post({ action: 'fooBar' });
      expect(res).toEqual({ error: { code: 500, datain: {}, message: 'Error processing "fooBar", Invalid action "fooBar"' } });
    });
  });

  describe('findIdByName', () => {
    it('should find the id', () => {
      const res = restlet.findIdByName('foo/bar/name.txt');
      expect(res).toEqual({ filename: 'name.txt', folder: 'foo/bar/', id: 'id' });
    });
    it('should return no id if not found', () => {
      const res = restlet.findIdByName('foo/bar/foobar.txt');
      expect(res).toEqual({ filename: 'foobar.txt', folder: 'foo/bar/', id: undefined });
    });

    it('should throw error if not a file', () => {
      expect(() => restlet.findIdByName('foo/bar/foobar')).toThrowError('Path "foo/bar/foobar" is not a file');
    });
  });

  describe('deleteFiles', () => {
    it('should delete the file', () => {
      const res = restlet.deleteFiles('foo/bar/name.txt');
      expect(res).toEqual({
        gotDeleted: [
          {
            code: '200',
            filename: 'name.txt',
            folder: 'foo/bar/',
            id: 'id',
            message: 'DELETED',
            remoteFilePath: 'foo/bar/name.txt'
          }
        ],
        withError: []
      });
      expect(global.nlapiDeleteFile).toHaveBeenCalledWith('id');
    });

    it('should not find the file', () => {
      const res = restlet.deleteFiles('foo/bar/foobar.txt');
      expect(res).toEqual({
        gotDeleted: [],
        withError: [
          {
            code: '404',
            filename: 'foobar.txt',
            folder: 'foo/bar/',
            id: undefined,
            message: 'NOT_FOUND',
            remoteFilePath: 'foo/bar/foobar.txt'
          }
        ]
      });
      expect(global.nlapiDeleteFile).not.toHaveBeenCalled();
    });

    it('should return the ns deleteFiles error', () => {
      global.nlapiDeleteFile.mockImplementation(() => {
        throw new Error('NS_API error');
      });
      const res = restlet.deleteFiles([ 'foo/bar/name.txt' ]);
      expect(res).toEqual({
        gotDeleted: [],
        withError: [
          {
            code: '500',
            filename: 'name.txt',
            folder: 'foo/bar/',
            id: 'id',
            message: 'NS_API error',
            remoteFilePath: 'foo/bar/name.txt'
          }
        ]
      });
      expect(global.nlapiDeleteFile).toHaveBeenCalled();
    });

    it('should return the results', () => {
      const res = restlet.deleteFiles([ 'foo/bar/foobar.txt', 'foo/bar/name.txt' ]);
      expect(res.gotDeleted.length).toBe(1);
      expect(res.withError.length).toBe(1);
      expect(global.nlapiDeleteFile).toHaveBeenCalledTimes(1);
    });
  });
});
