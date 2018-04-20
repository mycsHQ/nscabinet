const path = require('path');
const fs = require('fs');
const { neededParams } = require('../config');

/**
 * Normalize (remove duplicate, leading and trailing separators from path and split into array
 * @param {string} p
 * @return {array<string>}
 */
const normalizePath = p =>
  path
    .normalize(p)
    .split(path.sep)
    .filter(x => x);

/**
 * Make path in a recursive manner, creating all directories along the path
 * @param {string} pathToCreate
 */
const mkdirRecursive = pathToCreate => {
  // Path separators could change depending on the platform
  pathToCreate.split(path.sep).reduce((currentPath, folder) => {
    currentPath += folder + path.sep;
    if (!fs.existsSync(currentPath)) fs.mkdirSync(currentPath);
    return currentPath;
  }, '');
};

/**
 * Split array into n chunks
 * @param {array} arr array to split
 * @param {number} [chunkSize=5] size of chunks
 * @return {array}
 */
const splitInChunks = (arr, chunkSize = 5) => {
  const copiedArray = [ ...arr ];
  return new Array(Math.ceil(copiedArray.length / chunkSize)).fill().map(() => copiedArray.splice(0, chunkSize));
};

/**
 * Get email and password params from environment variables
 * ugly workaround for passwords and emails with special characters not parsed correctly
 *
 * @param {string} [nsScriptsPath] path to upload directory
 * @return {object}
 */
const getParams = nsScriptsPath => {
  const rootPath = process.env.NSCONF_ROOTPATH ? `/SuiteScripts/${ process.env.NSCONF_ROOTPATH }` : '/SuiteScripts';
  const trimPath = nsScriptsPath;
  const password = process.env.NSCONF_PASSWORD;
  const email = process.env.NSCONF_EMAIL;
  const account = process.env.NSCONF_ACCOUNT;
  const script = process.env.NSCONF_SCRIPT;

  // variables have to be deleted due to "invalid character" errors
  delete process.env.NSCONF_PASSWORD;
  delete process.env.NSCONF_EMAIL;
  delete process.env.NSCONF_ACCOUNT;
  delete process.env.NSCONF_SCRIPTS;
  const params = { rootPath };
  if (password) {
    params.password = password;
  }
  if (email) {
    params.email = email;
  }
  if (trimPath) {
    params.trimPath = trimPath;
  }
  if (account) {
    params.account = account;
  }
  if (script) {
    params.script = script;
  }
  return params;
};

const getSdfOptions = ({ role, realm, account, email, password }) => {
  const options = { role, url: realm.startsWith('system.') ? realm : `system.${ realm }`, email, account };
  return { options, password };
};

const getRestletOptions = ({ role, realm, script, deployment, account, email, password }) => {
  const nlauthRolePortion = role ? `,nlauth_role=${ role }` : '';
  const url = `https://rest.${ realm.replace('system.', '') }/app/site/hosting/restlet.nl`;

  return {
    url,
    qs: {
      script,
      deploy: deployment
    },
    method: 'POST',
    headers: {
      authorization: `NLAuth nlauth_account=${ account },nlauth_email=${ email },nlauth_signature=${ password }${ nlauthRolePortion }`
    }
  };
};

/**
 * Check if all needed params exist
 * @param {object} params
 * @returns {object}
 */
const checkParams = params => {
  const neededSet = new Set(Object.values(neededParams));
  const paramSet = new Set(Object.keys(params));
  const difference = new Set([ ...neededSet ].filter(x => !paramSet.has(x)));
  if (difference.length > 0) throw new Error(`Following params are missing: "${ difference }"`);
  return params;
};

/**
 * Throw error
 * @param {string} p
 * @throws {error} Parameter "*" is required!
 */
const required = p => {
  throw new Error(`Parameter "${ p }" is required!`);
};

/**
 * Check a path if it starts with a specific leading string
 * @param {string} p the path to check
 * @param {string} [leadingString='/']
 * @returns {string}
 */
const checkPath = (p, leadingString = '/') => {
  if (!p.startsWith(leadingString)) {
    throw new Error(`Path has to start with "${ leadingString }" and is "${ p }"`);
  }
  return p;
};

/**
 * Copy the file and create directory structure
 * @param {string} sourceFile
 * @param {string} destFile
 */
const cp = (sourceFile, destFile) => {
  const fileName = path.basename(destFile);
  // create needed directory structure
  mkdirRecursive(destFile.replace(fileName, ''));
  // copy over files
  fs.createReadStream(sourceFile).pipe(fs.createWriteStream(destFile));
};

module.exports = {
  getParams,
  splitInChunks,
  getSdfOptions,
  getRestletOptions,
  checkParams,
  required,
  mkdirRecursive,
  normalizePath,
  checkPath,
  cp
};
