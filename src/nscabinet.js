const { checkParams, getRestletOptions, getSdfOptions, required, normalizePath, checkPath, cp, mkdirRecursive } = require('./misc');
const { getAllFilesSync, isFileModified } = require('./hash');
const rp = require('request-promise-native');
const { sdf, cliCommands: cmd, sdfCreateAccountCustomisationProject } = require('node-sdf');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const suiteScriptsRoot = '/SuiteScripts';

class NsCabinet {
  /**
   * Create NsCabinet instance with credentials
   * @param {object} params
   * @return {NsCabinet}
   */
  constructor(params = required('params')) {
    const checkedParams = checkParams(params);
    this._restletOptions = getRestletOptions(checkedParams);
    this._sdfOptions = getSdfOptions(checkedParams);
  }

  /**
   * Upload the restlet and do deployment
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {promise}
   */
  async uploadRestlet(sdfOptions = this.sdfOptions) {
    return this.deployProject('compiled-restlet', sdfOptions);
  }

  /**
   * Deploy the project to netsuite
   * @param {string} project paths to the project has to be absolute
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {promise}
   */
  async deployProject(project = required('project'), { password, options } = this.sdfOptions) {
    return sdf(cmd.deploy, password, { ...options, p: checkPath(project), np: '' });
  }

  /**
   * Upload files to SuiteScripts directory, retaining the directory structure of the files
   * (paths to the files have to be absolute)
   * !This overwrites existing files in the file cabinet
   * @param {string} rootPath rootpath to the file that is _not_ mirrored in FileCabinet
   * @param {array<string>} files paths to the files have to be absolute
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {promise}
   */
  async uploadFiles(rootPath = required('rootPath'), files = required('files'), sdfOptions = this.sdfOptions) {
    const { newProjectPath, fileBasePath } = await sdfCreateAccountCustomisationProject('temp-upload', __dirname);

    const copiedFiles = files.map(file => {
      const fileName = path.basename(checkPath(file));
      const normalizedRootpath = normalizePath(checkPath(rootPath));
      const normalizedFilePath = normalizePath(file.replace(fileName, '').replace(normalizedRootpath.join('/'), ''));
      const normalizedFileBasePath = normalizePath(fileBasePath);
      const normalizedNewFilePath = [
        ...normalizedFileBasePath,
        ...normalizedFilePath
          .join(path.sep)
          .replace(normalizedFileBasePath.join(path.sep), '')
          .split(path.sep)
      ];

      const sourceFile = path.resolve(path.sep, ...normalizedRootpath, ...normalizedFilePath, fileName);
      const destFile = path.resolve(path.sep, ...normalizedNewFilePath, fileName);
      cp(sourceFile, destFile);
      return destFile;
    });
    await this.deployProject(newProjectPath, sdfOptions);
    rimraf.sync(newProjectPath);
    console.log(`Uploaded ${ files.length } files`);
    return copiedFiles.map(file => file.replace(fileBasePath, suiteScriptsRoot));
  }

  /**
   * List the files of a specific directory
   * @param {string} folder path to the source folder has to be absolute
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {array<string>}
   */
  async listFiles(folder = required('folder'), { password, options } = this.sdfOptions) {
    const fileList = await sdf(cmd.listfiles, password, { ...options, folder: checkPath(folder, suiteScriptsRoot) });
    const files = fileList.match(new RegExp(`${ folder }\/.*`, 'g'));
    return files;
  }

  async updateFileCabinet(sourceFolder = required('sourceFolder'), withHash = true, sdfOptions = this.sdfOptions) {
    const filesInDir = getAllFilesSync(sourceFolder, true);
    const hashes = await this.getHash(sdfOptions);

    // check for modified files (by file hash)
    const filesToUpload = filesInDir.filter(({ filePath }) => filePath && isFileModified(filePath, hashes));

    let excludeFromHash = [];
    // check if there are less files in repo than before
    if (withHash && hashes.length > filesInDir.length) {
      const files = filesInDir.map(({ filePath }) => filePath);
      const inters = hashes.filter(({ filePath }) => !files.includes(filePath));
      console.log(`>>>>>>> ${ inters.length } file${ inters.length > 1 ? 's' : '' } marked for removal`);
      const { gotDeleted, withError } = await this.deleteFiles(inters.map(({ remoteFilePath }) => remoteFilePath));
      const successful = gotDeleted.length;
      console.log(`>>>>>>> Successfully Deleted ${ successful } file${ successful > 1 ? 's' : '' }`);
      const failed = withError.length;
      console.log(`>>>>>>> Failed deleting ${ failed } file${ failed > 1 ? 's' : '' }`);

      excludeFromHash = withError.map(({ remoteFilePath }) => remoteFilePath);
    }

    if (filesToUpload.length > 0) {
      await this.uploadFiles(sourceFolder, filesToUpload, sdfOptions);
      console.log('>>>>>>> Nothing to upload');
      return;
    }

    await this.updateHashFile(sourceFolder, true, excludeFromHash, sdfOptions);
  }

