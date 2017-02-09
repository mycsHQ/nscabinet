/* eslint-env es6,node */

'use strict';

var request = require('request'),
    through = require('through2'),
    vinyl = require('vinyl'),
    nsconfig = require('nsconfig'),
    path = require('path');

var PARAMS_DEF = [{
        name: 'rootPath',
        def: '/SuiteScripts'
    },
    {
        name: 'script',
        required: true
    },
    {
        name: 'deployment',
        def: 1
    },
    {
        name: 'isCLI',
        def: false
    },
    {
        name: 'isonline',
        def: false
    },
    {
        name: 'flatten',
        def: false
    }
];


module.exports = upload;
module.exports.upload = upload;

function upload(params) {
    params = checkParams(params);

    return through.obj(function (chunk, enc, callback) {
        if (chunk.isDirectory()) {
            this.push(chunk);
            return callback();
        }

        var that = this,
            fullCwd = path.resolve((params.isCLI && !params.flatten) ? nsconfig.CONF_CWD : chunk.cwd),
            remotePath = chunk.path.substr(fullCwd.length + 1);

        if (params.flatten) {
            remotePath = path.basename(remotePath);
        }

        console.log('Uploading ' + remotePath + ' to ' + params.rootPath);

        var toRequest = requestOpts(params);
        toRequest.json = {
            action: 'upload',
            filepath: remotePath,
            content: chunk.contents.toString('base64'),
            rootpath: params.rootPath,
            isonline: params.isonline
        };

        request(toRequest).on('response', response => {
            chunk.nscabinetResponse = response;
            that.push(chunk);
            var logger = _responseLogger();
            response.pipe(logger).on('finish', () => {
                that.emit('finish', response);
                callback();
            });
        });
    });
}


module.exports.download = download;

function download(files, params, info) {
    params = checkParams(params);
    var toRequest = requestOpts(params);
    toRequest.json = {
        action: 'download',
        files: files,
        rootpath: params.rootPath
    };
    var buffer = '';
    var emitter = through.obj(
        function transform(data, enc, cb) {
            buffer += data;
            cb();
        },
        function flush(cb) {
            var data = JSON.parse(buffer);
            if (data.error) {
                if (!data.error.length) data.error = [data.error];
                data.error = data.error.map(err => {
                    try {
                        return JSON.parse(err);
                    } catch (e) {
                        //keep as it came
                        return err;
                    }
                });
                data.error.forEach(e => console.error('RESTLET ERROR: ' + (e.details || e.message || e)));
                info = info || {};
                info.errors = info.errors || [];
                info.errors = info.errors.concat(data.error);
                this.emit('error', data.errors);
            }
            data.files = data.files || [];
            data.files.forEach(file => {
                var localPath = file.path.startsWith('/') ? 'cabinet_root' + file.path : file.path;
                var vynFile = new vinyl({
                    path: localPath,
                    contents: new Buffer(file.contents, 'base64')
                });
                console.log(`Got file ${file.path}.`);
                this.push(vynFile);
            });
            cb();
        }
    );
    return request(toRequest).pipe(emitter);
}

module.exports.deleteFiles = deleteFiles;

function deleteFiles(files, params, info) {
    params = checkParams(params);
    var toRequest = requestOpts(params);
    toRequest.json = {
        action: 'deleteFiles',
        files: files,
        rootpath: params.rootPath
    };
    var buffer = '';
    var emitter = through.obj(
        function transform(data, enc, cb) {
            buffer += data;
            cb();
        },
        function flush(cb) {
            var data = JSON.parse(buffer);

            if (data.error) {
                if (!data.error.length) data.error = [data.error];
                data.error = data.error.map(err => {
                    try {
                        return JSON.parse(err);
                    } catch (e) {
                        //keep as it came
                        return err;
                    }
                });
                data.error.forEach(e => console.error('RESTLET ERROR: ' + (e.details || e.message || e)));
                info = info || {};
                info.errors = info.errors || [];
                info.errors = info.errors.concat(data.error);
                this.emit('error', data.errors);
            }
            data.deletedFiles = data.deletedFiles || [];
            if (data.deletedFiles.length === 0) {
                console.log(`"${files}" not found - nothing removed.`);
            }
            data.deletedFiles.forEach(file => {
                console.log(`Deleted file ${file.columns.name}, id: ${file.id}.`);
            });
            this.emit('response', data.deletedFiles.length === 0 ? null : data.deletedFiles)
            cb();
        }
    );
    return request(toRequest).pipe(emitter);
}

/* STUB */
/*
module.exports.deleteFolder = deleteFolder;
function deleteFolder (folders, params) {
    params = checkParams(params);
    if (!Array.isArray(folders)) folders = [folders];
    var toRequest = _requestOpts(params);
    toRequest.json = {
        action : 'deleteFolder' ,
        rootpath : params.rootPath ,
        folders : folders
    };
}
*/


module.exports.checkParams = checkParams;

function checkParams(override, noThrow) {
    var out = nsconfig(override, PARAMS_DEF, noThrow);
    if (!out.rootPath.startsWith('/')) throw Error('rootPath must begin with /');
    return out;
}

/**
 * this function does not work with streams/gulp,
 * instead it simply gets string and returns promise.
 */
module.exports.url = url;

function url(path, params) {
    params = checkParams(params);
    var toRequest = requestOpts(params);
    toRequest.json = {
        action: 'url',
        path: params.rootPath.substr(1) + '/' + path
    };
    return new Promise((resolve, reject) => {
        request(toRequest, (err, resp, body) => {
            if (err) return reject(err);
            resolve(`https://system.${params.realm}${body.url}`);
        });
    });
}

module.exports.requestOpts = requestOpts;

function requestOpts(params) {
    var nlauthRolePortion = (params.role) ? `,nlauth_role=${params.role}` : '',
        server = process.env.NS_SERVER || `https://rest.${params.realm}/app/site/hosting/restlet.nl`;
    //NS_SERVER = testing + nsmockup

    return {
        url: server,
        qs: {
            script: params.script,
            deploy: params.deployment
        },
        method: 'POST',
        headers: {
            authorization: `NLAuth nlauth_account=${params.account},nlauth_email=${params.email},nlauth_signature=${params.password}${nlauthRolePortion}`
        }
    };
}


function _responseLogger() {

    var buffer = '';
    return through(function transform(data, enc, cb) {
        buffer += data;
        this.push(data);
        cb();
    }, function flush(cb) {
        try {
            var data = JSON.parse(buffer);
        } catch (e) {
            throw Error('Unable to parse response: ' + e);
        }
        if (data.message) console.log(data.message);
        if (data.error) console.log(`${data.error.code} - ${data.error.message}`);
        cb();
    });

}