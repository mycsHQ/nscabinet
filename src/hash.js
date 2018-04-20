const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * get the hash of a string
 *
 * @param {String} str string to createHash of
 * @param {String} [algorithm='md5'] algorithm to use
 * @param {String} [encoding='hex'] encoding of the output
 * @return {String} Hash of the string
 */
const getHash = (str, algorithm = 'md5', encoding = 'hex') =>
  crypto
    .createHash(algorithm)
    .update(str, 'utf8')
    .digest(encoding);

/**
 * check hashfile if the filename was stored before
 *
 * @param {String} filePathCheck the path to the file to check
 * @param {Array} hashFiles
 * @return {string} hash of file or null if not found
 */
const getStoredHash = (filePathCheck, hashFiles) => hashFiles.filter(({ filePath }) => filePath === filePathCheck).map(({ fileHash }) => fileHash)[0] || null;

/**
 * check if the filehash and the stored hash is equal
 *
 * @param {String} filePath the path to the file to check
 * @param {Array} hashFiles
 * @return {boolean} if hashes are equal
 */
const isFileModified = (filePath, hashFiles) => getHash(fs.readFileSync(filePath).toString()) !== getStoredHash(filePath, hashFiles);

/**
 * get all files from directory in sync call
 *
 * @param {string} dir directory path
 * @param {boolean} getChecksum
 * @param {boolean} excludeDotFiles
 * @param {array<object>} [fileList=[]] Array with filelist
 * @return {array<object>} Array of Objects with file & filepath
 */
const getAllFilesSync = (dir, getChecksum, prefix = '/SuiteScripts', excludeDotFiles = true, fileList = [], rootDir = null) => {
  fs.readdirSync(dir).forEach(file => {
    if (excludeDotFiles && file.startsWith('.')) return;
    const filePath = path.join(dir, file);
    const remotePath = filePath.replace(rootDir || dir, '');
    fileList = fs.statSync(filePath).isDirectory()
      ? getAllFilesSync(filePath, getChecksum, prefix, excludeDotFiles, fileList, rootDir || dir)
      : fileList.concat([
        {
          file,
          filePath,
          remoteFilePath: file.startsWith(remotePath) ? remotePath : `${ prefix }${ remotePath }`,
          fileHash: getChecksum ? getHash(fs.readFileSync(filePath).toString()) : undefined
        }
      ]);
  });
  return fileList;
};

module.exports = {
  getHash,
  isFileModified,
  getAllFilesSync
};
