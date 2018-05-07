/* exported post */

/**
 * Use for post function in script deployment
 * @param {object} request
 * @return {object}
 */
/* eslint-disable-next-line no-unused-vars */
const post = ({ action, ...data }) => {
  // ROUTER
  try {
    switch (action) {
        case 'deleteFiles':
          return deleteFiles(data.files);
        default:
          throw new Error(`Invalid action "${ action }"`);
    }
  } catch (err) {
    nlapiLogExecution('ERROR', err.message, JSON.stringify(err));
    return {
      error: {
        code: 500,
        message: `Error processing "${ action }", ${ err.message }`,
        datain: data
      }
    };
  }
};

/**
 * Find the id of an file by path
 * @param {string} path
 * @throws {error} Path "path" is not a file
 * @return {object}
 */
const findIdByName = function (path) {
  const filename = path.replace(/^.*[\\\/]/, '');
  const folder = path.replace(filename, '');
  if (!filename.includes('.')) throw new Error(`Path "${ path }" is not a file`);

  const filter = [ [ 'folder', 'anyof', [ folder ] ], 'and', [ 'name', 'is', filename ] ];

  const columns = [ 'name', 'filetype', 'folder' ].map(column => {
    return new nlobjSearchColumn(column);
  });

  const foundFiles = nlapiSearchRecord('file', null, filter, columns) || [];

  // double check
  const foundItem = foundFiles.filter(resFile => resFile.getValue('name') === filename)[0] || {};
  return { id: foundItem.id, filename, folder };
};

/**
 * Delete the files specified as path strings in an array
 * @param {array|object} files
 */
const deleteFiles = function (files) {
  const fileArray = files instanceof Array ? files : [ files ];

  const { del, err } = fileArray.reduce(
    (red, remoteFilePath) => {
      const { id, filename, folder } = findIdByName(remoteFilePath);
      const res = { id, filename, folder, remoteFilePath, code: '200', message: 'DELETED' };

      if (id) return { ...red, del: [ ...red.del, res ] };
      return { ...red, err: [ ...red.err, { ...res, code: '404', message: 'NOT_FOUND' } ] };
    },
    { del: [], err: [] }
  );

  const res = del.reduce(
    (red, item) => {
      try {
        nlapiDeleteFile(item.id);
        return { ...red, gotDeleted: [ ...red.gotDeleted, item ] };
      } catch (error) {
        nlapiLogExecution('DEBUG', '"deleteFiles" error', JSON.stringify(error));
        return { ...red, withError: [ ...red.withError, { ...item, code: '500', message: error.message } ] };
      }
    },
    {
      gotDeleted: [],
      withError: err
    }
  );
  nlapiLogExecution('DEBUG', '"deleteFiles" result', JSON.stringify(res));
  return res;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    post,
    findIdByName,
    deleteFiles
  };
}
