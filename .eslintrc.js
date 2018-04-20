module.exports = {
  extends: 'mycs',
  rules: {
    'require-jsdoc': 'warn',
    'class-methods-use-this': 'warn'
  },
  globals: {
    nlapiLogExecution: true,
    nlobjSearchColumn: true,
    nlapiSearchRecord: true,
    nlapiDeleteFile: true
  }
};
