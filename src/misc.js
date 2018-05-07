const path = require('path');
const fs = require('fs');
const { neededParams } = require('../config');
const dotEnv = require('dotenv');

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

/**
 * Check a path if it starts with a specific leading string
 * @param {string} p the path to check
 * @param {string} [leadingString=path.sep]
 * @throws {error} Path has to start with "leadingString" and is "param"
 * @returns {string}
 */
const checkPath = (p, leadingString = path.sep) => {
  if (p.startsWith(leadingString)) return p;
  throw new Error(`Path has to start with "${ leadingString }" and is "${ p }"`);
};

const getSdfOptions = ({ role, realm, account, email, password }) => {
  const options = { role, url: realm.startsWith('system.') ? realm : `system.${ realm }`, email, account };
  return { options, password };
};

const getRestletOptions = ({ role, realm, account, email, password, script, deployment: deploy }) => {
  const nlauthRolePortion = role ? `,nlauth_role=${ role }` : '';
  const url = `https://rest.${ realm.replace('system.', '') }/app/site/hosting/restlet.nl`;
  const authorization = `NLAuth nlauth_account=${ account },nlauth_email=${ email },nlauth_signature=${ password }${ nlauthRolePortion }`;

  let options = {
    url,
    method: 'POST',
    headers: { authorization }
  };
  if (script || deploy) {
    options = {
      ...options,
      qs: {
        ...(script ? { script } : {}),
        ...(deploy ? { deploy } : {})
      }
    };
  }
  return options;
};

/**
 * Check if all needed params exist and accumulate env variables
 * @param {object} [argParams = {}]
 * @throws {error} Following params are missing: "param"
 * @returns {object}
 */
const checkParams = (argParams = {}) => {
  // get environment variables from .env file
  dotEnv.config();

  const {
    NSCONF_ACCOUNT: account = argParams.account,
    NSCONF_EMAIL: email = argParams.email,
    NSCONF_PASSWORD: password = argParams.password,
    NSCONF_REALM: realm = argParams.realm,
    NSCONF_ROOTPATH: rootPath = argParams.rootPath || '/SuiteScripts',
    NSCONF_SCRIPT: script = argParams.script || 'customscript_nscabinet_restlet',
    NSCONF_DEPLOYMENT: deployment = argParams.deployment || 1,
    NSCONF_ROLE: role = argParams.role || 3
  } = process.env;

  const params = {
    account,
    email,
    password,
    rootPath,
    script,
    deployment,
    role,
    realm
  };

  const neededSet = new Set(Object.values(neededParams));
  const paramSet = new Set(Object.entries(params).reduce((red, [ key, value ]) => (value ? [ ...red, key ] : red), []));
  const difference = [ ...new Set([ ...neededSet ].filter(x => !paramSet.has(x))) ];
  if (difference.length) throw new Error(`Following params are missing: "${ difference.join('", "') }"`);
  console.log('Used params:');
  console.dir(params, { depth: null, colors: true });
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

module.exports = {
  getSdfOptions,
  getRestletOptions,
  checkParams,
  required,
  mkdirRecursive,
  normalizePath,
  checkPath,
  cp
};