  /**
   * Import the files specified in the paths array to the specified project
   * @param {array<string>} paths paths to the files have to be absolute
   * @param {string} project path to the destination project has to be absolute
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {promise}
   */
  async importFiles(paths = required('paths'), project = required('project'), { password, options } = this.sdfOptions) {
    const pathString = `${ paths.reduce((red, path) => `${ red }\"${ checkPath(path) }\" `, '') }`;
    return sdf(cmd.importfiles, password, { ...options, paths: pathString, p: project });
  }

  /**
   * Download the files specified in the paths array to the specified directory
   * @param {array<string>} paths paths to the files have to be absolute
   * @param {string} directory path to the destination directory has to be absolute
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {promise}
   */
  async downloadFiles(paths = required('paths'), directory = required('directory'), { password, options } = this.sdfOptions) {
    const { newProjectPath, fileBasePath } = await sdfCreateAccountCustomisationProject('temp-upload', __dirname);
    const pathString = `${ paths.reduce((red, path) => `${ red }\"${ checkPath(path) }\" `, '') }`;
    await sdf(cmd.importfiles, password, { ...options, paths: pathString, p: newProjectPath });
    const res = paths.map(p => {
      const relPath = p.replace(suiteScriptsRoot, '');
      const sourceFile = path.join(fileBasePath, relPath);
      const destFile = path.join(directory, relPath);
      cp(sourceFile, destFile);
      return destFile;
    });
    rimraf.sync(newProjectPath);
    return res;
  }

  /**
   * Import all files from a folder to the specified project
   * @param {string} folder path to the source folder has to be absolute
   * @param {string} directory path to the destination directory has to be absolute
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {promise}
   */
  async importAllFiles(folder = required('folder'), project = required('project'), sdfOptions = this.sdfOptions) {
    const files = await this.listFiles(folder);
    return this.importFiles(files, project, sdfOptions);
  }

  /**
   * Download all files from a folder to the specified directory
   * @param {string} folder path to the source folder has to be absolute
   * @param {string} directory path to the destination directory has to be absolute
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {promise}
   */
  async downloadAllFiles(folder = required('folder'), directory = required('directory'), sdfOptions = this.sdfOptions) {
    const files = await this.listFiles(folder);
    return this.downloadFiles(files, directory, sdfOptions);
  }

  /**
   * create and upload the hashes to ns filecabinet
   *
   * @param {string} sourceDir the path to the files - has to be absolute
   * @param {boolean} [excludeDotFiles=true] exclude dotfiles from hash
   * @param {array} [failedFiles=[]] exclude the failed files from hash
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {promise}
   */
  async updateHashFile(sourceDir, excludeDotFiles = true, failedFiles = [], sdfOptions = this.sdfOptions) {
    const files = getAllFilesSync(checkPath(sourceDir), true, suiteScriptsRoot, excludeDotFiles).filter(
      ({ remoteFilePath }) => !failedFiles.includes(remoteFilePath)
    );
    const dir = `${ __dirname }/nscabinet`;
    const hashFile = `${ dir }/hashes.json`;

    // create needed directory structure
    mkdirRecursive(dir);
    fs.writeFileSync(hashFile, JSON.stringify(files));

    const res = await this.uploadFiles(__dirname, [ hashFile ], sdfOptions);
    console.log(`Updated hashFile ${ res[0] }`);
    rimraf.sync(dir);
    return files;
  }

  /**
   * Get the hash files content
   * @param {object} [sdfOptions=this.sdfOptions]
   * @return {array<object>}
   */
  async getHash({ password, options } = this.sdfOptions) {
    const p = 'compiled-restlet';
    const paths = '/SuiteScripts/nscabinet/hashes.json';
    try {
      await sdf(cmd.importfiles, password, { ...options, paths, p });
      const content = JSON.parse(fs.readFileSync('compiled-restlet/FileCabinet/SuiteScripts/nscabinet/hashes.json').toString());
      return content;
    } catch (error) {
      console.log(error.message);
      return [];
    }
  }

  /**
   * Delete files from the FileCabinet
   * @param {array<string>} files paths to the files have to be absolute
   * @param {object} [restletOptions=this.restletOptions]
   * @return {promise}
   */
  async deleteFiles(files = required('files'), restletOptions = this.restletOptions) {
    const action = 'deleteFiles';
    const json = {
      action,
      files
    };
    return { action, files: files.map(file => checkPath(file, suiteScriptsRoot)), ...(await rp({ ...restletOptions, json })) };
  }

  /**
   * Get the options used for the restlet
   */
  get restletOptions() {
    return this._restletOptions;
  }

  /**
   * Get the options used for the sdf cli
   */
  get sdfOptions() {
    return this._sdfOptions;
  }
}

module.exports = NsCabinet;
