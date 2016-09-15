/**
 * Created by ybak on 16/9/15.
 */

window.nodeRequire = require;
delete window.require;
delete window.exports;
delete window.module;

window.__devtron = {require: nodeRequire, process: process}
