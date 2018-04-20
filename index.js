const NsCabinet = require('./src/nscabinet');

const temp = async () => {
  const nsCabinet = new NsCabinet({
    realm: 'na2.netsuite.com',
    account: '1746425',
    role: 3,
    rootPath: '/SuiteScripts',
    deployment: 1,
    script: 'customscript_nscabinet_restlet',
    email: 'devs@mycs.com',
    password: 'Mycs_2018?'
  });

  // return nsCabinet.uploadRestlet();
  // return nsCabinet.uploadFiles('/Users/jroehl/dev/mycs', [ '/nscabinet/LICENSE' ]);
  // await nsCabinet.downloadAllFiles('/SuiteScripts', '/Users/jroehl/Dropbox/Desktop/foobar');
  return nsCabinet.updateHashFile(`${ __dirname }/nscabinet`);
  // return nsCabinet.getHash();
};

temp()
  .then(console.log)
  .catch(console.error);

module.exports = require('./src/nscabinet');
