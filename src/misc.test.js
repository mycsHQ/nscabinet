const path = require('path');
const fs = require('fs');
const misc = require('./misc');

const { existsSync, mkdirSync } = fs;

afterAll(() => {
  fs.existsSync = existsSync;
  fs.mkdirSync = mkdirSync;
});

describe('misc.js', () => {
  describe('checkParams', () => {
    it('should throw error if not all required params are set', () => {
      expect(() => misc.checkParams()).toThrowError(/Following params are missing: /);
    });

    it('should accumulate params', () => {
      const res = misc.checkParams({ account: 'account', realm: 'realm', email: 'email', password: 'password' });
      expect(res).toEqual({
        account: 'account',
        email: 'email',
        password: 'password',
        rootPath: '/SuiteScripts',
        script: 'customscript_nscabinet_restlet',
        deployment: 1,
        role: 3,
        realm: 'realm'
      });
    });

    it('should overwrite args with environment variables', () => {
      process.env.NSCONF_ACCOUNT = 'env-account';
      process.env.NSCONF_PASSWORD = 'env-password';
      const res = misc.checkParams({ account: 'account', realm: 'realm', email: 'email', password: 'password' });
      expect(res).toEqual({
        account: process.env.NSCONF_ACCOUNT,
        email: 'email',
        password: process.env.NSCONF_PASSWORD,
        rootPath: '/SuiteScripts',
        script: 'customscript_nscabinet_restlet',
        deployment: 1,
        role: 3,
        realm: 'realm'
      });
    });
  });
  describe('normalizePath', () => {
    it('should normalize', () => {
      const res = misc.normalizePath('/foo/bar/');
      expect(res).toEqual([ 'foo', 'bar' ]);
    });
    it('should normalize and remove duplicates', () => {
      const res = misc.normalizePath('foo///bar/////');
      expect(res).toEqual([ 'foo', 'bar' ]);
    });
  });
  describe('getSdfOptions', () => {
    const sdfOptions = { options: { account: 'account', email: 'email', role: 'role', url: 'system.realm' }, password: 'password' };
    it('should get the sdf options and normalize the realm', () => {
      const res = misc.getSdfOptions({ role: 'role', realm: 'realm', account: 'account', email: 'email', password: 'password' });
      expect(res).toEqual(sdfOptions);
    });
    it('should get the sdf options', () => {
      const res = misc.getSdfOptions({ role: 'role', realm: 'system.realm', account: 'account', email: 'email', password: 'password' });
      expect(res).toEqual(sdfOptions);
    });
  });

  describe('getRestletOptions', () => {
    const restletOptions = {
      headers: { authorization: 'NLAuth nlauth_account=account,nlauth_email=email,nlauth_signature=password,nlauth_role=role' },
      method: 'POST',
      // qs: { deploy: undefined, script: undefined },
      url: 'https://rest.realm/app/site/hosting/restlet.nl'
    };
    it('should get the restlet options and normalize the realm', () => {
      const res = misc.getRestletOptions({ role: 'role', realm: 'realm', account: 'account', email: 'email', password: 'password' });
      expect(res).toEqual(restletOptions);
    });
    it('should get the restlet options', () => {
      const res = misc.getRestletOptions({ role: 'role', realm: 'system.realm', account: 'account', email: 'email', password: 'password' });
      expect(res).toEqual(restletOptions);
    });
    it('should get the restlet options without a role', () => {
      const res = misc.getRestletOptions({
        realm: 'system.realm',
        account: 'account',
        email: 'email',
        password: 'password',
        deployment: 'deployment',
        script: 'script'
      });
      expect(res).toEqual({
        headers: { authorization: 'NLAuth nlauth_account=account,nlauth_email=email,nlauth_signature=password' },
        method: 'POST',
        qs: { deploy: 'deployment', script: 'script' },
        url: 'https://rest.realm/app/site/hosting/restlet.nl'
      });
    });
  });
  describe('required', () => {
    it('should throw an error', () => {
      expect(() => misc.required('param')).toThrowError('Parameter "param" is required!');
    });
  });
  describe('checkPath', () => {
    it('should check the path for leading string', () => {
      const res = misc.checkPath('/foo/bar', '/');
      expect(res).toBe('/foo/bar');
    });
    it('should check the path for leading path separator', () => {
      const res = misc.checkPath(`${ path.sep }param`);
      expect(res).toBe(`${ path.sep }param`);
    });
    it('should check the path for leading string and throw error', () => {
      expect(() => misc.checkPath('param', '/')).toThrowError('Path has to start with "/" and is "param"');
    });
  });
  describe('mkdirRecursive', () => {
    it('should mkdir -p', () => {
      fs.existsSync = jest.fn().mockReturnValue(false);
      fs.mkdirSync = jest.fn();
      misc.mkdirRecursive(`${ path.sep }foo${ path.sep }bar`);
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.sep);
      expect(fs.mkdirSync).toHaveBeenLastCalledWith(`${ path.sep }foo${ path.sep }bar${ path.sep }`);
      expect(fs.mkdirSync).toHaveBeenCalledTimes(3);
    });
    it('should mkdir -p and skip existint directories', () => {
      fs.existsSync = jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      fs.mkdirSync = jest.fn();
      misc.mkdirRecursive(`${ path.sep }foo${ path.sep }bar`);
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.sep);
      expect(fs.mkdirSync).toHaveBeenLastCalledWith(`${ path.sep }foo${ path.sep }bar${ path.sep }`);
      expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
    });
  });
});
